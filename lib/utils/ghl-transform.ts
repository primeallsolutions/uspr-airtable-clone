import type { GHLContact, GHLFieldMapping } from '../types/ghl-integration';

// Standard GHL fields that exist directly on the contact object
const STANDARD_GHL_FIELDS = [
  'name', 'firstName', 'lastName', 'email', 'phone',
  'address1', 'city', 'state', 'postalCode', 'country',
  'companyName', 'website', 'tags', 'source', 'dateOfBirth', 
  'assignedTo', 'timezone', 'dnd'
];

/**
 * Extract text value from GHL custom field value
 * Handles three GHL text input types:
 * 1. Single Line - Simple string: "Hello World"
 * 2. Multi Line - String with newlines: "Line 1\nLine 2\nLine 3"
 * 3. Text Box List - Array format: ["Item 1", "Item 2"] or [{value: "Item 1"}, {value: "Item 2"}]
 */
function extractTextValue(value: unknown): string | null {
  // Handle null/undefined
  if (value === null || value === undefined) return null;
  
  // Direct string (Single Line or Multi Line)
  if (typeof value === 'string') return value;
  
  // Array format (Text Box List)
  if (Array.isArray(value)) {
    const extractedItems = value
      .map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'value' in item) {
          const itemValue = (item as any).value;
          // Recursively handle nested arrays or objects
          if (Array.isArray(itemValue)) {
            return itemValue
              .map(subItem => typeof subItem === 'string' ? subItem : String(subItem))
              .filter(Boolean)
              .join(', ');
          }
          return typeof itemValue === 'string' ? itemValue : String(itemValue);
        }
        return String(item);
      })
      .filter(Boolean);
    
    // Join with newlines to preserve list structure
    return extractedItems.length > 0 ? extractedItems.join('\n') : null;
  }
  
  // Object with value property (recursive extraction)
  if (typeof value === 'object' && value !== null) {
    if ('value' in value) {
      return extractTextValue((value as any).value);
    }
    if ('field_value' in value) {
      return extractTextValue((value as any).field_value);
    }
    // If object doesn't have value/field_value, try to stringify meaningful properties
    if (Object.keys(value).length > 0) {
      // Check if it's an object with id and value (common GHL format)
      if ('id' in value && 'value' in value) {
        return extractTextValue((value as any).value);
      }
    }
  }
  
  return null;
}

/**
 * Get custom field value from GHL contact
 * GHL can store custom fields in multiple ways:
 * 1. contact.customFields object with field ID as key
 * 2. contact.customField array with { id, field_value } objects
 * 3. Directly on the contact with field ID as key
 */
function getCustomFieldValue(contact: any, fieldKey: string): unknown {
  // Method 1: Check customFields object (most common)
  if (contact.customFields && typeof contact.customFields === 'object') {
    if (contact.customFields[fieldKey] !== undefined) {
      return contact.customFields[fieldKey];
    }
  }

  // Method 2: Check customField array (alternative format)
  if (Array.isArray(contact.customField)) {
    const field = contact.customField.find(
      (cf: any) => cf.id === fieldKey || cf.key === fieldKey || cf.fieldKey === fieldKey
    );
    if (field) {
      return field.value || field.field_value || field.fieldValue;
    }
  }

  // Method 3: Check direct property on contact
  if (contact[fieldKey] !== undefined) {
    return contact[fieldKey];
  }

  // Method 4: Check additionalInfo
  if (contact.additionalInfo && contact.additionalInfo[fieldKey] !== undefined) {
    return contact.additionalInfo[fieldKey];
  }

  return null;
}

/**
 * Transform GHL contact to app record values
 */
