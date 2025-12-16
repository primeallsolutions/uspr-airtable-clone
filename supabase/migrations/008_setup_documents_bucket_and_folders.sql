-- Create documents bucket (private by default) without RLS policies
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Create folders table for metadata (no RLS for now)
create table if not exists public.document_folders (
  id uuid primary key default uuid_generate_v4(),
  base_id uuid not null references public.bases(id) on delete cascade,
  table_id uuid references public.tables(id) on delete cascade,
  name text not null,
  path text not null,
  parent_path text,
  created_by uuid references public.profiles(id),
  created_at timestamp with time zone not null default now(),
  unique (base_id, table_id, path)
);

