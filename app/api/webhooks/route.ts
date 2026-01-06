import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'crypto';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET: List webhooks for a base
export async function GET(request: NextRequest) {
  const baseId = request.nextUrl.searchParams.get('baseId');
  
  if (!baseId) {
    return NextResponse.json({ error: 'baseId required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('webhooks')
    .select('*')
    .eq('base_id', baseId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST: Create new webhook
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { baseId, name, defaultTableId } = body;

  if (!baseId || !name) {
    return NextResponse.json(
      { error: 'baseId and name are required' },
      { status: 400 }
    );
  }

  // Generate unique secret token
  const secretToken = randomBytes(32).toString('hex');

  const { data, error } = await supabaseAdmin
    .from('webhooks')
    .insert({
      base_id: baseId,
      name,
      secret_token: secretToken,
      default_table_id: defaultTableId,
      is_enabled: true
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PUT: Update webhook
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { webhookId, name, is_enabled, default_table_id } = body;

  if (!webhookId) {
    return NextResponse.json({ error: 'webhookId required' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('webhooks')
    .update({
      name,
      is_enabled,
      default_table_id
    })
    .eq('id', webhookId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE: Delete webhook
export async function DELETE(request: NextRequest) {
  const webhookId = request.nextUrl.searchParams.get('webhookId');

  if (!webhookId) {
    return NextResponse.json({ error: 'webhookId required' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('webhooks')
    .delete()
    .eq('id', webhookId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

