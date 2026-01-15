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
    const mappedPayloadKeys = new Set<string>();
    
    // Extract data from payload (ignore meta fields like table_name, table_id)
    const dataPayload = { ...payload };
    delete dataPayload.table_name;
    delete dataPayload.table_id;

    // If webhook has field mappings configured, use JSONPath extraction first
    if (webhook.field_mapping && Object.keys(webhook.field_mapping).length > 0) {
      try {
        for (const [fieldId, jsonPath] of Object.entries(webhook.field_mapping as Record<string, string>)) {
          if (!jsonPath || jsonPath.trim() === '') continue;

          // Find the field by ID
          const targetField = existingFields?.find(f => f.id === fieldId);
          if (!targetField) {
            throw new Error(`Field with ID ${fieldId} not found in table`);
          }

          // Extract value from payload using JSONPath
          const value = getValueByJsonPath(dataPayload, jsonPath);
          if (value !== undefined) {
            recordData[fieldId] = convertValueToFieldType(value, targetField.type, targetField.options);
            mappedPayloadKeys.add(fieldId);
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error parsing field mappings';
        await logWebhookCall(webhook.id, 'error', payload, 400, `Field mapping error: ${errorMsg}`, null, targetTableId);
        return NextResponse.json(
          { error: 'Field mapping error', details: errorMsg },
          { status: 400 }
        );
      }
    }

    // Smart field matching by name for remaining fields (not in field mappings)
    for (const [key, value] of Object.entries(dataPayload)) {
      //Skip if already processed by field mapping
      if (mappedPayloadKeys.has(key)) continue;

      // Try to find matching field (case-insensitive, normalize spaces/underscores)
      const normalizedKey = key.toLowerCase().replace(/[_-]/g, ' ');
      const matchingField = existingFields?.find(f => 
        f.name.toLowerCase().replace(/[_-]/g, ' ') === normalizedKey
      );

      if (matchingField && !recordData[matchingField.id]) {
        // Field exists and hasn't been set by field mapping, validate and convert value
        recordData[matchingField.id] = convertValueToFieldType(value, matchingField.type, matchingField.options);
      } else if (!matchingField && mappedPayloadKeys.size === 0) { // Only create new fields if no manual field mappings were used
        // Field doesn't exist, queue for creation
        const inferredType = inferFieldType(value);
        fieldsToCreate.push({ name: key, type: inferredType, value });
      }
    }

    // 6. Create missing fields
    for (const newField of fieldsToCreate) {
      const position = (existingFields?.length || 0) + fieldsToCreate.indexOf(newField);
      const startingOptions = newField.type === 'single_select' || newField.type === 'multi_select' // for select fields, add options
        ? (() => {
          if (typeof newField.value === 'string' || typeof newField.value === 'number') {
            return { [`option_${new Date().getTime()}`]: { name: newField.value, color: "#1E40AF", label: newField.value } };
          } else if (Array.isArray(newField.value)) {
            const options: Record<string, { name: string; color: string; label: string }> = {};
            newField.value.forEach((val: string, i: number) => {
              const optionKey = `option_${new Date().getTime()}_${i}`;
              options[optionKey] = { name: val, color: "#1E40AF", label: val };
            });
            return options;
          }
        })() : {};
      
      const { data: createdField, error: fieldError } = await supabaseAdmin
        .from('fields')
        .insert({
          table_id: targetTableId,
          name: newField.name,
          type: newField.type,
          order_index: position,
          options: startingOptions
        })
        .select()
        .single();

      if (createdField && !fieldError) {
        recordData[createdField.id] = convertValueToFieldType(newField.value, newField.type, startingOptions);
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

    // 8. Log success
    await logWebhookCall(webhook.id, 'success', payload, 200, null, newRecord.id, targetTableId);

    const duration = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      record_id: newRecord.id,
      table_id: targetTableId,
      mappings_used: mappedPayloadKeys.size,
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
  const { data: webhook } = await supabaseAdmin
    .from('webhooks')
    .select('total_calls, successful_calls, failed_calls')
    .eq('id', webhookId)
    .single();
  if (webhook) {
    await supabaseAdmin
      .from('webhooks')
      .update({
        last_triggered_at: new Date().toISOString(),
        total_calls: webhook.total_calls + 1,
        successful_calls: status === 'success' ? webhook.successful_calls + 1 : webhook.successful_calls,
        failed_calls: status === 'error' ? webhook.failed_calls + 1 : webhook.failed_calls
      })
      .eq('id', webhookId);
  }
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

// Helper: Extract value from object using JSONPath notation
function getValueByJsonPath(obj: any, path: string): any {
  const pathParts = path.match(/[^\.\[\]]+|\[\d+\]/g) || [];
  let current = obj;

  for (const part of pathParts) {
    if (current === null || current === undefined) return undefined;

    const arrayMatch = part.match(/^\[(\d+)\]$/);
    if (arrayMatch) {
      const index = parseInt(arrayMatch[1]);
      current = current[index];
    } else {
      current = current[part];
    }
  }

  return current;
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
function convertValueToFieldType(value: any, fieldType: FieldType, fieldOptions?: Record<string, unknown>): any {
  if (value === null || value === undefined) return null;
  if (fieldOptions && Object.entries(fieldOptions).length > 0) {
    // Convert from names to option ids for select fields
    if (typeof value === 'string' || typeof value === 'number') {
      const options = Object.values(fieldOptions) as {name: string}[];
      const matchedOption = options.find(opt => opt.name === String(value));
      if (matchedOption) {
        value = Object.keys(fieldOptions).find(key => fieldOptions[key] === matchedOption);
      }
    } else if (Array.isArray(value)) {
      const options = Object.values(fieldOptions) as {name: string}[];
      value = value.map((val) => {
        const matchedOption = options.find(opt => opt.name === String(val));
        if (matchedOption) {
          return Object.keys(fieldOptions).find(key => fieldOptions[key] === matchedOption);
        }
        return val;
      });
    }
  }

  switch (fieldType) {
    case 'checkbox':
      return Boolean(value);
    case 'number':
    case 'monetary':
      return typeof value === 'number' ? value : parseFloat(value) || 0;
    case 'date':
      return new Date(value).toISOString().split('T')[0];
    case 'datetime':
      return new Date(value).toISOString().slice(0, -8);
    case 'phone':
      return formatPhone(String(value));
    case 'multi_select':
      return Array.isArray(value) ? value : [value];
    default:
      return String(value);
  }
}

// Helper: Format phone number to standard US format
const formatPhone = (phone: string): string => {
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');

  // Format as US phone number if 10 digits, otherwise return as-is with dashes
  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  } else if (digitsOnly.length === 11 && digitsOnly[0] === '1') {
    return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
  }
  return phone;
};