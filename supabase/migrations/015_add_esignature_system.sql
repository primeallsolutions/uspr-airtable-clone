-- E-Signature System Schema
-- This migration creates the database structure for the e-signature workflow system

-- Create signature_requests table
create table if not exists public.signature_requests (
  id uuid primary key default uuid_generate_v4(),
  base_id uuid not null references public.bases(id) on delete cascade,
  table_id uuid references public.tables(id) on delete cascade,
  title text not null,
  message text, -- Optional message to signers
  document_path text not null, -- Path to the document to be signed
  status text not null default 'draft' check (status in ('draft', 'sent', 'in_progress', 'completed', 'declined', 'cancelled')),
  completion_certificate_path text, -- Path to completion certificate PDF
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  completed_at timestamp with time zone, -- When all signers completed
  expires_at timestamp with time zone -- Optional expiration date
);

-- Create signature_request_signers table
create table if not exists public.signature_request_signers (
  id uuid primary key default uuid_generate_v4(),
  signature_request_id uuid not null references public.signature_requests(id) on delete cascade,
  email text not null,
  name text, -- Optional name for the signer
  role text not null default 'signer' check (role in ('signer', 'viewer', 'approver')),
  sign_order integer not null default 0, -- Order in which they should sign (0 = parallel, >0 = sequential)
  status text not null default 'pending' check (status in ('pending', 'sent', 'viewed', 'signed', 'declined')),
  signed_at timestamp with time zone,
  viewed_at timestamp with time zone,
  declined_at timestamp with time zone,
  decline_reason text,
  access_token text, -- Unique token for accessing the signing page
  signed_document_path text, -- Path to signed document version for this signer
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (signature_request_id, email)
);

-- Create signature_fields table (defines where signatures go on documents)
create table if not exists public.signature_fields (
  id uuid primary key default uuid_generate_v4(),
  signature_request_id uuid not null references public.signature_requests(id) on delete cascade,
  signer_id uuid not null references public.signature_request_signers(id) on delete cascade,
  page_number integer not null default 1,
  x_position numeric not null, -- X coordinate in PDF points
  y_position numeric not null, -- Y coordinate in PDF points
  width numeric default 150, -- Signature field width
  height numeric default 50, -- Signature field height
  field_type text not null default 'signature' check (field_type in ('signature', 'initial', 'date', 'text')),
  label text, -- Optional label for the field
  is_required boolean not null default true,
  created_at timestamp with time zone not null default now()
);

-- Create signature_versions table for version history
create table if not exists public.signature_versions (
  id uuid primary key default uuid_generate_v4(),
  signature_request_id uuid not null references public.signature_requests(id) on delete cascade,
  version_number integer not null,
  document_path text not null, -- Path to this version of the document
  created_by uuid references public.profiles(id),
  change_description text, -- Description of what changed in this version
  created_at timestamp with time zone not null default now(),
  unique (signature_request_id, version_number)
);

-- Create signature_request_pack_items table for Merge/Pack feature
create table if not exists public.signature_request_pack_items (
  id uuid primary key default uuid_generate_v4(),
  pack_request_id uuid not null references public.signature_requests(id) on delete cascade,
  document_path text not null, -- Path to document in the pack
  document_title text not null,
  document_order integer not null default 0, -- Order in pack
  created_at timestamp with time zone not null default now()
);

-- Add indexes for performance
create index if not exists idx_signature_requests_base_id on public.signature_requests(base_id);
create index if not exists idx_signature_requests_table_id on public.signature_requests(table_id);
create index if not exists idx_signature_requests_status on public.signature_requests(status);
create index if not exists idx_signature_requests_created_by on public.signature_requests(created_by);
create index if not exists idx_signature_request_signers_request_id on public.signature_request_signers(signature_request_id);
create index if not exists idx_signature_request_signers_email on public.signature_request_signers(email);
create index if not exists idx_signature_request_signers_status on public.signature_request_signers(status);
create index if not exists idx_signature_request_signers_access_token on public.signature_request_signers(access_token);
create index if not exists idx_signature_fields_request_id on public.signature_fields(signature_request_id);
create index if not exists idx_signature_fields_signer_id on public.signature_fields(signer_id);
create index if not exists idx_signature_versions_request_id on public.signature_versions(signature_request_id);
create index if not exists idx_signature_request_pack_items_pack_id on public.signature_request_pack_items(pack_request_id);

-- Enable RLS
alter table public.signature_requests enable row level security;
alter table public.signature_request_signers enable row level security;
alter table public.signature_fields enable row level security;
alter table public.signature_versions enable row level security;
alter table public.signature_request_pack_items enable row level security;

