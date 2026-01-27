-- Create document_templates table for storing PDF templates
create table if not exists public.document_templates (
  id uuid primary key default uuid_generate_v4(),
  base_id uuid not null references public.bases(id) on delete cascade,
  table_id uuid references public.tables(id) on delete cascade,
  name text not null,
  description text,
  template_file_path text not null, -- Path in storage bucket
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- Create template_fields table for defining fillable fields
create table if not exists public.template_fields (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid not null references public.document_templates(id) on delete cascade,
  field_name text not null, -- Display name for the field (e.g., "Buyer Name")
  field_key text not null, -- Key used in generation (e.g., "buyer_name")
  field_type text not null default 'text' check (field_type in ('text', 'number', 'date', 'checkbox', 'signature')),
  page_number integer not null default 1, -- Which page the field is on
  x_position numeric not null, -- X coordinate in PDF points (72 points = 1 inch)
  y_position numeric not null, -- Y coordinate in PDF points
  width numeric, -- Field width in points
  height numeric, -- Field height in points
  font_size numeric default 12, -- Font size for text fields
  font_name text default 'Helvetica', -- Font name
  is_required boolean not null default false,
  default_value text,
  order_index integer not null default 0,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (template_id, field_key)
);

-- Enable RLS
alter table public.document_templates enable row level security;
alter table public.template_fields enable row level security;

-- RLS Policies for document_templates
-- Users can view templates for bases they have access to
create policy "Users can view templates for accessible bases"
  on public.document_templates
  for select
  using (
    exists (
      select 1 from public.bases
      where bases.id = document_templates.base_id
      and bases.owner = auth.uid()
    )
  );

-- Users can create templates for bases they own
create policy "Users can create templates for own bases"
  on public.document_templates
  for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.bases
      where bases.id = document_templates.base_id
      and bases.owner = auth.uid()
    )
  );

-- Users can update templates for bases they own
create policy "Users can update templates for own bases"
  on public.document_templates
  for update
  using (
    exists (
      select 1 from public.bases
      where bases.id = document_templates.base_id
      and bases.owner = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.bases
      where bases.id = document_templates.base_id
      and bases.owner = auth.uid()
    )
  );

-- Users can delete templates for bases they own
create policy "Users can delete templates for own bases"
  on public.document_templates
  for delete
  using (
    exists (
      select 1 from public.bases
      where bases.id = document_templates.base_id
      and bases.owner = auth.uid()
    )
  );

-- RLS Policies for template_fields
-- Users can view fields for templates they can access
create policy "Users can view fields for accessible templates"
  on public.template_fields
  for select
  using (
    exists (
      select 1 from public.document_templates
      join public.bases on bases.id = document_templates.base_id
      where document_templates.id = template_fields.template_id
      and bases.owner = auth.uid()
    )
  );

-- Users can create fields for templates they own
create policy "Users can create fields for own templates"
  on public.template_fields
  for insert
  with check (
    exists (
      select 1 from public.document_templates
      join public.bases on bases.id = document_templates.base_id
      where document_templates.id = template_fields.template_id
      and bases.owner = auth.uid()
    )
  );

-- Users can update fields for templates they own
create policy "Users can update fields for own templates"
  on public.template_fields
  for update
  using (
    exists (
      select 1 from public.document_templates
      join public.bases on bases.id = document_templates.base_id
      where document_templates.id = template_fields.template_id
      and bases.owner = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.document_templates
      join public.bases on bases.id = document_templates.base_id
      where document_templates.id = template_fields.template_id
      and bases.owner = auth.uid()
    )
  );

-- Users can delete fields for templates they own
create policy "Users can delete fields for own templates"
  on public.template_fields
  for delete
  using (
    exists (
      select 1 from public.document_templates
      join public.bases on bases.id = document_templates.base_id
      where document_templates.id = template_fields.template_id
      and bases.owner = auth.uid()
    )
  );

-- Create index for faster lookups
create index if not exists idx_document_templates_base_id on public.document_templates(base_id);
create index if not exists idx_document_templates_table_id on public.document_templates(table_id);
create index if not exists idx_template_fields_template_id on public.template_fields(template_id);
create index if not exists idx_template_fields_order on public.template_fields(template_id, order_index);

