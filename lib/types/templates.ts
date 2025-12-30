import type { ExportedBase } from '../services/base-export-service';

// Template categories
export type TemplateCategory = 
  | 'crm'
  | 'project_management'
  | 'inventory'
  | 'event_planning'
  | 'content_calendar'
  | 'custom';

// Template record from database
export interface Template {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  icon: string | null;
  is_global: boolean;
  created_by: string | null;
  template_data: ExportedBase;
  created_at: string;
  updated_at: string;
}

// Data for creating a new template
export interface CreateTemplateData {
  name: string;
  description?: string;
  category: TemplateCategory;
  icon?: string;
  includeRecords?: boolean;
}

// Data for updating a template
export interface UpdateTemplateData {
  name?: string;
  description?: string | null;
  category?: TemplateCategory;
  icon?: string | null;
}

// Template with additional metadata for UI
export interface TemplateWithMeta extends Template {
  tableCount?: number;
  fieldCount?: number;
  recordCount?: number;
}

// Category metadata for UI
export interface CategoryInfo {
  id: TemplateCategory;
  label: string;
  icon: string; // lucide-react icon name
  description: string;
}

// Template filter options
export interface TemplateFilters {
  category?: TemplateCategory | 'all';
  searchQuery?: string;
  showGlobalOnly?: boolean;
  showUserOnly?: boolean;
}