-- RLS Policies for signature_requests
-- Users can view requests for bases they have access to
create policy "Users can view signature requests for accessible bases"
  on public.signature_requests
  for select
  using (
    exists (
      select 1 from public.bases
      where bases.id = signature_requests.base_id
      and bases.owner = auth.uid()
    )
  );

-- Users can create requests for bases they own
create policy "Users can create signature requests for own bases"
  on public.signature_requests
  for insert
  with check (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.bases
      where bases.id = signature_requests.base_id
      and bases.owner = auth.uid()
    )
  );

-- Users can update requests for bases they own
create policy "Users can update signature requests for own bases"
  on public.signature_requests
  for update
  using (
    exists (
      select 1 from public.bases
      where bases.id = signature_requests.base_id
      and bases.owner = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.bases
      where bases.id = signature_requests.base_id
      and bases.owner = auth.uid()
    )
  );

-- Users can delete requests for bases they own
create policy "Users can delete signature requests for own bases"
  on public.signature_requests
  for delete
  using (
    exists (
      select 1 from public.bases
      where bases.id = signature_requests.base_id
      and bases.owner = auth.uid()
    )
  );

-- RLS Policies for signature_request_signers
-- Users can view signers for requests they have access to
create policy "Users can view signers for accessible requests"
  on public.signature_request_signers
  for select
  using (
    exists (
      select 1 from public.signature_requests
      join public.bases on bases.id = signature_requests.base_id
      where signature_requests.id = signature_request_signers.signature_request_id
      and (bases.owner = auth.uid() or signature_request_signers.email = (select email from public.profiles where id = auth.uid()))
    )
  );

-- Users can create signers for requests they own
create policy "Users can create signers for own requests"
  on public.signature_request_signers
  for insert
  with check (
    exists (
      select 1 from public.signature_requests
      join public.bases on bases.id = signature_requests.base_id
      where signature_requests.id = signature_request_signers.signature_request_id
      and bases.owner = auth.uid()
    )
  );

-- Signers can update their own status (via access token)
create policy "Signers can update own status"
  on public.signature_request_signers
  for update
  using (
    exists (
      select 1 from public.signature_request_signers srs
      join public.signature_requests sr on sr.id = srs.signature_request_id
      where srs.id = signature_request_signers.id
      and (srs.email = (select email from public.profiles where id = auth.uid()) 
           or exists (select 1 from public.bases where bases.id = sr.base_id and bases.owner = auth.uid()))
    )
  );

-- RLS Policies for signature_fields
-- Users can view fields for requests they have access to
create policy "Users can view signature fields for accessible requests"
  on public.signature_fields
  for select
  using (
    exists (
      select 1 from public.signature_requests
      join public.bases on bases.id = signature_requests.base_id
      where signature_requests.id = signature_fields.signature_request_id
      and (bases.owner = auth.uid() or exists (
        select 1 from public.signature_request_signers
        where signature_request_signers.id = signature_fields.signer_id
        and signature_request_signers.email = (select email from public.profiles where id = auth.uid())
      ))
    )
  );

-- Users can create fields for requests they own
create policy "Users can create signature fields for own requests"
  on public.signature_fields
  for insert
  with check (
    exists (
      select 1 from public.signature_requests
      join public.bases on bases.id = signature_requests.base_id
      where signature_requests.id = signature_fields.signature_request_id
      and bases.owner = auth.uid()
    )
  );

-- RLS Policies for signature_versions
-- Users can view versions for requests they have access to
create policy "Users can view signature versions for accessible requests"
  on public.signature_versions
  for select
  using (
    exists (
      select 1 from public.signature_requests
      join public.bases on bases.id = signature_requests.base_id
      where signature_requests.id = signature_versions.signature_request_id
      and bases.owner = auth.uid()
    )
  );

-- Users can create versions for requests they own
create policy "Users can create signature versions for own requests"
  on public.signature_versions
  for insert
  with check (
    exists (
      select 1 from public.signature_requests
      join public.bases on bases.id = signature_requests.base_id
      where signature_requests.id = signature_versions.signature_request_id
      and bases.owner = auth.uid()
    )
  );

-- RLS Policies for signature_request_pack_items
-- Users can view pack items for requests they have access to
create policy "Users can view pack items for accessible requests"
  on public.signature_request_pack_items
  for select
  using (
    exists (
      select 1 from public.signature_requests
      join public.bases on bases.id = signature_requests.base_id
      where signature_requests.id = signature_request_pack_items.pack_request_id
      and bases.owner = auth.uid()
    )
  );

-- Users can create pack items for requests they own
create policy "Users can create pack items for own requests"
  on public.signature_request_pack_items
  for insert
  with check (
    exists (
      select 1 from public.signature_requests
      join public.bases on bases.id = signature_requests.base_id
      where signature_requests.id = signature_request_pack_items.pack_request_id
      and bases.owner = auth.uid()
    )
  );










