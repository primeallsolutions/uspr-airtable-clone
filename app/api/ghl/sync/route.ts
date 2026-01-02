import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { transformGHLContactToRecord } from '@/lib/utils/ghl-transform';
import type { FieldType } from '@/lib/types/base-detail';

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
 * POST /api/ghl/sync
 * Manually sync contacts from Go High Level
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseId, fullSync, isAutoSync } = body; // fullSync option to force full sync, isAutoSync to track auto-sync

    if (!baseId) {
      return NextResponse.json(
        { error: 'baseId is required' },
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

    if (!integration.sync_enabled) {
      return NextResponse.json(
        { error: 'Sync is disabled for this integration' },
        { status: 400 }
      );
    }

    // Initialize sync progress
    let totalContactsToSync = 0;

    // Helper function to update sync progress
    const updateSyncProgress = async (current: number, total: number, phase: 'fetching' | 'syncing') => {
      try {
        const origin = request.headers.get('origin') || 
                       request.nextUrl.origin || 
                       `http://localhost:${process.env.PORT || 3000}`;
        
        await fetch(`${origin}/api/ghl/sync-progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseId, current, total, phase }),
        }).catch(() => {});
      } catch (error) {
        // Ignore progress update errors
      }
    };

    // Initialize progress - fetching phase
    await updateSyncProgress(0, 0, 'fetching');

    // Determine if this is an incremental sync
    const isIncrementalSync = !fullSync && integration.last_sync_at;
    const syncType = isIncrementalSync ? 'incremental' : 'full';
    const lastSyncDate = isIncrementalSync ? new Date(integration.last_sync_at) : null;

    // Build query URL - GHL API doesn't support date filtering, so we fetch all and filter client-side
    let queryUrl = `${GHL_API_BASE_URL}/contacts/?locationId=${integration.location_id}&limit=100`;

    if (isIncrementalSync) {
      console.log(`Incremental sync: will filter contacts updated after ${lastSyncDate?.toISOString()}`);
    } else {
      console.log('Full sync: fetching all contacts');
    }

    // Fetch contacts from GHL with pagination
    let allContacts: any[] = [];
    let nextPageUrl: string | null = queryUrl;
    let pageCount = 0;

    while (nextPageUrl) {
      const contactsResponse: Response = await fetch(
        nextPageUrl,
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
      const contacts = contactsData.contacts || [];
      allContacts = allContacts.concat(contacts);
      pageCount++;

      // Get next page URL from meta
      nextPageUrl = contactsData.meta?.nextPageUrl || null;

      // Update progress during fetching
      const estimatedTotal = contactsData.meta?.total || allContacts.length + (nextPageUrl ? 100 : 0);
      await updateSyncProgress(allContacts.length, estimatedTotal, 'fetching');

      // Small delay between pages to avoid rate limiting
      if (nextPageUrl) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // For incremental sync, filter contacts updated after last_sync_at
    let contacts = allContacts;
    if (isIncrementalSync && lastSyncDate) {
      const beforeFilterCount = allContacts.length;
      contacts = allContacts.filter((contact: any) => {
        // Check if contact has a dateUpdated field
        if (contact.dateUpdated) {
          const contactUpdated = new Date(contact.dateUpdated);
          return contactUpdated > lastSyncDate;
        }
        // If no dateUpdated, include it (might be new)
        return true;
      });
      
      console.log(`Filtered ${beforeFilterCount} contacts to ${contacts.length} modified since last sync`);
    }

    totalContactsToSync = contacts.length;

    // Log first contact for debugging
    if (contacts.length > 0) {
      console.log('Sample GHL contact structure:', JSON.stringify(contacts[0], null, 2));
      console.log('Available customFields:', contacts[0].customFields ? Object.keys(contacts[0].customFields) : 'none');
    }

    if (contacts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No contacts found in GHL',
        synced: 0,
        created: 0,
        updated: 0,
      });
    }

    // Get masterlist table
    const { data: tables, error: tablesError } = await supabaseAdmin
      .from('tables')
      .select('id, name')
      .eq('base_id', baseId)
      .eq('is_master_list', true)
      .limit(1);

    if (tablesError || !tables || tables.length === 0) {
      return NextResponse.json(
        { error: 'Masterlist table not found in base' },
        { status: 404 }
      );
    }

    const masterTable = tables[0];

    // Get fields for field mapping
    const { data: fields } = await supabaseAdmin
      .from('fields')
      .select('id, name, type')
      .eq('table_id', masterTable.id);

    // Build field mapping with actual field IDs
    const fieldIds: Record<string, string | undefined> = {};
    fields?.forEach(field => {
      const lowerName = field.name.toLowerCase();
      if (['name', 'email', 'phone'].includes(lowerName)) {
        fieldIds[lowerName] = field.id;
      }
    });

    const fieldMapping = {
      ...integration.field_mapping,
      ...fieldIds,
    };

    // Build field types map for better value extraction
    const fieldTypesMap: Record<string, FieldType> = {};
    fields?.forEach(field => {
      fieldTypesMap[field.id] = field.type as FieldType;
    });

    // Sync each contact
    let created = 0;
    let updated = 0;
    let errors = 0;

    // Update progress - syncing phase started
    await updateSyncProgress(0, totalContactsToSync, 'syncing');

    // Log field mapping for debugging
    console.log('Field mapping being used:', JSON.stringify(fieldMapping, null, 2));

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i];
      
      // Update progress every 10 contacts
      if (i % 10 === 0 || i === contacts.length - 1) {
        await updateSyncProgress(i + 1, totalContactsToSync, 'syncing');
      }
      
      try {
        // Fetch full contact details to get custom field values
        let fullContact = contact;
        try {
          const fullContactResponse: Response = await fetch(
            `${GHL_API_BASE_URL}/contacts/${contact.id}`,
            {
              headers: {
                'Authorization': `Bearer ${integration.access_token}`,
                'Version': '2021-07-28',
                'Content-Type': 'application/json'
              },
            }
          );
          
          if (fullContactResponse.ok) {
            const fullContactData = await fullContactResponse.json();
            fullContact = fullContactData.contact || fullContactData || contact;
            
            // Log first full contact for debugging
            if (i === 0) {
              console.log('Full contact with custom fields:', JSON.stringify(fullContact, null, 2));
            }
          }
        } catch (fetchError) {
          console.warn(`Could not fetch full contact ${contact.id}:`, fetchError);
        }

        // Small delay to avoid rate limiting (50ms between requests)
        await new Promise(resolve => setTimeout(resolve, 50));

        const recordValues = transformGHLContactToRecord(fullContact, fieldMapping, fieldTypesMap);
        
        // Log first contact's transformed values for debugging
        if (i === 0) {
          console.log('First contact transformed values:', JSON.stringify(recordValues, null, 2));
        }

        // Check if record already exists (by ghl_contact_id)
        const { data: existingRecords } = await supabaseAdmin
          .from('records')
          .select('id')
          .eq('table_id', masterTable.id)
          .eq('values->>ghl_contact_id', contact.id)
          .limit(1);

        if (existingRecords && existingRecords.length > 0) {
          // Update existing record
          const { error: updateError } = await supabaseAdmin
            .from('records')
            .update({ values: recordValues })
            .eq('id', existingRecords[0].id);

          if (updateError) {
            console.error('Update error:', updateError);
            errors++;
          } else {
            updated++;
          }
        } else {
          // Create new record
          const { error: createError } = await supabaseAdmin
            .from('records')
            .insert({
              table_id: masterTable.id,
              values: recordValues,
            });

          if (createError) {
            console.error('Create error:', createError);
            errors++;
          } else {
            created++;
          }
        }
      } catch (contactError) {
        console.error('Error syncing contact:', contact.id, contactError);
        errors++;
      }
    }

    // Update last sync timestamp
    const updateData: Record<string, string> = {
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // If this was an auto-sync, also update last_auto_sync_at
    if (isAutoSync) {
      updateData.last_auto_sync_at = new Date().toISOString();
    }

    await supabaseAdmin
      .from('ghl_integrations')
      .update(updateData)
      .eq('id', integration.id);

    // Clear progress
    try {
      const origin = request.headers.get('origin') || 
                     request.nextUrl.origin || 
                     `http://localhost:${process.env.PORT || 3000}`;
      await fetch(`${origin}/api/ghl/sync-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseId, current: null, total: null }),
      }).catch(() => {});
    } catch (error) {
      // Ignore clear errors
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${created + updated} contacts (${created} created, ${updated} updated${errors > 0 ? `, ${errors} errors` : ''})`,
      synced: created + updated,
      created,
      updated,
      errors,
      total: contacts.length,
      syncType,
    });
  } catch (error) {
    console.error('GHL sync error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
