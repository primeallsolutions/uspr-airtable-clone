import { NextRequest, NextResponse } from 'next/server';
import { MetaService } from '@/lib/services/meta-service';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for server-side auth
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/meta/auth
 * Initiates OAuth flow by redirecting to Meta authorization page
 */
export async function GET(request: NextRequest) {
  try {
    // Get user from session
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized - no auth header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - invalid token' },
        { status: 401 }
      );
    }

    // Generate authorization URL with user ID in state
    const authUrl = MetaService.getAuthorizationUrl(user.id);

    // Return the URL instead of redirecting (frontend will handle redirect)
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Meta OAuth initiation error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
