-- Fix RLS policy for template creation to ensure authenticated users can create templates
-- The policy already checks base ownership, but we'll ensure it's explicit

drop policy if exists "Users can create templates for own bases" on public.document_templates;

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





















