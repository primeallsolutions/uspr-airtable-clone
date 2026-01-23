-- Migration: Add extended field types (long_text, monetary, radio_select)
-- Date: 2025-12-12
-- Description: Updates the fields table check constraint to support additional field types
--              for Go High Level integration: long_text (multi-line/text box list), 
--              monetary (currency), and radio_select (radio button selection)

-- Drop the existing check constraint
ALTER TABLE public.fields DROP CONSTRAINT IF EXISTS fields_type_check;

-- Recreate the constraint with all supported field types
ALTER TABLE public.fields ADD CONSTRAINT fields_type_check 
  CHECK (type = ANY (ARRAY[
    'text',              -- Single Line text
    'long_text',         -- Multi Line text / Text Box List
    'number',            -- Numeric values
    'monetary',          -- Currency/money values
    'date',              -- Date only
    'datetime',           -- Date and time
    'email',             -- Email addresses
    'phone',             -- Phone numbers
    'single_select',     -- Dropdown (Single)
    'multi_select',      -- Dropdown (Multiple)
    'radio_select',      -- Radio button selection
    'checkbox',          -- Boolean true/false
    'link'               -- URL links
  ]));

