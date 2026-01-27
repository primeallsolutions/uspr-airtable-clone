-- Add e-signature configuration to template_fields
-- This allows signature fields in templates to specify who should sign them

alter table public.template_fields
add column if not exists requires_esignature boolean not null default false,
add column if not exists esignature_signer_email text,
add column if not exists esignature_signer_name text,
add column if not exists esignature_signer_role text default 'signer' check (esignature_signer_role in ('signer', 'viewer', 'approver')),
add column if not exists esignature_sign_order integer default 0;

-- Add comment for documentation
comment on column public.template_fields.requires_esignature is 'If true, this field requires e-signature and will trigger signature request creation when document is generated';
comment on column public.template_fields.esignature_signer_email is 'Email address of the person who should sign this field';
comment on column public.template_fields.esignature_signer_name is 'Name of the person who should sign this field';
comment on column public.template_fields.esignature_signer_role is 'Role of the signer: signer, viewer, or approver';
comment on column public.template_fields.esignature_sign_order is 'Order in which this signer should sign (0 = parallel, >0 = sequential)';

-- Create index for finding fields that require e-signature
create index if not exists idx_template_fields_requires_esignature 
  on public.template_fields(template_id, requires_esignature) 
  where requires_esignature = true;




