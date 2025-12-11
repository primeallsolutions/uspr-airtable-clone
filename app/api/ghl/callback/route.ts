import { NextRequest, NextResponse } from 'next/server';
import { GHLService } from '@/lib/services/ghl-service';
import { createClient } from '@supabase/supabase-js';

// Create admin client for server-side operations
// Note: This requires SUPABASE_SERVICE_ROLE_KEY to be set in environment variables
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
 * GET /api/ghl/callback
 * Handles OAuth callback from Go High Level
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const locationId = searchParams.get('locationId');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth error
    if (error) {
      console.error('GHL OAuth error:', error);
      return NextResponse.redirect(
        new URL(
          `/bases?error=ghl_oauth_error&message=${encodeURIComponent(error)}`,
          request.url
        )
      );
    }

    // Validate required parameters
    if (!code || !locationId || !state) {
      return NextResponse.redirect(
        new URL(
          '/bases?error=ghl_oauth_invalid_params',
          request.url
        )
      );
    }

    // Extract base_id from state (format: baseId-timestamp)
    const baseId = state.split('-')[0];
    if (!baseId) {
      return NextResponse.redirect(
        new URL(
          '/bases?error=ghl_oauth_invalid_state',
          request.url
        )
      );
    }

    // Verify base exists and user has access
    const { data: base, error: baseError } = await supabaseAdmin
      .from('bases')
      .select('id')
      .eq('id', baseId)
      .single();

    if (baseError || !base) {
      return NextResponse.redirect(
        new URL(
          '/bases?error=ghl_oauth_base_not_found',
          request.url
        )
      );
    }

    // Exchange code for tokens
    const tokens = await GHLService.exchangeCodeForToken(code, locationId);

    // Get webhook URL
    const webhookUrl = new URL('/api/ghl/webhook', request.url).toString();

    // Register webhook
    let webhookId: string | undefined;
    try {
      // First create integration to get access token
      const tempIntegration = await GHLService.upsertIntegration(
        baseId,
        locationId,
        tokens
      );

      webhookId = await GHLService.registerWebhook(
        tempIntegration,
        webhookUrl
      );
    } catch (webhookError) {
      console.error('Failed to register webhook:', webhookError);
      // Continue even if webhook registration fails - user can retry later
    }

    // Create/update integration
    await GHLService.upsertIntegration(
      baseId,
      locationId,
      tokens,
      webhookId
    );

    // Redirect back to base with success
    return NextResponse.redirect(
      new URL(
        `/bases/${baseId}?ghl_connected=true`,
        request.url
      )
    );
  } catch (error) {
    console.error('GHL OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(
        `/bases?error=ghl_oauth_callback_error&message=${encodeURIComponent(errorMessage)}`,
        request.url
      )
    );
  }
}

