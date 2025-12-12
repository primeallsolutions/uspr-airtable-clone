-- Roll back document storage artifacts so we can redo cleanly

-- 1) Drop policies on documents bucket (if any)
drop policy if exists "documents bucket authenticated read open" on storage.objects;
drop policy if exists "documents bucket authenticated insert open" on storage.objects;
drop policy if exists "documents bucket authenticated update open" on storage.objects;
drop policy if exists "documents bucket authenticated delete open" on storage.objects;
drop policy if exists "documents bucket authenticated read" on storage.objects;
drop policy if exists "documents bucket authenticated insert" on storage.objects;

-- 2) Remove the documents bucket (and its objects) if present
do $$
begin
  if exists (select 1 from storage.buckets where id = 'documents') then
    -- Purge objects first to allow bucket drop
    delete from storage.objects where bucket_id = 'documents';
    delete from storage.buckets where id = 'documents';
  end if;
end$$;

-- 3) Drop document_folders table if present
drop table if exists public.document_folders cascade;

