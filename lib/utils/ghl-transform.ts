import type { GHLContact, GHLFieldMapping } from '../types/ghl-integration';
import type { FieldType } from '../types/base-detail';

// Standard GHL fields that exist directly on the contact object
const STANDARD_GHL_FIELDS = [
  'name', 'firstName', 'lastName', 'email', 'phone',
  'address1', 'city', 'state', 'postalCode', 'country',
  'companyName', 'website', 'tags', 'source', 'dateOfBirth', 
  'assignedTo', 'timezone', 'dnd'
];

/**
 * Map GHL custom field dataType to app FieldType
 * GHL dataTypes: TEXT, LARGE_TEXT, NUMERICAL, MONETARY, SINGLE_OPTIONS, 
 *                MULTIPLE_OPTIONS, DATE, FILE_UPLOAD, SIGNATURE, TEXTBOX_LIST
 */
export function mapGHLFieldTypeToAppType(ghlDataType: string): FieldType {
  const typeMap: Record<string, FieldType> = {
    // Text types
    'TEXT': 'text',              // Single Line
    'LARGE_TEXT': 'long_text',   // Multi Line
    'TEXTBOX_LIST': 'long_text', // Text Box List (array of text)
    
    // Numeric types
    'NUMERICAL': 'number',
    'MONETARY': 'monetary',
    
    // Selection types
    'SINGLE_OPTIONS': 'single_select',  // Dropdown (Single) or Radio Select
    'MULTIPLE_OPTIONS': 'multi_select', // Dropdown (Multiple) or Checkbox
    'CHECKBOX': 'checkbox',
    'RADIO': 'radio_select',
    
    // Date types
    'DATE': 'date',
    
    // File types (store as link for now)
    'FILE_UPLOAD': 'link',
    'SIGNATURE': 'link',
  };
  
  return typeMap[ghlDataType?.toUpperCase()] || 'text';
}

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
 * Extract monetary value from GHL custom field
 * Returns the numeric value (GHL stores monetary as number or string)
 */
function extractMonetaryValue(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  
  // Direct number
  if (typeof value === 'number') return value;
  
  // String representation of number
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  
  // Object with value property
  if (typeof value === 'object' && value !== null) {
    if ('value' in value) {
      return extractMonetaryValue((value as any).value);
    }
    if ('amount' in value) {
      return extractMonetaryValue((value as any).amount);
    }
  }
  
  return null;
}

/**
 * Extract selection value from GHL custom field
 * Handles SINGLE_OPTIONS and MULTIPLE_OPTIONS
 */
function extractSelectionValue(value: unknown, isMultiple: boolean): string | string[] | null {
  if (value === null || value === undefined) return null;
  
  // Direct string (single option selected)
  if (typeof value === 'string') {
    return isMultiple ? [value] : value;
  }
  
  // Array of selections (multiple options)
  if (Array.isArray(value)) {
    const selections = value
      .map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          // Handle {id, value} or {key, label} formats
          return (item as any).value || (item as any).label || (item as any).id || String(item);
        }
        return String(item);
      })
      .filter(Boolean);
    
    return isMultiple ? selections : (selections[0] || null);
  }
  
  // Object with value property
  if (typeof value === 'object' && value !== null) {
    if ('value' in value) {
      return extractSelectionValue((value as any).value, isMultiple);
    }
  }
  
  return null;
}

/**
 * Extract date value from GHL custom field
 * GHL can return dates in various formats
 */
function extractDateValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  
  if (typeof value === 'string') {
    // Try to parse and return in ISO format
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    }
    return value; // Return as-is if parsing fails
  }
  
  if (typeof value === 'number') {
    // Assume timestamp
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return extractDateValue((value as any).value);
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
  const readFieldEntry = (entry: any): unknown => {
    if (!entry || typeof entry !== 'object') return undefined;

    const targetKey = String(fieldKey);
    const possibleKeys = [
      entry.id,
      entry.key,
      entry.fieldKey,
      entry.customFieldId,
      entry.customField,
      entry.name
    ]
      .filter((key) => key !== undefined && key !== null)
      .map((key) => String(key));

    if (possibleKeys.includes(targetKey)) {
      if ('value' in entry) return (entry as any).value;
      if ('field_value' in entry) return (entry as any).field_value;
      if ('fieldValue' in entry) return (entry as any).fieldValue;
      if ('values' in entry) return (entry as any).values;
    }

    return undefined;
  };

  // Method 0: customFields as an array of {id,value} objects (common GHL shape)
  if (Array.isArray(contact.customFields)) {
    for (const cf of contact.customFields) {
      const match = readFieldEntry(cf);
      if (match !== undefined) {
        return match;
      }
    }
  }

  // Method 1: Check customFields object (most common)
  if (contact.customFields && typeof contact.customFields === 'object') {
    if (contact.customFields[fieldKey] !== undefined) {
      const raw = contact.customFields[fieldKey];
      if (raw && typeof raw === 'object') {
        if ('value' in raw) return raw.value;
        if ('field_value' in raw) return raw.field_value;
        if ('fieldValue' in raw) return raw.fieldValue;
      }
      return raw;
    }
  }

  // Method 2: Check customField array (alternative format)
  if (Array.isArray(contact.customField)) {
    for (const cf of contact.customField) {
      const match = readFieldEntry(cf);
      if (match !== undefined) {
        return match;
      }
    }
  }
  // Method 2b: customField provided as single object
  if (contact.customField && typeof contact.customField === 'object' && !Array.isArray(contact.customField)) {
    const match = readFieldEntry(contact.customField);
    if (match !== undefined) {
      return match;
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
 * @param fieldTypes Map of app field ID to field type (optional, for better value extraction)
 */
export function transformGHLContactToRecord(
  contact: GHLContact,
  fieldMapping: GHLFieldMapping,
  fieldTypes?: Record<string, FieldType>
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

    // Get the app field type if available (before processing)
    const appFieldType = fieldTypes?.[appFieldId];

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

    // Extract and transform value based on field type
    if (!isStandardField && value !== null && value !== undefined) {
      // Extract value based on the app field type
      if (appFieldType === 'long_text' || appFieldType === 'text') {
        // For text fields, use extractTextValue to handle Single Line, Multi Line, Text Box List
        const extractedText = extractTextValue(value);
        if (extractedText !== null) {
          value = extractedText;
        }
      } else if (appFieldType === 'monetary') {
        // For monetary fields, extract numeric value
        const extractedMonetary = extractMonetaryValue(value);
        if (extractedMonetary !== null) {
          value = extractedMonetary;
        }
      } else if (appFieldType === 'single_select' || appFieldType === 'radio_select') {
        // For single select fields
        const extractedSelection = extractSelectionValue(value, false);
        if (extractedSelection !== null) {
          value = extractedSelection;
        }
      } else if (appFieldType === 'multi_select') {
        // For multi-select fields
        const extractedSelection = extractSelectionValue(value, true);
        if (extractedSelection !== null) {
          value = extractedSelection;
        }
      } else if (appFieldType === 'checkbox') {
        // For checkbox fields - extract boolean
        if (typeof value === 'boolean') {
          value = value;
        } else if (typeof value === 'string') {
          value = value === 'true' || value === '1' || value.toLowerCase() === 'yes';
        } else if (typeof value === 'number') {
          value = value !== 0;
        } else if (value && typeof value === 'object' && 'value' in value) {
          const val = (value as any).value;
          value = typeof val === 'boolean' ? val : (val === 'true' || val === '1');
        } else {
          value = Boolean(value);
        }
      } else if (appFieldType === 'date' || appFieldType === 'datetime') {
        // For date fields
        const extractedDate = extractDateValue(value);
        if (extractedDate !== null) {
          value = extractedDate;
        }
      } else if (appFieldType === 'number') {
        // For number fields
        if (typeof value === 'number') {
          value = value;
        } else if (typeof value === 'string') {
          const num = parseFloat(value);
          value = isNaN(num) ? null : num;
        } else if (value && typeof value === 'object' && 'value' in value) {
          const val = (value as any).value;
          const num = typeof val === 'number' ? val : parseFloat(String(val));
          value = isNaN(num) ? null : num;
        }
      } else {
        // Fallback: try extractTextValue for unknown types
        const extractedText = extractTextValue(value);
        if (extractedText !== null) {
          value = extractedText;
        } else {
          // Handle GHL custom field objects with {id, value} structure
          if (typeof value === 'object' && !Array.isArray(value)) {
            if ('value' in value) {
              value = (value as any).value;
            } else if ('field_value' in value) {
              value = (value as any).field_value;
            }
          }

          // Handle array values
          if (Array.isArray(value)) {
            value = value.join(', ');
          }

          // Handle remaining object values (stringify as last resort)
          if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            value = JSON.stringify(value);
          }
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

    // Set the value if it's not null or undefined
    // Allow false for checkboxes, 0 for numbers, empty arrays for multi-select, etc.
    // Only skip empty strings for text fields to avoid cluttering the data
    if (value !== null && value !== undefined) {
      // For text/long_text fields, skip empty strings
      if ((appFieldType === 'text' || appFieldType === 'long_text') && value === '') {
        // Skip empty text - don't add to recordValues
      } else {
        // For all other types, include the value (false, 0, empty arrays are valid)
        recordValues[appFieldId] = value;
      }
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
