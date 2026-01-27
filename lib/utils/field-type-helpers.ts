import type { FieldType } from '@/lib/types/base-detail';

/**
 * Maps field types to their human-readable display names
 */
export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  // Text Input Types
  text: 'Text (Single Line)',
  long_text: 'Long Text (Multi Line)',
  // Numeric Types
  number: 'Number',
  monetary: 'Monetary',
  // Date/Time Types
  date: 'Date',
  datetime: 'Date Time',
  // Contact Types
  email: 'Email',
  phone: 'Phone',
  // Selection Types
  single_select: 'Dropdown (Single)',
  multi_select: 'Dropdown (Multiple)',
  radio_select: 'Radio Select',
  checkbox: 'Checkbox',
  // Other Types
  link: 'Link'
};

/**
 * Gets the display label for a field type
 * @param type - The field type
 * @returns The human-readable label
 */
export function getFieldTypeLabel(type: FieldType): string {
  return FIELD_TYPE_LABELS[type] || type;
}
