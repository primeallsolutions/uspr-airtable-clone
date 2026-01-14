import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSyncProgress } from '../../sync-progress/route';

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

type TriggerResult = {
  success: boolean;
  response_status: number;
  error_message: string | null;
  payload: unknown;
  sync_result?: Record<string, unknown>;
  duration_ms?: number;
};

async function logTriggerWebhookCall(
  webhookId: string,
  status: 'success' | 'error',
  payload: unknown,
  responseStatus: number,
  errorMessage: string | null
) {
  await supabaseAdmin.from('webhook_logs').insert({
    webhook_id: null,
    ghl_sync_trigger_webhook_id: webhookId,
    status,
    request_payload: payload,
    response_status: responseStatus,
    error_message: errorMessage,
    record_id: null,
    table_id: null
  });
}

async function updateTriggerStats(
  webhookId: string,
  totals: { total_calls: number; successful_calls: number; failed_calls: number }
) {
  await supabaseAdmin
    .from('ghl_sync_trigger_webhooks')
    .update({
      total_calls: totals.total_calls,
      successful_calls: totals.successful_calls,
      failed_calls: totals.failed_calls,
      last_triggered_at: new Date().toISOString()
    })
    .eq('id', webhookId);
}

async function parsePayload(request: NextRequest): Promise<unknown> {
  const rawBody = await request.text();
  if (!rawBody) return {};
  try {
    return JSON.parse(rawBody);
  } catch {
    return { raw: rawBody };
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const payload = await parsePayload(request);

  const { data: triggerWebhook, error: triggerError } = await supabaseAdmin
    .from('ghl_sync_trigger_webhooks')
    .select('*')
    .eq('secret_token', token)
    .eq('is_enabled', true)
    .single();

  if (triggerError || !triggerWebhook) {
    return NextResponse.json(
      { error: 'Invalid or disabled trigger webhook' },
      { status: 401 }
    );
  }

  const { data: integration, error: integrationError } = await supabaseAdmin
    .from('ghl_integrations')
    .select('*')
    .eq('base_id', triggerWebhook.base_id)
    .single();

  if (integrationError || !integration) {
    const result: TriggerResult = {
      success: false,
      response_status: 404,
      error_message: 'GHL integration not found for this base',
      payload
    };
    await logTriggerWebhookCall(triggerWebhook.id, 'error', payload, 404, result.error_message);
    await updateTriggerStats(triggerWebhook.id, {
      total_calls: triggerWebhook.total_calls + 1,
      successful_calls: triggerWebhook.successful_calls,
      failed_calls: triggerWebhook.failed_calls + 1
    });
    return NextResponse.json({ error: result.error_message }, { status: 404 });
  }

  if (!integration.sync_enabled) {
    const result: TriggerResult = {
      success: false,
      response_status: 400,
      error_message: 'Sync is disabled for this integration',
      payload
    };
    await logTriggerWebhookCall(triggerWebhook.id, 'error', payload, 400, result.error_message);
    await updateTriggerStats(triggerWebhook.id, {
      total_calls: triggerWebhook.total_calls + 1,
      successful_calls: triggerWebhook.successful_calls,
      failed_calls: triggerWebhook.failed_calls + 1
    });
    return NextResponse.json({ error: result.error_message }, { status: 400 });
  }

  const existingProgress = getSyncProgress(triggerWebhook.base_id);
  if (existingProgress) {
    const result: TriggerResult = {
      success: false,
      response_status: 429,
      error_message: 'Sync already running for this base',
      payload
    };
    await logTriggerWebhookCall(triggerWebhook.id, 'error', payload, 429, result.error_message);
    await updateTriggerStats(triggerWebhook.id, {
      total_calls: triggerWebhook.total_calls + 1,
      successful_calls: triggerWebhook.successful_calls,
      failed_calls: triggerWebhook.failed_calls + 1
    });
    return NextResponse.json({ error: result.error_message }, { status: 429 });
  }

  const startTime = Date.now();
  const origin = request.headers.get('origin') ||
    request.nextUrl.origin ||
    process.env.NEXT_PUBLIC_APP_URL ||
    `http://localhost:${process.env.PORT || 3000}`;

  let syncResult: Record<string, unknown> | undefined;
  let responseStatus = 200;
  let errorMessage: string | null = null;
  let wasSuccessful = false;

  try {
    const syncResponse = await fetch(`${origin}/api/ghl/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseId: triggerWebhook.base_id })
    });

    responseStatus = syncResponse.status;
    syncResult = await syncResponse.json().catch(() => ({}));

    if (syncResponse.ok && (syncResult as { success?: boolean }).success !== false) {
      wasSuccessful = true;
    } else {
      errorMessage = (syncResult as { error?: string }).error || 'Failed to trigger sync';
    }
  } catch (error) {
    responseStatus = 500;
    errorMessage = error instanceof Error ? error.message : 'Failed to trigger sync';
  }

  const durationMs = Date.now() - startTime;

  await logTriggerWebhookCall(
    triggerWebhook.id,
    wasSuccessful ? 'success' : 'error',
    payload,
    responseStatus,
    errorMessage
  );
  await updateTriggerStats(triggerWebhook.id, {
    total_calls: triggerWebhook.total_calls + 1,
    successful_calls: triggerWebhook.successful_calls + (wasSuccessful ? 1 : 0),
    failed_calls: triggerWebhook.failed_calls + (wasSuccessful ? 0 : 1)
  });

  if (!wasSuccessful) {
    return NextResponse.json(
      { error: errorMessage || 'Failed to trigger sync' },
      { status: responseStatus }
    );
  }

  const syncedCount = (syncResult as { synced?: number }).synced;
  return NextResponse.json({
    success: true,
    sync_triggered: true,
    contacts_synced: typeof syncedCount === 'number' ? syncedCount : undefined,
    duration_ms: durationMs,
    sync_result: syncResult
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: triggerWebhook, error: triggerError } = await supabaseAdmin
    .from('ghl_sync_trigger_webhooks')
    .select('id')
    .eq('secret_token', token)
    .eq('is_enabled', true)
    .single();

  if (triggerError || !triggerWebhook) {
    return NextResponse.json(
      { error: 'Invalid or disabled trigger webhook' },
      { status: 401 }
    );
  }

  return NextResponse.json({ status: 'ok' });
}
