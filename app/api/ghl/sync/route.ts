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

// Helper to log audit events from API routes
async function logAuditEvent(params: {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  scopeType: 'workspace' | 'base';
  scopeId: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: params.actorId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId,
      scope_type: params.scopeType,
      scope_id: params.scopeId,
      metadata: params.metadata ?? {},
    });
  } catch (error) {
    console.warn('Failed to write audit log:', error);
  }
}

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

    if (isIncrementalSync) {
      console.log(`Incremental sync: will filter contacts updated after ${lastSyncDate?.toISOString()}`);
    } else {
      console.log('Full sync: fetching all contacts');
    }

    // Fetch contacts from GHL using new Search API with standard pagination
    let allContacts: any[] = [];
    let pageCount = 0;
    const pageSize = 100;

    while (true) {
      pageCount++;
      
      // Build request body for Search API
      const searchRequestBody: any = {
        locationId: integration.location_id,
        page: pageCount,
        pageLimit: pageSize,
      };

      // Add filters for incremental sync
      if (isIncrementalSync && lastSyncDate) {
        searchRequestBody.filters = [
          {
            field: 'dateUpdated',
            operator: 'range',
            value: {
              gt: lastSyncDate.toISOString(),
            },
          },
        ];
      }

      const contactsResponse: Response = await fetch(
        `${GHL_API_BASE_URL}/contacts/search`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(searchRequestBody),
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
      const totalContacts = contactsData.total || 0;
      
      console.log(`Page ${pageCount}: fetched ${contacts.length} contacts, total: ${totalContacts}`);
      
      if (contacts.length === 0) {
        break; // No more results
      }

      allContacts = allContacts.concat(contacts);

      // Update progress during fetching
      await updateSyncProgress(allContacts.length, totalContacts, 'fetching');

      // Stop if we got fewer results than requested (we're on the last page)
      if (contacts.length < pageSize) {
        break;
      }

      // Small delay between pages to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // For incremental sync, we already filtered on the server via Search API filters
    // So we just use all the contacts we fetched
    let contacts = allContacts;

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

    // Get workspace_id for audit logging
    const { data: baseData } = await supabaseAdmin
      .from('bases')
      .select('workspace_id, name')
      .eq('id', baseId)
      .single();

    // Get fields for field mapping
    const { data: fields } = await supabaseAdmin
      .from('fields')
      .select('id, name, type, options')
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
      
      // Check for cancellation every 10 contacts
      if (i % 10 === 0) {
        try {
          const progressResponse = await fetch(`${request.nextUrl.origin}/api/ghl/sync-progress?base_id=${baseId}`);
          const progressData = await progressResponse.json();
          if (progressData.progress?.cancelled) {
            console.log(`Sync cancelled at contact ${i + 1}/${contacts.length}`);
            // Clear progress
            await fetch(`${request.nextUrl.origin}/api/ghl/sync-progress`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ baseId, current: null, total: null }),
            }).catch(() => {});
            
            return NextResponse.json({
              success: false,
              cancelled: true,
              message: `Sync cancelled after processing ${created + updated} contacts (${created} created, ${updated} updated)`,
              synced: created + updated,
              created,
              updated,
              errors,
              total: i,
              syncType,
            });
          }
        } catch (checkError) {
          // Ignore cancellation check errors - continue syncing
        }
      }
      
      // Update progress every 10 contacts
      if (i % 10 === 0 || i === contacts.length - 1) {
        await updateSyncProgress(i + 1, totalContactsToSync, 'syncing');
      }
      
      try {
        // With the new Search API, contacts already include custom fields
        // We may still want to fetch individual contact for detailed information
        let fullContact = contact;
        
        // Optionally fetch full contact details if needed (removes the extra API call)
        // For now, we'll use the contact data from search results which includes custom fields
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
          // Use the contact data from search results
        }

        // Small delay to avoid rate limiting (50ms between requests)
        await new Promise(resolve => setTimeout(resolve, 50));

        const recordValues = transformGHLContactToRecord(fullContact, fieldMapping, fieldTypesMap);
        // Collect unique values for single_select and multi_select fields
        for (const [fieldKey, fieldId] of Object.entries(fieldMapping)) {
          const newValues = new Set<string>();
          if (!fieldId || typeof fieldId !== 'string') continue;
          const field = fields?.find(f => f.id === fieldId && (f.type === 'single_select' || f.type === 'multi_select'));
          if (!field) continue;
          let selectedValues = recordValues[fieldId];
          if (typeof selectedValues === 'string') {
            selectedValues = selectedValues.split(',').map((val: string) => val.trim());
          }
          if (Array.isArray(selectedValues)) { // if it was a string before, now it's an array
            (selectedValues as string[]).forEach((val: string) => {
              const existingOptions = field.options ? Object.values(field.options) as Array<{ label?: string; name?: string; color?: string }> : [];
              // Check both 'label' and 'name' properties for backward compatibility
              if (!existingOptions.find(option => option.label === val || option.name === val)) {
                newValues.add(val);
              }
            });
          }
          if (newValues.size > 0) {
            const newOptions = { ...(field.options || {}) };
            const colorPalette = ['#1E40AF', '#065F46', '#C2410C', '#B91C1C', '#5B21B6', '#BE185D', '#3730A3', '#374151'];
            let colorIndex = Object.keys(newOptions).length; // Continue from existing options count
            newValues.forEach((val: string) => {
              const color = colorPalette[colorIndex % colorPalette.length];
              // Create option with 'label' and 'color' (standardized format)
              newOptions[`option_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`] = { 
                label: val,
                color: color
              };
              colorIndex++;
            });
            const { error: optUpdateError } = await supabaseAdmin
              .from('fields')
              .update({ options: newOptions })
              .eq('id', field.id);
            if (optUpdateError) {
              console.warn(`Failed to add missing option to field ${field.name} (${field.id})`, optUpdateError);
            } else {
              // Update the field object in the array to reflect the new options
              const fieldIndex = fields?.findIndex(f => f.id === field.id);
              if (fieldIndex !== undefined && fieldIndex !== -1 && fields) {
                fields[fieldIndex] = { ...field, options: newOptions };
              }
            }
          }
        }
        
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
          const recordId = existingRecords[0].id;
          const { error: updateError } = await supabaseAdmin
            .from('records')
            .update({ values: recordValues })
            .eq('id', recordId);

          if (updateError) {
            console.error('Update error:', updateError);
            errors++;
          } else {
            updated++;
            // Log record update at record level for audit trail
            if (baseData?.workspace_id) {
              await logAuditEvent({
                actorId: null, // GHL sync is system-initiated
                action: 'update',
                entityType: 'record',
                entityId: recordId,
                scopeType: 'workspace',
                scopeId: baseData.workspace_id,
                metadata: {
                  source: 'ghl',
                  ghl_contact_id: contact.id,
                  contact_name: fullContact.name || fullContact.contactName || `${fullContact.firstName || ''} ${fullContact.lastName || ''}`.trim(),
                },
              });
            }
          }
        } else {
          // Create new record
          const { data: newRecord, error: createError } = await supabaseAdmin
            .from('records')
            .insert({
              table_id: masterTable.id,
              values: recordValues,
            })
            .select('id')
            .single();

          if (createError) {
            console.error('Create error:', createError);
            errors++;
          } else {
            created++;
            // Log record creation at record level for audit trail
            if (baseData?.workspace_id && newRecord) {
              await logAuditEvent({
                actorId: null, // GHL sync is system-initiated
                action: 'create',
                entityType: 'record',
                entityId: newRecord.id,
                scopeType: 'workspace',
                scopeId: baseData.workspace_id,
                metadata: {
                  source: 'ghl',
                  ghl_contact_id: contact.id,
                  contact_name: fullContact.name || fullContact.contactName || `${fullContact.firstName || ''} ${fullContact.lastName || ''}`.trim(),
                },
              });
            }
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

    // Try to get current user from auth header
    let actorId: string | null = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: userData } = await supabaseAdmin.auth.getUser(token);
      actorId = userData.user?.id ?? null;
    }

    // Log GHL import to audit log
    if (baseData?.workspace_id) {
      await logAuditEvent({
        actorId,
        action: 'import',
        entityType: 'base',
        entityId: baseId,
        scopeType: 'workspace',
        scopeId: baseData.workspace_id,
        metadata: {
          source: 'ghl',
          base_name: baseData.name,
          contacts_synced: created + updated,
          contacts_created: created,
          contacts_updated: updated,
          errors,
          sync_type: syncType,
        },
      });
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
