import { NextRequest, NextResponse } from 'next/server';
import { GHLService } from '@/lib/services/ghl-service';

/**
 * GET /api/ghl/auth
 * Initiates OAuth flow by redirecting to GHL authorization page
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const baseId = searchParams.get('base_id');
    const state = searchParams.get('state');

    if (!baseId) {
      return NextResponse.json(
        { error: 'base_id is required' },
        { status: 400 }
      );
    }

    // Generate state if not provided (includes base_id for callback)
    const authState = state || `${baseId}_${Date.now()}`;

    // Generate authorization URL
    const authUrl = GHLService.getAuthorizationUrl(baseId, authState);

    // Redirect to GHL authorization page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('GHL OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}

