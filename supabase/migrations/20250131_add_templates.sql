-- Create templates table for template management system
CREATE TABLE public.templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  description text,
  category text NOT NULL, -- 'crm', 'project_management', 'inventory', 'event_planning', 'content_calendar', 'custom', etc.
  icon text, -- Icon identifier for UI (lucide-react icon names)
  is_global boolean NOT NULL DEFAULT false, -- Global templates visible to all users
  created_by uuid REFERENCES public.profiles(id), -- NULL for system templates
  template_data jsonb NOT NULL, -- Stores ExportedBase structure
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for better query performance
CREATE INDEX idx_templates_is_global ON public.templates(is_global);
CREATE INDEX idx_templates_created_by ON public.templates(created_by);
CREATE INDEX idx_templates_category ON public.templates(category);

-- Enable Row Level Security
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Global templates are viewable by everyone (authenticated users)
CREATE POLICY "Global templates are viewable by everyone" 
  ON public.templates FOR SELECT 
  USING (is_global = true);

-- Users can view their own templates
CREATE POLICY "Users can view their own templates" 
  ON public.templates FOR SELECT 
  USING (created_by = auth.uid());

-- Users can create their own templates (non-global only)
CREATE POLICY "Users can create their own templates" 
  ON public.templates FOR INSERT 
  WITH CHECK (created_by = auth.uid() AND is_global = false);

-- Users can update their own templates
CREATE POLICY "Users can update their own templates" 
  ON public.templates FOR UPDATE 
  USING (created_by = auth.uid());

-- Users can delete their own templates
CREATE POLICY "Users can delete their own templates" 
  ON public.templates FOR DELETE 
  USING (created_by = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE public.templates IS 'Stores template definitions for creating bases from pre-built or custom templates';
COMMENT ON COLUMN public.templates.template_data IS 'JSON structure matching ExportedBase format from base-export-service';
COMMENT ON COLUMN public.templates.is_global IS 'System templates visible to all users. Only admins can create global templates.';

