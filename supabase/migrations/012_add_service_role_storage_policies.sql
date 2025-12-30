-- Add storage policies to allow service role (admin client) to upload files
-- This is needed for API routes that use SUPABASE_SERVICE_ROLE_KEY

-- Service role can insert files (for API route uploads)
create policy "Service role can insert documents"
on storage.objects
for insert
with check (
  bucket_id = 'documents'
  and auth.role() = 'service_role'
);

-- Service role can read files
create policy "Service role can read documents"
on storage.objects
for select
using (
  bucket_id = 'documents'
  and auth.role() = 'service_role'
);

-- Service role can update files
create policy "Service role can update documents"
on storage.objects
for update
using (
  bucket_id = 'documents'
  and auth.role() = 'service_role'
)
with check (
  bucket_id = 'documents'
  and auth.role() = 'service_role'
);

-- Service role can delete files
create policy "Service role can delete documents"
on storage.objects
for delete
using (
  bucket_id = 'documents'
  and auth.role() = 'service_role'
);





















