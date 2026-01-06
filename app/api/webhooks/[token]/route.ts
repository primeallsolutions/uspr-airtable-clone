import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { FieldType } from '@/lib/types/base-detail';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const startTime = Date.now();
  const { token } = await params;

  try {
    // 1. Validate webhook token
    const { data: webhook, error: webhookError } = await supabaseAdmin
      .from('webhooks')
      .select('*, bases!inner(id, name)')
      .eq('secret_token', token)
      .eq('is_enabled', true)
      .single();

    if (webhookError || !webhook) {
      return NextResponse.json(
        { error: 'Invalid or disabled webhook' },
        { status: 401 }
      );
    }

    // 2. Parse request payload
    let payload: any;
    try {
      payload = await request.json();
    } catch (e) {
      await logWebhookCall(webhook.id, 'error', {}, 400, 'Invalid JSON payload', null, null);
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // 3. Determine target table
    let targetTableId = webhook.default_table_id;
    
    // Allow payload to specify table by name or id
    if (payload.table_name) {
      const { data: table } = await supabaseAdmin
        .from('tables')
        .select('id')
        .eq('base_id', webhook.base_id)
        .eq('name', payload.table_name)
        .single();
      
      if (table) targetTableId = table.id;
    } else if (payload.table_id) {
      targetTableId = payload.table_id;
    }

    // If no target table, use master list or first table
    if (!targetTableId) {
      const { data: tables } = await supabaseAdmin
        .from('tables')
        .select('id, is_master_list')
        .eq('base_id', webhook.base_id)
        .order('created_at', { ascending: true });
      
      const masterTable = tables?.find(t => t.is_master_list);
      targetTableId = masterTable?.id || tables?.[0]?.id;
    }

    if (!targetTableId) {
      await logWebhookCall(webhook.id, 'error', payload, 400, 'No target table found', null, null);
      return NextResponse.json(
        { error: 'No target table found in base' },
        { status: 400 }
      );
    }

    // 4. Load existing fields
    const { data: existingFields } = await supabaseAdmin
      .from('fields')
      .select('*')
      .eq('table_id', targetTableId)
      .order('order_index', { ascending: true });

    // 5. Smart field mapping
    const recordData: Record<string, any> = {};
    const fieldsToCreate: Array<{ name: string; type: FieldType; value: any }> = [];
    
    // Extract data from payload (ignore meta fields like table_name, table_id)
    const dataPayload = { ...payload };
    delete dataPayload.table_name;
    delete dataPayload.table_id;

    for (const [key, value] of Object.entries(dataPayload)) {
      // Try to find matching field (case-insensitive, normalize spaces/underscores)
      const normalizedKey = key.toLowerCase().replace(/[_-]/g, ' ');
      const matchingField = existingFields?.find(f => 
        f.name.toLowerCase().replace(/[_-]/g, ' ') === normalizedKey
      );

      if (matchingField) {
        // Field exists, validate and convert value
        recordData[matchingField.id] = convertValueToFieldType(value, matchingField.type);
      } else {
        // Field doesn't exist, queue for creation
        const inferredType = inferFieldType(value);
        fieldsToCreate.push({ name: key, type: inferredType, value });
      }
    }

    // 6. Create missing fields
    for (const newField of fieldsToCreate) {
      const position = (existingFields?.length || 0) + fieldsToCreate.indexOf(newField);
      
      const { data: createdField, error: fieldError } = await supabaseAdmin
        .from('fields')
        .insert({
          table_id: targetTableId,
          name: newField.name,
          type: newField.type,
          order_index: position
        })
        .select()
        .single();

      if (createdField && !fieldError) {
        recordData[createdField.id] = convertValueToFieldType(newField.value, newField.type);
      }
    }

    // 7. Insert record
    const { data: newRecord, error: recordError } = await supabaseAdmin
      .from('records')
      .insert({
        table_id: targetTableId,
        values: recordData
      })
      .select()
      .single();

    if (recordError) {
      await logWebhookCall(webhook.id, 'error', payload, 500, recordError.message, null, targetTableId);
      return NextResponse.json(
        { error: 'Failed to create record', details: recordError.message },
        { status: 500 }
      );
    }

    // 8. Update webhook stats
    await supabaseAdmin
      .from('webhooks')
      .update({
        last_triggered_at: new Date().toISOString(),
        total_calls: webhook.total_calls + 1,
        successful_calls: webhook.successful_calls + 1
      })
      .eq('id', webhook.id);

    // 9. Log success
    await logWebhookCall(webhook.id, 'success', payload, 200, null, newRecord.id, targetTableId);

    const duration = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      record_id: newRecord.id,
      table_id: targetTableId,
      fields_created: fieldsToCreate.length,
      duration_ms: duration
    });

  } catch (error) {
    console.error('Webhook error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    try {
      const { data: webhook } = await supabaseAdmin
        .from('webhooks')
        .select('id, total_calls, failed_calls')
        .eq('secret_token', token)
        .single();
      
      if (webhook) {
        await logWebhookCall(webhook.id, 'error', {}, 500, message, null, null);
        await supabaseAdmin
          .from('webhooks')
          .update({
            total_calls: webhook.total_calls + 1,
            failed_calls: webhook.failed_calls + 1
          })
          .eq('id', webhook.id);
      }
    } catch (logError) {
      console.error('Failed to log webhook error:', logError);
    }

    return NextResponse.json(
      { error: 'Internal server error', message },
      { status: 500 }
    );
  }
}

// Helper: Log webhook call
async function logWebhookCall(
  webhookId: string,
  status: 'success' | 'error',
  payload: any,
  responseStatus: number,
  errorMessage: string | null,
  recordId: string | null,
  tableId: string | null
) {
  await supabaseAdmin.from('webhook_logs').insert({
    webhook_id: webhookId,
    status,
    request_payload: payload,
    response_status: responseStatus,
    error_message: errorMessage,
    record_id: recordId,
    table_id: tableId
  });
}

// Helper: Infer field type from value
function inferFieldType(value: any): FieldType {
  if (value === null || value === undefined) return 'text';
  if (typeof value === 'boolean') return 'checkbox';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'number' : 'number';
  }
  if (typeof value === 'string') {
    // Check if it's a date
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return 'date';
    // Check if it's an email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';
    // Check if it's a URL
    if (/^https?:\/\//.test(value)) return 'link';
    // Check if it's long text
    if (value.length > 200) return 'long_text';
    return 'text';
  }
  if (Array.isArray(value)) return 'multi_select';
  return 'text';
}

// Helper: Convert value to appropriate type
function convertValueToFieldType(value: any, fieldType: FieldType): any {
  if (value === null || value === undefined) return null;

  switch (fieldType) {
    case 'checkbox':
      return Boolean(value);
    case 'number':
    case 'monetary':
      return typeof value === 'number' ? value : parseFloat(value) || 0;
    case 'date':
      return typeof value === 'string' ? value : new Date(value).toISOString();
    case 'multi_select':
      return Array.isArray(value) ? value : [value];
    default:
      return String(value);
  }
}

