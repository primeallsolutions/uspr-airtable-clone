-- Add validation_rules and formatting_options columns to template_fields
alter table public.template_fields
add column if not exists validation_rules jsonb default '[]'::jsonb,
add column if not exists formatting_options jsonb default '{}'::jsonb;

-- Add comment for documentation
comment on column public.template_fields.validation_rules is 'JSON array of validation rules: [{type: "minLength"|"maxLength"|"pattern"|"min"|"max"|"required", value?: string|number, message?: string}]';
comment on column public.template_fields.formatting_options is 'JSON object with formatting options: {textCase?: "uppercase"|"lowercase"|"title", numberFormat?: "currency"|"percentage"|"decimal"|"integer", currencySymbol?: string, decimalPlaces?: number, dateFormat?: string, inputMask?: string}';















