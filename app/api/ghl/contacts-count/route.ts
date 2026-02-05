import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const GHL_API_BASE_URL = 'https://services.leadconnectorhq.com';

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
 * GET /api/ghl/contacts-count
 * Get total count of contacts in GHL for a given base
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const baseId = searchParams.get('base_id');

    if (!baseId) {
      return NextResponse.json(
        { error: 'base_id is required' },
        { status: 400 }
      );
    }

    // Get integration
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('ghl_integrations')
      .select('*')
      .eq('base_id', baseId)
      .single();

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'GHL integration not found for this base' },
        { status: 404 }
      );
    }

    // Fetch first page to get total count from meta using new Search API
    const searchResponse: Response = await fetch(
      `${GHL_API_BASE_URL}/contacts/search`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          locationId: integration.location_id,
          page: 1,
          pageLimit: 1,
        }),
      }
    );

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('GHL API error:', errorText);
      return NextResponse.json(
        { error: `Failed to fetch contacts from GHL: ${searchResponse.status}` },
        { status: 500 }
      );
    }

    const searchData = await searchResponse.json();
    
    // Get total count from response
    const totalCount = searchData.total || 0;

    return NextResponse.json({
      success: true,
      total: totalCount,
    });
  } catch (error) {
    console.error('GHL contacts count error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
