import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

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
