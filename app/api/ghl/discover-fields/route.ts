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

// Standard GHL contact fields - these are always available
const GHL_STANDARD_FIELDS: { key: string; name: string; type: string }[] = [
  { key: 'firstName', name: 'firstName', type: 'text' },
  { key: 'lastName', name: 'lastName', type: 'text' },
  { key: 'name', name: 'name', type: 'text' },
  { key: 'email', name: 'email', type: 'email' },
  { key: 'phone', name: 'phone', type: 'phone' },
  { key: 'address1', name: 'address1', type: 'text' },
  { key: 'city', name: 'city', type: 'text' },
  { key: 'state', name: 'state', type: 'text' },
  { key: 'postalCode', name: 'postalCode', type: 'text' },
  { key: 'country', name: 'country', type: 'text' },
  { key: 'companyName', name: 'companyName', type: 'text' },
  { key: 'website', name: 'website', type: 'link' },
  { key: 'tags', name: 'tags', type: 'text' },
  { key: 'source', name: 'source', type: 'text' },
  { key: 'dateOfBirth', name: 'dateOfBirth', type: 'date' },
  { key: 'assignedTo', name: 'assignedTo', type: 'text' },
  { key: 'timezone', name: 'timezone', type: 'text' },
];

/**
 * Map GHL field dataType to app field type
 */
function mapGHLTypeToAppType(ghlType: string): string {
  switch (ghlType?.toLowerCase()) {
    case 'text':
    case 'large_text':
    case 'textarea':
    case 'single_line':
    case 'multi_line':
      return 'text';
    case 'number':
    case 'numerical':
    case 'float':
    case 'integer':
    case 'monetory':
    case 'monetary':
      return 'number';
    case 'date':
      return 'date';
    case 'datetime':
    case 'date_time':
      return 'datetime';
    case 'phone':
    case 'phone_number':
      return 'phone';
    case 'email':
      return 'email';
    case 'checkbox':
    case 'boolean':
      return 'checkbox';
    case 'url':
    case 'link':
    case 'website':
      return 'link';
    case 'dropdown':
    case 'single_select':
    case 'select':
    case 'radio':
      return 'single_select';
    case 'multiple':
    case 'multi_select':
    case 'checkbox_list':
      return 'multi_select';
    default:
      return 'text';
  }
}

