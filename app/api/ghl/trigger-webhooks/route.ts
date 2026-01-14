import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET: List trigger webhooks for a base
export async function GET(request: NextRequest) {
  const baseId = request.nextUrl.searchParams.get('baseId');

  if (!baseId) {
    return NextResponse.json({ error: 'baseId required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('ghl_sync_trigger_webhooks')
    .select('*')
    .eq('base_id', baseId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST: Create new trigger webhook
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { baseId, name } = body;

  if (!baseId || !name) {
    return NextResponse.json(
      { error: 'baseId and name are required' },
      { status: 400 }
    );
  }

  const { data: integration, error: integrationError } = await supabaseAdmin
    .from('ghl_integrations')
    .select('id')
    .eq('base_id', baseId)
    .single();

  if (integrationError || !integration) {
    return NextResponse.json(
      { error: 'GHL integration not found for this base' },
      { status: 404 }
    );
  }

  const secretToken = randomBytes(32).toString('hex');

  let createdBy: string | null = null;
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    createdBy = userData.user?.id ?? null;
  }

  const { data, error } = await supabaseAdmin
    .from('ghl_sync_trigger_webhooks')
    .insert({
      base_id: baseId,
      name,
      secret_token: secretToken,
      is_enabled: true,
      created_by: createdBy
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PUT: Update trigger webhook
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { webhookId, name, is_enabled } = body;

  if (!webhookId) {
    return NextResponse.json({ error: 'webhookId required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('ghl_sync_trigger_webhooks')
    .update({
      name,
      is_enabled
    })
    .eq('id', webhookId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE: Delete trigger webhook
export async function DELETE(request: NextRequest) {
  const webhookId = request.nextUrl.searchParams.get('webhookId');

  if (!webhookId) {
    return NextResponse.json({ error: 'webhookId required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('ghl_sync_trigger_webhooks')
    .delete()
    .eq('id', webhookId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
