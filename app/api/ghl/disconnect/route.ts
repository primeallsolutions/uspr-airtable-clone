import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Create admin client for server-side operations
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

// Helper to log audit events from API routes
async function logAuditEvent(params: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  scopeType: 'workspace' | 'base';
  scopeId: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: params.actorId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      scope_type: params.scopeType,
      scope_id: params.scopeId,
      metadata: params.metadata ?? {},
    });
  } catch (error) {
    console.warn('Failed to write audit log:', error);
  }
}

/**
 * DELETE /api/ghl/disconnect
 * Disconnects GHL integration for a base
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const baseId = searchParams.get('base_id');

    if (!baseId) {
      return NextResponse.json(
        { error: 'base_id is required' },
        { status: 400 }
      );
    }

    // Verify the base exists and get workspace info
    const { data: base, error: baseError } = await supabaseAdmin
      .from('bases')
      .select('id, workspace_id, name')
      .eq('id', baseId)
      .single();

    if (baseError || !base) {
      return NextResponse.json(
        { error: 'Base not found' },
        { status: 404 }
      );
    }

    // Get integration info before deletion
    const { data: integration } = await supabaseAdmin
      .from('ghl_integrations')
      .select('id, location_id')
      .eq('base_id', baseId)
      .single();

    // Delete integration using admin client
    const { error: deleteError } = await supabaseAdmin
      .from('ghl_integrations')
      .delete()
      .eq('base_id', baseId);

    if (deleteError) {
      console.error('Delete error:', deleteError);
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    // Try to get current user from auth header
    let actorId: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      actorId = userData.user?.id ?? null;
    }

    // Log GHL disconnection to audit log
    if (base.workspace_id && integration) {
      await logAuditEvent({
        actorId,
        action: 'delete',
        entityType: 'automation',
        entityId: integration.id,
        scopeType: 'workspace',
        scopeId: base.workspace_id,
        metadata: {
          type: 'ghl_integration',
          base_name: base.name,
          location_id: integration.location_id,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'GHL integration disconnected successfully',
    });
  } catch (error) {
    console.error('GHL disconnect error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
