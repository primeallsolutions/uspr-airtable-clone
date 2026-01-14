// Integration Types for Multi-Integration Support

export type IntegrationType = 'ghl' | 'zapier' | 'make' | 'salesforce' | 'hubspot' | 'webhook';

export interface Integration {
  id: IntegrationType;
  name: string;
  description: string;
  category: 'crm' | 'automation' | 'communication' | 'marketing';
  icon?: string; // Icon name or path
  available: boolean; // Whether it's implemented yet
  comingSoon?: boolean;
}

export interface IntegrationStatus {
  type: IntegrationType;
  connected: boolean;
  lastSyncAt?: string | null;
}

export const AVAILABLE_INTEGRATIONS: Integration[] = [
  {
    id: 'ghl',
    name: 'GoHighLevel',
    description: 'Sync contacts and data from GoHighLevel CRM',
    category: 'crm',
    available: true,
  },
  {
    id: 'webhook',
    name: 'Incoming Webhooks',
    description: 'Receive data from external services via HTTP POST',
    category: 'automation',
    available: true,
  },
  // Future integrations (marked as coming soon)
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect with thousands of apps via Zapier',
    category: 'automation',
    available: false,
    comingSoon: true,
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Sync data with Salesforce CRM',
    category: 'crm',
    available: false,
    comingSoon: true,
  },
  {
    id: 'make',
    name: 'Make (Integromat)',
    description: 'Build automated workflows with Make',
    category: 'automation',
    available: false,
    comingSoon: true,
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    description: 'Connect with HubSpot CRM and marketing tools',
    category: 'marketing',
    available: false,
    comingSoon: true,
  },
];