/**
 * POST /api/ghl/discover-fields
 * Discover ALL fields from GHL (standard + custom) and auto-create/map them
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseId } = body;

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

    // Collect all fields to create
    const allFields: { key: string; name: string; type: string }[] = [...GHL_STANDARD_FIELDS];

    // Fetch ALL custom fields from GHL Custom Fields API
    try {
      const customFieldsResponse: Response = await fetch(
        `${GHL_API_BASE_URL}/locations/${integration.location_id}/customFields`,
        {
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          },
        }
      );

      if (customFieldsResponse.ok) {
        const customFieldsData = await customFieldsResponse.json();
        const customFields = customFieldsData.customFields || customFieldsData.data || [];

        console.log(`Found ${customFields.length} custom fields from GHL`);

        // Add each custom field
        customFields.forEach((cf: any) => {
          // Use the field's key/id and name from GHL
          const fieldKey = cf.id || cf.key || cf.fieldKey;
          const fieldName = cf.name || cf.label || cf.fieldKey || fieldKey;
          const fieldType = mapGHLTypeToAppType(cf.dataType || cf.type || 'text');

          if (fieldKey && fieldName) {
            allFields.push({
              key: fieldKey,
              name: fieldName, // Use exact name from GHL
              type: fieldType,
            });
          }
        });
      } else {
        console.warn('Could not fetch custom fields:', await customFieldsResponse.text());
      }
    } catch (cfError) {
      console.warn('Error fetching custom fields:', cfError);
      // Continue with standard fields only
    }

    // Also try to get fields from Contact Custom Fields endpoint (different API)
    try {
      const contactCustomFieldsResponse: Response = await fetch(
        `${GHL_API_BASE_URL}/locations/${integration.location_id}/customFields?model=contact`,
        {
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          },
        }
      );

      if (contactCustomFieldsResponse.ok) {
        const data = await contactCustomFieldsResponse.json();
        const contactCustomFields = data.customFields || data.data || [];

        contactCustomFields.forEach((cf: any) => {
          const fieldKey = cf.id || cf.key || cf.fieldKey;
          const fieldName = cf.name || cf.label || fieldKey;
          
          // Only add if not already in list
          if (fieldKey && fieldName && !allFields.some(f => f.key === fieldKey)) {
            allFields.push({
              key: fieldKey,
              name: fieldName,
              type: mapGHLTypeToAppType(cf.dataType || cf.type || 'text'),
            });
          }
        });
      }
    } catch (err) {
      console.warn('Error fetching contact custom fields:', err);
    }

    // Also fetch a sample contact to discover any fields we might have missed
    try {
      const contactsResponse: Response = await fetch(
        `${GHL_API_BASE_URL}/contacts/?locationId=${integration.location_id}&limit=5`,
        {
          headers: {
            'Authorization': `Bearer ${integration.access_token}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json'
          },
        }
      );

      if (contactsResponse.ok) {
        const contactsData = await contactsResponse.json();
        const contacts = contactsData.contacts || [];

        // Collect all keys from sample contacts
        contacts.forEach((contact: any) => {
          Object.keys(contact).forEach(key => {
            // Skip system fields
            if (['id', 'locationId', 'dateAdded', 'dateUpdated', 'customFields'].includes(key)) {
              return;
            }

            // Check if we already have this field
            if (!allFields.some(f => f.key === key)) {
              allFields.push({
                key: key,
                name: key, // Use exact key as name
                type: 'text',
              });
            }
          });

          // Also check customFields object if it exists
          if (contact.customFields && typeof contact.customFields === 'object') {
            Object.keys(contact.customFields).forEach(cfKey => {
              if (!allFields.some(f => f.key === cfKey)) {
                allFields.push({
                  key: cfKey,
                  name: cfKey,
                  type: 'text',
                });
              }
            });
          }
        });
      }
    } catch (contactErr) {
      console.warn('Error fetching sample contacts:', contactErr);
    }

    console.log(`Total fields discovered: ${allFields.length}`);

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

    // Get existing fields
    const { data: existingFields, error: fieldsError } = await supabaseAdmin
      .from('fields')
      .select('id, name, type, order_index')
      .eq('table_id', masterTable.id)
      .order('order_index', { ascending: true });

    if (fieldsError) {
      return NextResponse.json(
        { error: 'Failed to fetch existing fields' },
        { status: 500 }
      );
    }

    // Find max order_index
    let maxOrderIndex = existingFields?.reduce((max, f) => Math.max(max, f.order_index || 0), 0) || 0;

    // Create field mapping and field names lookup
    const fieldMapping: Record<string, string> = {};
    const ghlFieldNames: Record<string, string> = {}; // Maps GHL key to display name
    const createdFields: string[] = [];
    const mappedFields: string[] = [];

    // Process each discovered field
    for (const field of allFields) {
      // Store the GHL field name for display purposes
      ghlFieldNames[field.key] = field.name;

      // Check if field already exists (by name, case-insensitive)
      const existingField = existingFields?.find(
        f => f.name.toLowerCase() === field.name.toLowerCase()
      );

      if (existingField) {
        // Map to existing field
        fieldMapping[field.key] = existingField.id;
        mappedFields.push(field.name);
      } else {
        // Create new field with EXACT same name as GHL
        maxOrderIndex++;
        const { data: newField, error: createError } = await supabaseAdmin
          .from('fields')
          .insert({
            table_id: masterTable.id,
            name: field.name, // Use exact GHL field name
            type: field.type,
            order_index: maxOrderIndex,
            options: {},
          })
          .select('id')
          .single();

        if (createError) {
          console.error(`Failed to create field ${field.name}:`, createError);
          continue;
        }

        if (newField) {
          fieldMapping[field.key] = newField.id;
          createdFields.push(field.name);
        }
      }
    }

    // Update integration with new field mapping AND field names
    const { error: updateError } = await supabaseAdmin
      .from('ghl_integrations')
      .update({
        field_mapping: fieldMapping,
        ghl_field_names: ghlFieldNames,
        updated_at: new Date().toISOString(),
      })
      .eq('id', integration.id);

    if (updateError) {
      console.error('Failed to update field mapping:', updateError);
      return NextResponse.json(
        { error: 'Failed to save field mapping' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Discovered ${allFields.length} fields, mapped ${Object.keys(fieldMapping).length}`,
      createdFields,
      mappedFields,
      totalDiscovered: allFields.length,
      totalMapped: Object.keys(fieldMapping).length,
      fieldMapping,
    });
  } catch (error) {
    console.error('GHL discover fields error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
