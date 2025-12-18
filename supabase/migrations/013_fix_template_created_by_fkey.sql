-- Fix foreign key constraint for document_templates.created_by
-- Make it nullable and ensure it references profiles correctly

-- Drop the existing foreign key constraint
alter table public.document_templates 
drop constraint if exists document_templates_created_by_fkey;

-- Re-add the foreign key constraint with ON DELETE SET NULL
-- This allows the field to be null if the profile doesn't exist
alter table public.document_templates
add constraint document_templates_created_by_fkey 
foreign key (created_by) 
references public.profiles(id) 
on delete set null;

-- Also ensure the column allows null (it should already, but make sure)
alter table public.document_templates
alter column created_by drop not null;





