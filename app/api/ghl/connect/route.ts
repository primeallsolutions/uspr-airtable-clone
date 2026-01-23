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
 * POST /api/ghl/connect
 * Connect using Private Integration Token (simpler than OAuth)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseId, locationId, accessToken } = body;

    if (!baseId || !locationId || !accessToken) {
      return NextResponse.json(
        { error: 'baseId, locationId, and accessToken are required' },
        { status: 400 }
      );
    }

    // Verify the base exists
    const { data: base, error: baseError } = await supabaseAdmin
      .from('bases')
      .select('id, owner')
      .eq('id', baseId)
      .single();

    if (baseError || !base) {
      return NextResponse.json(
        { error: 'Base not found' },
        { status: 404 }
      );
    }

    // Create integration with Private Integration Token using admin client
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('ghl_integrations')
      .upsert({
        base_id: baseId,
        location_id: locationId,
        access_token: accessToken,
        refresh_token: null,
        token_expires_at: null,
        is_private_integration: true,
        sync_enabled: true,
        field_mapping: {},
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'base_id'
      })
      .select()
      .single();

    if (integrationError) {
      console.error('Integration error:', integrationError);
      return NextResponse.json(
        { error: integrationError.message },
        { status: 500 }
      );
    }

    // Get workspace_id for audit log
    const { data: baseWithWorkspace } = await supabaseAdmin
      .from('bases')
      .select('workspace_id, name')
      .eq('id', baseId)
      .single();

    // Try to get current user from auth header
    let actorId: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      actorId = userData.user?.id ?? null;
    }

    // Log GHL connection to audit log
    if (baseWithWorkspace?.workspace_id) {
      await logAuditEvent({
        actorId,
        action: 'create',
        entityType: 'automation',
        entityId: integration.id,
        scopeType: 'workspace',
        scopeId: baseWithWorkspace.workspace_id,
        metadata: {
          type: 'ghl_integration',
          base_name: baseWithWorkspace.name,
          location_id: locationId,
        },
      });
    }

    return NextResponse.json({
      success: true,
      integrationId: integration.id,
      message: 'GoHighLevel connected successfully',
    });
  } catch (error) {
    console.error('GHL connect error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
