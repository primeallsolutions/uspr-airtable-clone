-- Re-add permissive policies for the documents bucket (authenticated users)

drop policy if exists "documents bucket authenticated read open" on storage.objects;
drop policy if exists "documents bucket authenticated insert open" on storage.objects;
drop policy if exists "documents bucket authenticated update open" on storage.objects;
drop policy if exists "documents bucket authenticated delete open" on storage.objects;

create policy "documents bucket authenticated read open"
on storage.objects
for select
using (
  bucket_id = 'documents'
  and auth.role() = 'authenticated'
);

create policy "documents bucket authenticated insert open"
on storage.objects
for insert
with check (
  bucket_id = 'documents'
  and auth.role() = 'authenticated'
);

create policy "documents bucket authenticated update open"
on storage.objects
for update
using (
  bucket_id = 'documents'
  and auth.role() = 'authenticated'
)
with check (
  bucket_id = 'documents'
  and auth.role() = 'authenticated'
);

create policy "documents bucket authenticated delete open"
on storage.objects
for delete
using (
  bucket_id = 'documents'
  and auth.role() = 'authenticated'
);

