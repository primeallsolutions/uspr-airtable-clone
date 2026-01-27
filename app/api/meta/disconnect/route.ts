import { NextRequest, NextResponse } from 'next/server';
import { MetaService } from '@/lib/services/meta-service';
import { createClient } from '@supabase/supabase-js';

// Create Supabase client for server-side auth
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * POST /api/meta/disconnect
 * Disconnects Meta integration for the authenticated user
 */
export async function POST(request: NextRequest) {
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

    // Delete integration (cascades to connected accounts)
    const result = await MetaService.deleteIntegration(user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    console.error('Meta disconnect error:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Meta integration' },
      { status: 500 }
    );
  }
}
