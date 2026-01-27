import { NextRequest, NextResponse } from 'next/server';
import { MetaService } from '@/lib/services/meta-service';
import { META_SCOPES } from '@/lib/types/meta-integration';

/**
 * GET /api/meta/callback
 * Handles OAuth callback from Meta
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorReason = searchParams.get('error_reason');
    const errorDescription = searchParams.get('error_description');

    // Handle OAuth error (user denied permissions)
    if (error) {
      console.error('Meta OAuth error:', { error, errorReason, errorDescription });
      return NextResponse.redirect(
        new URL(
          `/dashboard?view=marketing&error=meta_oauth_denied&message=${encodeURIComponent(errorDescription || error)}`,
          request.url
        )
      );
    }

    // Validate required parameters
    if (!code || !state) {
      return NextResponse.redirect(
        new URL(
          '/dashboard?view=marketing&error=meta_oauth_invalid_params',
          request.url
        )
      );
    }

    // Extract user_id from state (format: userId_timestamp)
    const userId = state.split('_')[0];
    if (!userId) {
      return NextResponse.redirect(
        new URL(
          '/dashboard?view=marketing&error=meta_oauth_invalid_state',
          request.url
        )
      );
    }

    // Exchange authorization code for short-lived access token
    const shortLivedToken = await MetaService.exchangeCodeForToken(code);

    // Exchange for long-lived token (60 days)
    const longLivedToken = await MetaService.exchangeForLongLivedToken(
      shortLivedToken.access_token
    );

    // Save integration to database
    const integration = await MetaService.upsertIntegration(
      userId,
      longLivedToken.access_token,
      longLivedToken.expires_in,
      Array.from(META_SCOPES)
    );

    // Fetch user's Facebook Pages
    const pages = await MetaService.getConnectedPages(longLivedToken.access_token);

    // Fetch Instagram accounts linked to Pages
    const instagramAccounts = await MetaService.getAllInstagramAccounts(pages);

    // Save connected accounts to database
    await MetaService.saveConnectedAccounts(
      integration.id,
      pages,
      instagramAccounts
    );

    // Redirect back to Marketing page with success
    return NextResponse.redirect(
      new URL(
        `/dashboard?view=marketing&meta_connected=true`,
        request.url
      )
    );
  } catch (error) {
    console.error('Meta OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.redirect(
      new URL(
        `/dashboard?view=marketing&error=meta_oauth_callback_error&message=${encodeURIComponent(errorMessage)}`,
        request.url
      )
    );
  }
}
