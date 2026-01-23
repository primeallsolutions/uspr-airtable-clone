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

/**
 * PUT /api/ghl/autosync-settings
 * Update auto-sync settings for a GHL integration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseId, auto_sync_enabled, auto_sync_interval_minutes } = body;

    if (!baseId) {
      return NextResponse.json(
        { error: 'baseId is required' },
        { status: 400 }
      );
    }

    // Validate interval if auto-sync is enabled
    if (auto_sync_enabled && auto_sync_interval_minutes !== null) {
      const validIntervals = [1, 5, 15, 30, 60];
      if (!validIntervals.includes(auto_sync_interval_minutes)) {
        return NextResponse.json(
          { error: 'Invalid sync interval. Must be one of: 1, 5, 15, 30, 60 minutes' },
          { status: 400 }
        );
      }
    }

    // Check if integration exists
    const { data: integration, error: fetchError } = await supabaseAdmin
      .from('ghl_integrations')
      .select('id')
      .eq('base_id', baseId)
      .single();

    if (fetchError || !integration) {
      return NextResponse.json(
        { error: 'GHL integration not found for this base' },
        { status: 404 }
      );
    }

    // Update integration with new auto-sync settings
    const { error: updateError } = await supabaseAdmin
      .from('ghl_integrations')
      .update({
        auto_sync_enabled: auto_sync_enabled,
        auto_sync_interval_minutes: auto_sync_interval_minutes,
        updated_at: new Date().toISOString()
      })
      .eq('base_id', baseId);

    if (updateError) {
      console.error('Failed to update auto-sync settings:', updateError);
      return NextResponse.json(
        { error: 'Failed to update auto-sync settings' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: 'Auto-sync settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating auto-sync settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

