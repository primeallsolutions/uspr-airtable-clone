-- Fix foreign key constraint for signature_requests.created_by
-- Make it nullable and ensure it references profiles correctly

-- Drop the existing foreign key constraint
alter table public.signature_requests 
drop constraint if exists signature_requests_created_by_fkey;

-- Re-add the foreign key constraint with ON DELETE SET NULL
-- This allows the field to be null if the profile doesn't exist
alter table public.signature_requests
add constraint signature_requests_created_by_fkey 
foreign key (created_by) 
references public.profiles(id) 
on delete set null;

-- Also ensure the column allows null (it should already, but make sure)
alter table public.signature_requests
alter column created_by drop not null;

-- Also fix signature_versions.created_by (same issue)
alter table public.signature_versions 
drop constraint if exists signature_versions_created_by_fkey;

alter table public.signature_versions
add constraint signature_versions_created_by_fkey 
foreign key (created_by) 
references public.profiles(id) 
on delete set null;

alter table public.signature_versions
alter column created_by drop not null;




