import { NextRequest, NextResponse } from 'next/server';
import { GHLService } from '@/lib/services/ghl-service';
import { transformGHLContactToRecord } from '@/lib/utils/ghl-transform';
import { createClient } from '@supabase/supabase-js';
import type { FieldType } from '@/lib/types/base-detail';
import crypto from 'crypto';

// Create admin client for server-side operations
// Note: This requires SUPABASE_SERVICE_ROLE_KEY to be set in environment variables
// Falls back to anon key if service role key is not available (not recommended for production)
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

/**
 * Verify webhook signature (if GHL provides signature verification)
 */
function verifyWebhookSignature(
  payload: string,
  signature: string | null
): boolean {
  const webhookSecret = process.env.GHL_WEBHOOK_SECRET;
  
  if (!webhookSecret || !signature) {
    // If no secret configured, allow webhook (not recommended for production)
    console.warn('GHL_WEBHOOK_SECRET not configured or no signature provided');
    return true; // Allow for development
  }

  // GHL typically uses HMAC SHA256
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payload)
    .digest('hex');

  // Use constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

/**
 * POST /api/ghl/webhook
 * Receives webhooks from Go High Level for contact events
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();
    
    // Verify signature (if provided)
    const signature = request.headers.get('x-ghl-signature') || 
                     request.headers.get('x-signature') ||
                     request.headers.get('signature');
    
    if (!verifyWebhookSignature(body, signature)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    // Parse webhook payload
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Extract contact data from payload
    // GHL webhook structure may vary - handle common patterns
    const contactData = (payload as any).contact || 
                       (payload as any).Contact || 
                       payload;
    
    const locationId = (payload as any).locationId || 
                      (payload as any).location_id ||
                      contactData?.locationId;

    if (!locationId || !contactData?.id) {
      console.error('Invalid webhook payload:', payload);
      return NextResponse.json(
        { error: 'Missing required fields (locationId, contact.id)' },
        { status: 400 }
      );
    }

    // Find integration by location_id (use admin client for webhook processing)
    const integration = await GHLService.getIntegrationByLocationId(locationId, supabaseAdmin);
    if (!integration || !integration.sync_enabled) {
      console.warn(`No active integration found for location ${locationId}`);
      return NextResponse.json(
        { message: 'No active integration found' },
        { status: 200 } // Return 200 to prevent GHL from retrying
      );
    }

    // Get base and tables
    const { data: base, error: baseError } = await supabaseAdmin
      .from('bases')
      .select('id')
      .eq('id', integration.base_id)
      .single();

    if (baseError || !base) {
      await GHLService.logSync(
        integration.id,
        contactData.id,
        'updated',
        'failed',
        'Base not found'
      );
      return NextResponse.json(
        { error: 'Base not found' },
        { status: 404 }
      );
    }

    // Get masterlist table
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('tables')
      .select('id, name')
      .eq('base_id', base.id)
      .eq('is_master_list', true)
      .limit(1);

    if (tablesError || !tables || tables.length === 0) {
      await GHLService.logSync(
        integration.id,
        contactData.id,
        'updated',
        'failed',
        'Masterlist table not found'
      );
      return NextResponse.json(
        { error: 'Masterlist table not found' },
        { status: 404 }
      );
    }

    const masterTable = tables[0];

    // Get all fields for the table
    const { data: fields, error: fieldsError } = await supabaseAdmin
      .from('fields')
      .select('id, name, type')
      .eq('table_id', masterTable.id);

    if (fieldsError) {
      await GHLService.logSync(
        integration.id,
        contactData.id,
        'updated',
        'failed',
        'Failed to fetch fields'
      );
      return NextResponse.json(
        { error: 'Failed to fetch fields' },
        { status: 500 }
      );
    }

    // Create field mapping with actual field IDs
    const fieldIds: Record<string, string | undefined> = {};
    fields?.forEach(field => {
      const lowerName = field.name.toLowerCase();
      if (lowerName === 'name' || lowerName === 'email' || lowerName === 'phone') {
        fieldIds[lowerName] = field.id;
      }
    });

    // Build complete field mapping
    const fieldMapping = {
      ...integration.field_mapping,
      ...fieldIds,
    };

    // Build field types map for better value extraction
    const fieldTypesMap: Record<string, FieldType> = {};
    fields?.forEach(field => {
      fieldTypesMap[field.id] = field.type as FieldType;
    });

    // Transform GHL contact to record values
    const recordValues = transformGHLContactToRecord(
      contactData,
      fieldMapping,
      fieldTypesMap
    );

    // Check if record already exists (by ghl_contact_id)
    const { data: existingRecords } = await supabaseAdmin
      .from('records')
      .select('id')
      .eq('table_id', masterTable.id)
      .eq('values->>ghl_contact_id', contactData.id)
      .limit(1);

    let recordId: string;
    let action: 'created' | 'updated' = 'created';

    if (existingRecords && existingRecords.length > 0) {
      // Update existing record
      recordId = existingRecords[0].id;
      const { error: updateError } = await supabaseAdmin
        .from('records')
        .update({
          values: recordValues,
        })
        .eq('id', recordId);

      if (updateError) {
        await GHLService.logSync(
          integration.id,
          contactData.id,
          'updated',
          'failed',
          updateError.message,
          recordValues
        );
        throw updateError;
      }
      action = 'updated';
    } else {
      // Create new record
      const { data: newRecord, error: createError } = await supabaseAdmin
        .from('records')
        .insert({
          table_id: masterTable.id,
          values: recordValues,
        })
        .select('id')
        .single();

      if (createError || !newRecord) {
        await GHLService.logSync(
          integration.id,
          contactData.id,
          'created',
          'failed',
          createError?.message || 'Failed to create record',
          recordValues
        );
        throw createError || new Error('Failed to create record');
      }
      recordId = newRecord.id;
    }

    // Update last sync timestamp
    await GHLService.updateLastSync(integration.id);

    // Log successful sync
    await GHLService.logSync(
      integration.id,
      contactData.id,
      action,
      'success',
      undefined,
      recordValues
    );

    return NextResponse.json({
      success: true,
      recordId,
      action,
    });
  } catch (error) {
    console.error('GHL webhook error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Allow GET for webhook verification (some services ping the endpoint)
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}

