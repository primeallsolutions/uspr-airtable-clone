-- Add Status Column Update feature for signature requests
-- This allows signature requests to update a specific field in a record when signing is completed

-- Add columns to signature_requests for status update capability
ALTER TABLE public.signature_requests 
ADD COLUMN IF NOT EXISTS record_id uuid REFERENCES public.records(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status_field_id uuid REFERENCES public.fields(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status_value_on_complete text DEFAULT 'Signed',
ADD COLUMN IF NOT EXISTS status_value_on_decline text DEFAULT 'Declined';

-- Add comments for documentation
COMMENT ON COLUMN public.signature_requests.record_id IS 'Optional record ID to update when signature request is completed';
COMMENT ON COLUMN public.signature_requests.status_field_id IS 'Field ID to update with signature status (should be single_select or text field)';
COMMENT ON COLUMN public.signature_requests.status_value_on_complete IS 'Value to set when all signers complete (default: Signed)';
COMMENT ON COLUMN public.signature_requests.status_value_on_decline IS 'Value to set when signature is declined (default: Declined)';

-- Create index for faster lookup of signature requests by record
CREATE INDEX IF NOT EXISTS idx_signature_requests_record_id 
  ON public.signature_requests(record_id) 
  WHERE record_id IS NOT NULL;

-- Create index for status update lookups
CREATE INDEX IF NOT EXISTS idx_signature_requests_status_update
  ON public.signature_requests(record_id, status_field_id)
  WHERE record_id IS NOT NULL AND status_field_id IS NOT NULL;
