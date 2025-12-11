import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { transformGHLContactToRecord } from '@/lib/utils/ghl-transform';

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
    const { baseId, fullSync } = body; // fullSync option to force full sync

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

    // Initialize sync progress (store in integration's field_mapping as temp storage or update integration directly)
    // We'll store progress in a separate update to ghl_integrations
    let totalContactsToSync = 0;

    // Helper function to update sync progress
    const updateSyncProgress = async (current: number, total: number, phase: 'fetching' | 'syncing') => {
      try {
        // Construct URL for internal API call - use origin from request or default to localhost
        const origin = request.headers.get('origin') || 
                       request.nextUrl.origin || 
                       `http://localhost:${process.env.PORT || 3000}`;
        
        // Call internal progress endpoint to update progress
        await fetch(`${origin}/api/ghl/sync-progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ baseId, current, total, phase }),
        }).catch(() => {}); // Ignore errors - progress update is best effort
      } catch (error) {
        // Ignore progress update errors
      }
    };

    // Initialize progress - fetching phase
    await updateSyncProgress(0, 0, 'fetching');

    // Determine if this is an incremental sync
    const isIncrementalSync = !fullSync && integration.last_sync_at;
    const syncType = isIncrementalSync ? 'incremental' : 'full';

    // Build query URL with optional date filter for incremental sync
    let queryUrl = `${GHL_API_BASE_URL}/contacts/?locationId=${integration.location_id}&limit=100`;

    // If we have a previous sync timestamp and not forcing full sync, only fetch contacts updated after that
    if (isIncrementalSync) {
      const lastSyncDate = new Date(integration.last_sync_at);
      // Format as ISO string for GHL API (they accept ISO 8601 format)
      const isoDateString = lastSyncDate.toISOString();
      queryUrl += `&startAfterDate=${encodeURIComponent(isoDateString)}`;
      console.log(`Incremental sync: fetching contacts updated after ${isoDateString}`);
    } else {
      console.log('Full sync: fetching all contacts');
    }

    // Fetch contacts from GHL with pagination
    let allContacts: any[] = [];
    let nextPageUrl: string | null = queryUrl;
    let pageCount = 0;

    while (nextPageUrl) {
      const contactsResponse = await fetch(
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

        // Update progress during fetching (if we have meta.total, use it; otherwise use current count)
      const estimatedTotal = contactsData.meta?.total || allContacts.length + (nextPageUrl ? 100 : 0);
      await updateSyncProgress(allContacts.length, estimatedTotal, 'fetching');
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/618db0db-dc88-4b24-9388-3127a0884ae1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync/route.ts:PAGINATION',message:'Fetched page',data:{pageCount,contactsOnPage:contacts.length,totalSoFar:allContacts.length,hasMore:!!nextPageUrl},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'PAGINATION'})}).catch(()=>{});
      // #endregion

      // Small delay between pages to avoid rate limiting
      if (nextPageUrl) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    totalContactsToSync = allContacts.length;

    const contacts = allContacts;

    // Log first contact for debugging (to see what fields are available)
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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/618db0db-dc88-4b24-9388-3127a0884ae1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync/route.ts:FIELDS',message:'Database fields for table',data:{tableId:masterTable.id,fieldCount:fields?.length,sampleFields:fields?.slice(0,5).map(f=>({id:f.id,name:f.name}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/618db0db-dc88-4b24-9388-3127a0884ae1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync/route.ts:MAPPING',message:'Field mapping being used',data:{integrationMappingKeys:Object.keys(integration.field_mapping).slice(0,10),finalMappingKeys:Object.keys(fieldMapping).slice(0,10),sampleMapping:Object.entries(fieldMapping).slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B'})}).catch(()=>{});
    // #endregion

    // Sync each contact
    let created = 0;
    let updated = 0;
    let errors = 0;
    let syncedCount = 0;

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
        // The list endpoint doesn't include custom field values
        let fullContact = contact;
        try {
          const fullContactResponse = await fetch(
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
            if (contacts.indexOf(contact) === 0) {
              console.log('Full contact with custom fields:', JSON.stringify(fullContact, null, 2));
            }
          }
        } catch (fetchError) {
          console.warn(`Could not fetch full contact ${contact.id}:`, fetchError);
        }

        // Small delay to avoid rate limiting (50ms between requests)
        await new Promise(resolve => setTimeout(resolve, 50));

        const recordValues = transformGHLContactToRecord(fullContact, fieldMapping);
        
        // Log first contact's transformed values for debugging
        if (contacts.indexOf(contact) === 0) {
          console.log('First contact transformed values:', JSON.stringify(recordValues, null, 2));
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/618db0db-dc88-4b24-9388-3127a0884ae1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync/route.ts:TRANSFORM',message:'First contact transform',data:{rawCustomFieldsSample:fullContact.customFields?.slice?.(0,3)||fullContact.customFields,transformedValuesSample:Object.entries(recordValues).slice(0,10).map(([k,v])=>({key:k,value:typeof v==='string'&&v.length>100?v.slice(0,100)+'...':v}))},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'CUSTOM_FIELDS'})}).catch(()=>{});
          // #endregion
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
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/618db0db-dc88-4b24-9388-3127a0884ae1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync/route.ts:UPDATE',message:'Updating existing record',data:{recordId:existingRecords[0].id,valuesKeys:Object.keys(recordValues),valuesPreview:JSON.stringify(recordValues).slice(0,500)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          const { data: updateData, error: updateError } = await supabaseAdmin
            .from('records')
            .update({ values: recordValues })
            .eq('id', existingRecords[0].id)
            .select('id, values');

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/618db0db-dc88-4b24-9388-3127a0884ae1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync/route.ts:UPDATE_RESULT',message:'Update result',data:{success:!updateError,error:updateError?.message,updatedValues:updateData?.[0]?.values?JSON.stringify(updateData[0].values).slice(0,500):null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
          // #endregion

          if (updateError) {
            console.error('Update error:', updateError);
            errors++;
          } else {
            updated++;
          }
        } else {
          // Create new record
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/618db0db-dc88-4b24-9388-3127a0884ae1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync/route.ts:INSERT',message:'Creating new record',data:{tableId:masterTable.id,valuesKeys:Object.keys(recordValues),valuesPreview:JSON.stringify(recordValues).slice(0,500)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
          // #endregion
          const { data: insertData, error: createError } = await supabaseAdmin
            .from('records')
            .insert({
              table_id: masterTable.id,
              values: recordValues,
            })
            .select('id, values');

          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/618db0db-dc88-4b24-9388-3127a0884ae1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync/route.ts:INSERT_RESULT',message:'Insert result',data:{success:!createError,error:createError?.message,insertedId:insertData?.[0]?.id,insertedValues:insertData?.[0]?.values?JSON.stringify(insertData[0].values).slice(0,500):null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A'})}).catch(()=>{});
          // #endregion

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

    // Verify records were actually saved by reading them back
    // #region agent log
    const { data: verifyRecords, error: verifyError } = await supabaseAdmin.from('records').select('id, values').eq('table_id', masterTable.id).limit(3);
    fetch('http://127.0.0.1:7242/ingest/618db0db-dc88-4b24-9388-3127a0884ae1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync/route.ts:VERIFY',message:'Verifying saved records',data:{error:verifyError?.message,recordCount:verifyRecords?.length,firstRecordValues:verifyRecords?.[0]?.values?JSON.stringify(verifyRecords[0].values).slice(0,500):null},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    // Update last sync timestamp
    await supabaseAdmin
      .from('ghl_integrations')
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
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

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/618db0db-dc88-4b24-9388-3127a0884ae1',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'sync/route.ts:FINAL',message:'Sync completed',data:{created,updated,errors,total:contacts.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
    // #endregion

    return NextResponse.json({
      success: true,
      message: `Synced ${created + updated} contacts (${created} created, ${updated} updated${errors > 0 ? `, ${errors} errors` : ''})`,
      synced: created + updated,
      created,
      updated,
      errors,
      total: contacts.length,
      syncType, // Return sync type for UI display
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