export function transformGHLContactToRecord(
  contact: GHLContact,
  fieldMapping: GHLFieldMapping
): Record<string, unknown> {
  const recordValues: Record<string, unknown> = {};

  // Always store GHL contact ID for deduplication
  recordValues['ghl_contact_id'] = contact.id;

  // Process each field mapping
  Object.entries(fieldMapping).forEach(([ghlFieldKey, appFieldId]) => {
    if (!appFieldId) return;

    let value: unknown = null;

    // Check if this is a standard field
    const isStandardField = STANDARD_GHL_FIELDS.includes(ghlFieldKey);

    if (isStandardField) {
      // Handle standard fields
      switch (ghlFieldKey) {
        case 'name':
          // Combine firstName and lastName
          const nameParts: string[] = [];
          if (contact.firstName) nameParts.push(contact.firstName);
          if (contact.lastName) nameParts.push(contact.lastName);
          value = nameParts.length > 0 ? nameParts.join(' ').trim() : (contact.name || '');
          break;

        case 'firstName':
          value = contact.firstName || '';
          break;

        case 'lastName':
          value = contact.lastName || '';
          break;

        case 'email':
          value = contact.email || '';
          break;

        case 'phone':
          value = contact.phone || '';
          break;

        case 'address1':
          value = contact.address1 || '';
          break;

        case 'city':
          value = contact.city || '';
          break;

        case 'state':
          value = contact.state || '';
          break;

        case 'postalCode':
          value = contact.postalCode || '';
          break;

        case 'country':
          value = contact.country || '';
          break;

        case 'companyName':
          value = contact.companyName || '';
          break;

        case 'website':
          value = contact.website || '';
          break;

        case 'tags':
          if (Array.isArray(contact.tags)) {
            value = contact.tags.join(', ');
          } else {
            value = contact.tags || '';
          }
          break;

        case 'source':
          value = contact.source || '';
          break;

        case 'dateOfBirth':
          value = (contact as any).dateOfBirth || '';
          break;

        case 'assignedTo':
          value = contact.assignedTo || '';
          break;

        case 'timezone':
          value = (contact as any).timezone || '';
          break;

        case 'dnd':
          value = (contact as any).dnd || false;
          break;

        default:
          value = (contact as any)[ghlFieldKey] || '';
      }
    } else {
      // This is a custom field - try multiple methods to find the value
      value = getCustomFieldValue(contact, ghlFieldKey);
    }

    // For custom fields, extract text values properly (handles Single Line, Multi Line, Text Box List)
    if (!isStandardField && value !== null && value !== undefined) {
      // Use extractTextValue to handle all GHL text field types
      const extractedText = extractTextValue(value);
      if (extractedText !== null) {
        value = extractedText;
      } else {
        // If extraction returns null, fall back to original handling for non-text types
        // Handle GHL custom field objects with {id, value} structure
        if (typeof value === 'object' && !Array.isArray(value)) {
          // Check if this is a GHL custom field object with id and value
          if ('value' in value) {
            value = (value as any).value;
          } else if ('field_value' in value) {
            value = (value as any).field_value;
          }
        }

        // Handle array values (convert to comma-separated string for non-text arrays)
        if (Array.isArray(value)) {
          value = value.join(', ');
        }

        // Handle remaining object values (stringify as last resort)
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
          value = JSON.stringify(value);
        }
      }
    } else {
      // For standard fields, handle special cases
      // Handle GHL custom field objects with {id, value} structure
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        // Check if this is a GHL custom field object with id and value
        if ('value' in value) {
          value = (value as any).value;
        } else if ('field_value' in value) {
          value = (value as any).field_value;
        }
      }

      // Handle array values (convert to comma-separated string)
      if (Array.isArray(value)) {
        value = value.join(', ');
      }

      // Handle remaining object values (stringify as last resort)
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        value = JSON.stringify(value);
      }
    }

    // Only set if we have a value
    if (value !== null && value !== undefined && value !== '') {
      recordValues[appFieldId] = value;
    }
  });

  return recordValues;
}

/**
 * Create default field mapping based on existing fields in the base
 */
export function createDefaultFieldMapping(
  fieldIds: { name?: string; email?: string; phone?: string }
): GHLFieldMapping {
  return {
    name: fieldIds.name,
    email: fieldIds.email,
    phone: fieldIds.phone,
  };
}
