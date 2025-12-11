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

    // Verify the base exists
    const { data: base, error: baseError } = await supabaseAdmin
      .from('bases')
      .select('id')
      .eq('id', baseId)
      .single();

    if (baseError || !base) {
      return NextResponse.json(
        { error: 'Base not found' },
        { status: 404 }
      );
    }

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
