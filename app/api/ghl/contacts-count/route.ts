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

    // Fetch first page to get total count from meta
    const contactsResponse = await fetch(
      `${GHL_API_BASE_URL}/contacts/?locationId=${integration.location_id}&limit=1`,
      {
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json'
        },
      }
    );

    if (!contactsResponse.ok) {
      const errorText = await contactsResponse.text();
      console.error('GHL API error:', errorText);
      return NextResponse.json(
        { error: `Failed to fetch contacts from GHL: ${contactsResponse.status}` },
        { status: 500 }
      );
    }

    const contactsData = await contactsResponse.json();
    
    // Get total count from meta or count contacts by paginating through all pages
    let totalCount = 0;
    
    if (contactsData.meta?.total) {
      // If GHL API provides total in meta
      totalCount = contactsData.meta.total;
    } else {
      // Otherwise, count by fetching all pages
      let nextPageUrl: string | null = `${GHL_API_BASE_URL}/contacts/?locationId=${integration.location_id}&limit=100`;
      
      while (nextPageUrl) {
        const pageResponse = await fetch(nextPageUrl, {
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          },
        });

        if (!pageResponse.ok) break;
        
        const pageData = await pageResponse.json();
        const contacts = pageData.contacts || [];
        totalCount += contacts.length;
        
        nextPageUrl = pageData.meta?.nextPageUrl || null;
        
        // Small delay to avoid rate limiting
        if (nextPageUrl) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

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
