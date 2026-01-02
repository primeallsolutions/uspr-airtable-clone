import type { ExportedBase } from '../services/base-export-service';

/**
 * Predefined template definitions with complete structure and sample data
 * These will be seeded as global templates in the database
 */

export const REAL_ESTATE_CRM_TEMPLATE: ExportedBase = {
  version: '1.0.0',
  exportedAt: new Date().toISOString(),
  base: {
    name: 'Real Estate CRM',
    description: 'Manage properties, clients, and deals all in one place. Perfect for real estate agents and agencies.'
  },
  tables: [
    { name: 'Contacts', order_index: 0, is_master_list: true },
    { name: 'Properties', order_index: 1, is_master_list: false },
    { name: 'Deals', order_index: 2, is_master_list: false },
    { name: 'Tasks', order_index: 3, is_master_list: false }
  ],
  fields: [
    // Contacts table fields
    { table_name: 'Contacts', name: 'Full Name', type: 'text', order_index: 0, options: {} },
    { table_name: 'Contacts', name: 'Email', type: 'email', order_index: 1, options: {} },
    { table_name: 'Contacts', name: 'Phone', type: 'phone', order_index: 2, options: {} },
    { table_name: 'Contacts', name: 'Type', type: 'single_select', order_index: 3, options: { buyer: { name: 'Buyer', color: '#1E40AF' }, seller: { name: 'Seller', color: '#C2410C' }, both: { name: 'Both', color: '#15803D' }, lead: { name: 'Lead', color: '#B91C1C' } } },
    { table_name: 'Contacts', name: 'Status', type: 'single_select', order_index: 4, options: { active: { name: 'Active', color: '#15803D' }, inactive: { name: 'Inactive', color: '#6B7280' }, hot_lead: { name: 'Hot Lead', color: '#DC2626' }, cold_lead: { name: 'Cold Lead', color: '#3B82F6' } } },
    { table_name: 'Contacts', name: 'Notes', type: 'text', order_index: 5, options: {} },
    
    // Properties table fields
    { table_name: 'Properties', name: 'Address', type: 'text', order_index: 0, options: {} },
    { table_name: 'Properties', name: 'Property Type', type: 'single_select', order_index: 1, options: { house: { name: 'House', color: '#1E40AF' }, apartment: { name: 'Apartment', color: '#C2410C' }, condo: { name: 'Condo', color: '#15803D' }, land: { name: 'Land', color: '#B91C1C' }, commercial: { name: 'Commercial', color: '#7C3AED' } } },
    { table_name: 'Properties', name: 'Price', type: 'number', order_index: 2, options: { format: 'currency' } },
    { table_name: 'Properties', name: 'Bedrooms', type: 'number', order_index: 3, options: {} },
    { table_name: 'Properties', name: 'Bathrooms', type: 'number', order_index: 4, options: {} },
    { table_name: 'Properties', name: 'Square Feet', type: 'number', order_index: 5, options: {} },
    { table_name: 'Properties', name: 'Status', type: 'single_select', order_index: 6, options: { available: { name: 'Available', color: '#15803D' }, under_contract: { name: 'Under Contract', color: '#F59E0B' }, sold: { name: 'Sold', color: '#DC2626' }, off_market: { name: 'Off Market', color: '#6B7280' } } },
    { table_name: 'Properties', name: 'Listed Date', type: 'date', order_index: 7, options: {} },
    
    // Deals table fields
    { table_name: 'Deals', name: 'Deal Name', type: 'text', order_index: 0, options: {} },
    { table_name: 'Deals', name: 'Property', type: 'text', order_index: 1, options: {} },
    { table_name: 'Deals', name: 'Client', type: 'text', order_index: 2, options: {} },
    { table_name: 'Deals', name: 'Deal Value', type: 'number', order_index: 3, options: { format: 'currency' } },
    { table_name: 'Deals', name: 'Stage', type: 'single_select', order_index: 4, options: { prospect: { name: 'Prospect', color: '#6B7280' }, showing: { name: 'Showing', color: '#3B82F6' }, offer: { name: 'Offer', color: '#F59E0B' }, negotiation: { name: 'Negotiation', color: '#EF4444' }, under_contract: { name: 'Under Contract', color: '#10B981' }, closed: { name: 'Closed', color: '#15803D' } } },
    { table_name: 'Deals', name: 'Probability', type: 'single_select', order_index: 5, options: { p25: { name: '25%', color: '#DC2626' }, p50: { name: '50%', color: '#F59E0B' }, p75: { name: '75%', color: '#3B82F6' }, p90: { name: '90%', color: '#10B981' }, p100: { name: '100%', color: '#15803D' } } },
    { table_name: 'Deals', name: 'Expected Close Date', type: 'date', order_index: 6, options: {} },
    
    // Tasks table fields
    { table_name: 'Tasks', name: 'Task Name', type: 'text', order_index: 0, options: {} },
    { table_name: 'Tasks', name: 'Description', type: 'text', order_index: 1, options: {} },
    { table_name: 'Tasks', name: 'Related To', type: 'text', order_index: 2, options: {} },
    { table_name: 'Tasks', name: 'Assignee', type: 'text', order_index: 3, options: { inputType: 'email' } },
    { table_name: 'Tasks', name: 'Due Date', type: 'date', order_index: 4, options: {} },
    { table_name: 'Tasks', name: 'Priority', type: 'single_select', order_index: 5, options: { low: { name: 'Low', color: '#6B7280' }, medium: { name: 'Medium', color: '#3B82F6' }, high: { name: 'High', color: '#F59E0B' }, urgent: { name: 'Urgent', color: '#DC2626' } } },
    { table_name: 'Tasks', name: 'Status', type: 'single_select', order_index: 6, options: { to_do: { name: 'To Do', color: '#6B7280' }, in_progress: { name: 'In Progress', color: '#3B82F6' }, done: { name: 'Done', color: '#15803D' } } }
  ],
  automations: [],
  records: [
    // Sample contacts
    { table_name: 'Contacts', values: { 'Full Name': 'John Smith', 'Email': 'john@example.com', 'Phone': '+1234567890', 'Type': 'buyer', 'Status': 'hot_lead', 'Notes': 'Looking for 3BR home in downtown' } },
    { table_name: 'Contacts', values: { 'Full Name': 'Sarah Johnson', 'Email': 'sarah@example.com', 'Phone': '+1234567891', 'Type': 'seller', 'Status': 'active', 'Notes': 'Selling family home' } },
    { table_name: 'Contacts', values: { 'Full Name': 'Michael Brown', 'Email': 'michael@example.com', 'Phone': '+1234567892', 'Type': 'both', 'Status': 'active', 'Notes': 'Upgrading to larger property' } },
    
    // Sample properties
    { table_name: 'Properties', values: { 'Address': '123 Main St', 'Property Type': 'house', 'Price': 450000, 'Bedrooms': 3, 'Bathrooms': 2, 'Square Feet': 1800, 'Status': 'available', 'Listed Date': '2025-01-15' } },
    { table_name: 'Properties', values: { 'Address': '456 Oak Ave', 'Property Type': 'condo', 'Price': 325000, 'Bedrooms': 2, 'Bathrooms': 2, 'Square Feet': 1200, 'Status': 'under_contract', 'Listed Date': '2025-01-10' } },
    { table_name: 'Properties', values: { 'Address': '789 Pine Rd', 'Property Type': 'house', 'Price': 675000, 'Bedrooms': 4, 'Bathrooms': 3, 'Square Feet': 2500, 'Status': 'available', 'Listed Date': '2025-01-20' } },
    
    // Sample deals
    { table_name: 'Deals', values: { 'Deal Name': 'John Smith - 123 Main St', 'Property': '123 Main St', 'Client': 'John Smith', 'Deal Value': 450000, 'Stage': 'showing', 'Probability': 'p50', 'Expected Close Date': '2025-03-01' } },
    { table_name: 'Deals', values: { 'Deal Name': 'Michael Brown - 456 Oak Ave', 'Property': '456 Oak Ave', 'Client': 'Michael Brown', 'Deal Value': 325000, 'Stage': 'under_contract', 'Probability': 'p90', 'Expected Close Date': '2025-02-15' } },
    
    // Sample tasks
    { table_name: 'Tasks', values: { 'Task Name': 'Schedule showing for John Smith', 'Description': 'Show 123 Main St', 'Related To': 'John Smith', 'Assignee': 'agent@example.com', 'Due Date': '2025-02-05', 'Priority': 'high', 'Status': 'to_do' } },
    { table_name: 'Tasks', values: { 'Task Name': 'Follow up with Sarah Johnson', 'Description': 'Discuss listing price', 'Related To': 'Sarah Johnson', 'Assignee': 'agent@example.com', 'Due Date': '2025-02-03', 'Priority': 'medium', 'Status': 'to_do' } }
  ]
};

export const PROJECT_MANAGEMENT_TEMPLATE: ExportedBase = {
  version: '1.0.0',
  exportedAt: new Date().toISOString(),
  base: {
    name: 'Project Management',
    description: 'Track projects, tasks, and team progress. Perfect for agile teams and project managers.'
  },
  tables: [
    { name: 'Projects', order_index: 0, is_master_list: true },
    { name: 'Tasks', order_index: 1, is_master_list: false },
    { name: 'Team Members', order_index: 2, is_master_list: false },
    { name: 'Milestones', order_index: 3, is_master_list: false }
  ],
  fields: [
    // Projects table fields
    { table_name: 'Projects', name: 'Project Name', type: 'text', order_index: 0, options: {} },
    { table_name: 'Projects', name: 'Description', type: 'text', order_index: 1, options: {} },
    { table_name: 'Projects', name: 'Status', type: 'single_select', order_index: 2, options: { planning: { name: 'Planning', color: '#6B7280' }, active: { name: 'Active', color: '#3B82F6' }, on_hold: { name: 'On Hold', color: '#F59E0B' }, completed: { name: 'Completed', color: '#15803D' }, cancelled: { name: 'Cancelled', color: '#DC2626' } } },
    { table_name: 'Projects', name: 'Priority', type: 'single_select', order_index: 3, options: { low: { name: 'Low', color: '#6B7280' }, medium: { name: 'Medium', color: '#3B82F6' }, high: { name: 'High', color: '#F59E0B' }, critical: { name: 'Critical', color: '#DC2626' } } },
    { table_name: 'Projects', name: 'Start Date', type: 'date', order_index: 4, options: {} },
    { table_name: 'Projects', name: 'End Date', type: 'date', order_index: 5, options: {} },
    { table_name: 'Projects', name: 'Budget', type: 'number', order_index: 6, options: { format: 'currency' } },
    { table_name: 'Projects', name: 'Project Manager', type: 'text', order_index: 7, options: { inputType: 'email' } },
    
    // Tasks table fields
    { table_name: 'Tasks', name: 'Task Name', type: 'text', order_index: 0, options: {} },
    { table_name: 'Tasks', name: 'Project', type: 'text', order_index: 1, options: {} },
    { table_name: 'Tasks', name: 'Description', type: 'text', order_index: 2, options: {} },
    { table_name: 'Tasks', name: 'Status', type: 'single_select', order_index: 3, options: { to_do: { name: 'To Do', color: '#6B7280' }, in_progress: { name: 'In Progress', color: '#3B82F6' }, in_review: { name: 'In Review', color: '#F59E0B' }, done: { name: 'Done', color: '#15803D' }, blocked: { name: 'Blocked', color: '#DC2626' } } },
    { table_name: 'Tasks', name: 'Assignee', type: 'text', order_index: 4, options: { inputType: 'email' } },
    { table_name: 'Tasks', name: 'Priority', type: 'single_select', order_index: 5, options: { low: { name: 'Low', color: '#6B7280' }, medium: { name: 'Medium', color: '#3B82F6' }, high: { name: 'High', color: '#F59E0B' }, critical: { name: 'Critical', color: '#DC2626' } } },
    { table_name: 'Tasks', name: 'Due Date', type: 'date', order_index: 6, options: {} },
    { table_name: 'Tasks', name: 'Estimated Hours', type: 'number', order_index: 7, options: {} },
    
    // Team Members table fields
    { table_name: 'Team Members', name: 'Name', type: 'text', order_index: 0, options: {} },
    { table_name: 'Team Members', name: 'Email', type: 'email', order_index: 1, options: {} },
    { table_name: 'Team Members', name: 'Role', type: 'single_select', order_index: 2, options: { developer: { name: 'Developer', color: '#3B82F6' }, designer: { name: 'Designer', color: '#7C3AED' }, project_manager: { name: 'Project Manager', color: '#F59E0B' }, qa: { name: 'QA', color: '#15803D' }, devops: { name: 'DevOps', color: '#DC2626' } } },
    { table_name: 'Team Members', name: 'Department', type: 'text', order_index: 3, options: {} },
    { table_name: 'Team Members', name: 'Status', type: 'single_select', order_index: 4, options: { active: { name: 'Active', color: '#15803D' }, on_leave: { name: 'On Leave', color: '#F59E0B' }, inactive: { name: 'Inactive', color: '#6B7280' } } },
    
    // Milestones table fields
    { table_name: 'Milestones', name: 'Milestone Name', type: 'text', order_index: 0, options: {} },
    { table_name: 'Milestones', name: 'Project', type: 'text', order_index: 1, options: {} },
    { table_name: 'Milestones', name: 'Description', type: 'text', order_index: 2, options: {} },
    { table_name: 'Milestones', name: 'Due Date', type: 'date', order_index: 3, options: {} },
    { table_name: 'Milestones', name: 'Status', type: 'single_select', order_index: 4, options: { not_started: { name: 'Not Started', color: '#6B7280' }, in_progress: { name: 'In Progress', color: '#3B82F6' }, completed: { name: 'Completed', color: '#15803D' }, delayed: { name: 'Delayed', color: '#DC2626' } } },
    { table_name: 'Milestones', name: 'Completion %', type: 'number', order_index: 5, options: {} }
  ],
  automations: [],
  records: [
    // Sample projects
    { table_name: 'Projects', values: { 'Project Name': 'Website Redesign', 'Description': 'Complete redesign of company website', 'Status': 'active', 'Priority': 'high', 'Start Date': '2025-01-15', 'End Date': '2025-04-15', 'Budget': 50000, 'Project Manager': 'pm@example.com' } },
    { table_name: 'Projects', values: { 'Project Name': 'Mobile App Development', 'Description': 'New mobile app for iOS and Android', 'Status': 'planning', 'Priority': 'critical', 'Start Date': '2025-02-01', 'End Date': '2025-08-01', 'Budget': 150000, 'Project Manager': 'pm@example.com' } },
    
    // Sample tasks
    { table_name: 'Tasks', values: { 'Task Name': 'Design homepage mockup', 'Project': 'Website Redesign', 'Description': 'Create initial homepage design', 'Status': 'in_progress', 'Assignee': 'designer@example.com', 'Priority': 'high', 'Due Date': '2025-02-10', 'Estimated Hours': 16 } },
    { table_name: 'Tasks', values: { 'Task Name': 'Set up development environment', 'Project': 'Mobile App Development', 'Description': 'Configure dev tools and CI/CD', 'Status': 'to_do', 'Assignee': 'dev@example.com', 'Priority': 'critical', 'Due Date': '2025-02-05', 'Estimated Hours': 8 } },
    { table_name: 'Tasks', values: { 'Task Name': 'Review design system', 'Project': 'Website Redesign', 'Description': 'Review and approve design system', 'Status': 'in_review', 'Assignee': 'pm@example.com', 'Priority': 'medium', 'Due Date': '2025-02-08', 'Estimated Hours': 4 } },
    
    // Sample team members
    { table_name: 'Team Members', values: { 'Name': 'Alice Johnson', 'Email': 'alice@example.com', 'Role': 'developer', 'Department': 'Engineering', 'Status': 'active' } },
    { table_name: 'Team Members', values: { 'Name': 'Bob Smith', 'Email': 'bob@example.com', 'Role': 'designer', 'Department': 'Design', 'Status': 'active' } },
    { table_name: 'Team Members', values: { 'Name': 'Carol Davis', 'Email': 'carol@example.com', 'Role': 'project_manager', 'Department': 'Management', 'Status': 'active' } },
    
    // Sample milestones
    { table_name: 'Milestones', values: { 'Milestone Name': 'Design Complete', 'Project': 'Website Redesign', 'Description': 'All design work completed and approved', 'Due Date': '2025-02-28', 'Status': 'in_progress', 'Completion %': 60 } },
    { table_name: 'Milestones', values: { 'Milestone Name': 'Beta Release', 'Project': 'Mobile App Development', 'Description': 'First beta version ready for testing', 'Due Date': '2025-06-01', 'Status': 'not_started', 'Completion %': 0 } }
  ]
};

export const INVENTORY_MANAGEMENT_TEMPLATE: ExportedBase = {
  version: '1.0.0',
  exportedAt: new Date().toISOString(),
  base: {
    name: 'Inventory Management',
    description: 'Track products, suppliers, and stock levels. Perfect for small businesses and warehouses.'
  },
  tables: [
    { name: 'Products', order_index: 0, is_master_list: true },
    { name: 'Suppliers', order_index: 1, is_master_list: false },
    { name: 'Orders', order_index: 2, is_master_list: false },
    { name: 'Stock Movements', order_index: 3, is_master_list: false }
  ],
  fields: [
    // Products table fields
    { table_name: 'Products', name: 'Product Name', type: 'text', order_index: 0, options: {} },
    { table_name: 'Products', name: 'SKU', type: 'text', order_index: 1, options: {} },
    { table_name: 'Products', name: 'Category', type: 'single_select', order_index: 2, options: { electronics: { name: 'Electronics', color: '#3B82F6' }, clothing: { name: 'Clothing', color: '#7C3AED' }, food: { name: 'Food', color: '#15803D' }, furniture: { name: 'Furniture', color: '#F59E0B' }, other: { name: 'Other', color: '#6B7280' } } },
    { table_name: 'Products', name: 'Current Stock', type: 'number', order_index: 3, options: {} },
    { table_name: 'Products', name: 'Reorder Level', type: 'number', order_index: 4, options: {} },
    { table_name: 'Products', name: 'Unit Price', type: 'number', order_index: 5, options: { format: 'currency' } },
    { table_name: 'Products', name: 'Supplier', type: 'text', order_index: 6, options: {} },
    { table_name: 'Products', name: 'Status', type: 'single_select', order_index: 7, options: { in_stock: { name: 'In Stock', color: '#15803D' }, low_stock: { name: 'Low Stock', color: '#F59E0B' }, out_of_stock: { name: 'Out of Stock', color: '#DC2626' }, discontinued: { name: 'Discontinued', color: '#6B7280' } } },
    
    // Suppliers table fields
    { table_name: 'Suppliers', name: 'Supplier Name', type: 'text', order_index: 0, options: {} },
    { table_name: 'Suppliers', name: 'Contact Person', type: 'text', order_index: 1, options: {} },
    { table_name: 'Suppliers', name: 'Email', type: 'email', order_index: 2, options: {} },
    { table_name: 'Suppliers', name: 'Phone', type: 'phone', order_index: 3, options: {} },
    { table_name: 'Suppliers', name: 'Address', type: 'text', order_index: 4, options: {} },
    { table_name: 'Suppliers', name: 'Status', type: 'single_select', order_index: 5, options: { active: { name: 'Active', color: '#15803D' }, inactive: { name: 'Inactive', color: '#6B7280' }, preferred: { name: 'Preferred', color: '#3B82F6' } } },
    
    // Orders table fields
    { table_name: 'Orders', name: 'Order Number', type: 'text', order_index: 0, options: {} },
    { table_name: 'Orders', name: 'Supplier', type: 'text', order_index: 1, options: {} },
    { table_name: 'Orders', name: 'Order Date', type: 'date', order_index: 2, options: {} },
    { table_name: 'Orders', name: 'Expected Delivery', type: 'date', order_index: 3, options: {} },
    { table_name: 'Orders', name: 'Status', type: 'single_select', order_index: 4, options: { pending: { name: 'Pending', color: '#6B7280' }, confirmed: { name: 'Confirmed', color: '#3B82F6' }, shipped: { name: 'Shipped', color: '#F59E0B' }, delivered: { name: 'Delivered', color: '#15803D' }, cancelled: { name: 'Cancelled', color: '#DC2626' } } },
    { table_name: 'Orders', name: 'Total Amount', type: 'number', order_index: 5, options: { format: 'currency' } },
    { table_name: 'Orders', name: 'Notes', type: 'text', order_index: 6, options: {} },
    
    // Stock Movements table fields
    { table_name: 'Stock Movements', name: 'Product', type: 'text', order_index: 0, options: {} },
    { table_name: 'Stock Movements', name: 'Movement Type', type: 'single_select', order_index: 1, options: { purchase: { name: 'Purchase', color: '#15803D' }, sale: { name: 'Sale', color: '#3B82F6' }, return: { name: 'Return', color: '#F59E0B' }, adjustment: { name: 'Adjustment', color: '#7C3AED' }, transfer: { name: 'Transfer', color: '#6B7280' } } },
    { table_name: 'Stock Movements', name: 'Quantity', type: 'number', order_index: 2, options: {} },
    { table_name: 'Stock Movements', name: 'Date', type: 'date', order_index: 3, options: {} },
    { table_name: 'Stock Movements', name: 'Reference', type: 'text', order_index: 4, options: {} },
    { table_name: 'Stock Movements', name: 'Notes', type: 'text', order_index: 5, options: {} }
  ],
  automations: [],
  records: [
    // Sample products
    { table_name: 'Products', values: { 'Product Name': 'Laptop Computer', 'SKU': 'ELEC-001', 'Category': 'electronics', 'Current Stock': 25, 'Reorder Level': 10, 'Unit Price': 899, 'Supplier': 'Tech Supplies Inc', 'Status': 'in_stock' } },
    { table_name: 'Products', values: { 'Product Name': 'Office Chair', 'SKU': 'FURN-001', 'Category': 'furniture', 'Current Stock': 5, 'Reorder Level': 8, 'Unit Price': 249, 'Supplier': 'Office Furniture Co', 'Status': 'low_stock' } },
    { table_name: 'Products', values: { 'Product Name': 'Wireless Mouse', 'SKU': 'ELEC-002', 'Category': 'electronics', 'Current Stock': 0, 'Reorder Level': 20, 'Unit Price': 29, 'Supplier': 'Tech Supplies Inc', 'Status': 'out_of_stock' } },
    
    // Sample suppliers
    { table_name: 'Suppliers', values: { 'Supplier Name': 'Tech Supplies Inc', 'Contact Person': 'John Doe', 'Email': 'john@techsupplies.com', 'Phone': '+1234567890', 'Address': '123 Tech Ave, Silicon Valley', 'Status': 'preferred' } },
    { table_name: 'Suppliers', values: { 'Supplier Name': 'Office Furniture Co', 'Contact Person': 'Jane Smith', 'Email': 'jane@officefurniture.com', 'Phone': '+1234567891', 'Address': '456 Business Rd, Corporate City', 'Status': 'active' } },
    
    // Sample orders
    { table_name: 'Orders', values: { 'Order Number': 'PO-2025-001', 'Supplier': 'Tech Supplies Inc', 'Order Date': '2025-01-25', 'Expected Delivery': '2025-02-05', 'Status': 'confirmed', 'Total Amount': 2500, 'Notes': 'Rush order for wireless mice' } },
    { table_name: 'Orders', values: { 'Order Number': 'PO-2025-002', 'Supplier': 'Office Furniture Co', 'Order Date': '2025-01-28', 'Expected Delivery': '2025-02-10', 'Status': 'pending', 'Total Amount': 1995, 'Notes': 'Bulk order for office chairs' } },
    
    // Sample stock movements
    { table_name: 'Stock Movements', values: { 'Product': 'Laptop Computer', 'Movement Type': 'purchase', 'Quantity': 10, 'Date': '2025-01-20', 'Reference': 'PO-2025-001', 'Notes': 'Regular stock replenishment' } },
    { table_name: 'Stock Movements', values: { 'Product': 'Wireless Mouse', 'Movement Type': 'sale', 'Quantity': -15, 'Date': '2025-01-22', 'Reference': 'SO-2025-045', 'Notes': 'Sold to XYZ Corp' } }
  ]
};

export const EVENT_PLANNING_TEMPLATE: ExportedBase = {
  version: '1.0.0',
  exportedAt: new Date().toISOString(),
  base: {
    name: 'Event Planning',
    description: 'Organize events, manage attendees, and track vendors. Perfect for event coordinators and planners.'
  },
  tables: [
    { name: 'Events', order_index: 0, is_master_list: true },
    { name: 'Attendees', order_index: 1, is_master_list: false },
    { name: 'Vendors', order_index: 2, is_master_list: false },
    { name: 'Budget', order_index: 3, is_master_list: false }
  ],
  fields: [
    // Events table fields
    { table_name: 'Events', name: 'Event Name', type: 'text', order_index: 0, options: {} },
    { table_name: 'Events', name: 'Event Type', type: 'single_select', order_index: 1, options: { conference: { name: 'Conference', color: '#3B82F6' }, wedding: { name: 'Wedding', color: '#EC4899' }, corporate: { name: 'Corporate', color: '#6B7280' }, social: { name: 'Social', color: '#10B981' }, workshop: { name: 'Workshop', color: '#F59E0B' }, other: { name: 'Other', color: '#7C3AED' } } },
    { table_name: 'Events', name: 'Date', type: 'date', order_index: 2, options: {} },
    { table_name: 'Events', name: 'Venue', type: 'text', order_index: 3, options: {} },
    { table_name: 'Events', name: 'Expected Attendees', type: 'number', order_index: 4, options: {} },
    { table_name: 'Events', name: 'Status', type: 'single_select', order_index: 5, options: { planning: { name: 'Planning', color: '#6B7280' }, confirmed: { name: 'Confirmed', color: '#3B82F6' }, in_progress: { name: 'In Progress', color: '#F59E0B' }, completed: { name: 'Completed', color: '#15803D' }, cancelled: { name: 'Cancelled', color: '#DC2626' } } },
    { table_name: 'Events', name: 'Total Budget', type: 'number', order_index: 6, options: { format: 'currency' } },
    { table_name: 'Events', name: 'Notes', type: 'text', order_index: 7, options: {} },
    
    // Attendees table fields
    { table_name: 'Attendees', name: 'Full Name', type: 'text', order_index: 0, options: {} },
    { table_name: 'Attendees', name: 'Email', type: 'email', order_index: 1, options: {} },
    { table_name: 'Attendees', name: 'Phone', type: 'phone', order_index: 2, options: {} },
    { table_name: 'Attendees', name: 'Event', type: 'text', order_index: 3, options: {} },
    { table_name: 'Attendees', name: 'RSVP Status', type: 'single_select', order_index: 4, options: { invited: { name: 'Invited', color: '#6B7280' }, confirmed: { name: 'Confirmed', color: '#15803D' }, declined: { name: 'Declined', color: '#DC2626' }, maybe: { name: 'Maybe', color: '#F59E0B' }, attended: { name: 'Attended', color: '#3B82F6' } } },
    { table_name: 'Attendees', name: 'Dietary Restrictions', type: 'text', order_index: 5, options: {} },
    { table_name: 'Attendees', name: 'Special Requests', type: 'text', order_index: 6, options: {} },
    
    // Vendors table fields
    { table_name: 'Vendors', name: 'Vendor Name', type: 'text', order_index: 0, options: {} },
    { table_name: 'Vendors', name: 'Service Type', type: 'single_select', order_index: 1, options: { catering: { name: 'Catering', color: '#15803D' }, photography: { name: 'Photography', color: '#3B82F6' }, venue: { name: 'Venue', color: '#F59E0B' }, entertainment: { name: 'Entertainment', color: '#EC4899' }, decoration: { name: 'Decoration', color: '#7C3AED' }, other: { name: 'Other', color: '#6B7280' } } },
    { table_name: 'Vendors', name: 'Contact Person', type: 'text', order_index: 2, options: {} },
    { table_name: 'Vendors', name: 'Email', type: 'email', order_index: 3, options: {} },
    { table_name: 'Vendors', name: 'Phone', type: 'phone', order_index: 4, options: {} },
    { table_name: 'Vendors', name: 'Cost', type: 'number', order_index: 5, options: { format: 'currency' } },
    { table_name: 'Vendors', name: 'Status', type: 'single_select', order_index: 6, options: { inquiry: { name: 'Inquiry', color: '#6B7280' }, quoted: { name: 'Quoted', color: '#F59E0B' }, booked: { name: 'Booked', color: '#3B82F6' }, confirmed: { name: 'Confirmed', color: '#15803D' }, completed: { name: 'Completed', color: '#10B981' } } },
    
    // Budget table fields
    { table_name: 'Budget', name: 'Item', type: 'text', order_index: 0, options: {} },
    { table_name: 'Budget', name: 'Event', type: 'text', order_index: 1, options: {} },
    { table_name: 'Budget', name: 'Category', type: 'single_select', order_index: 2, options: { venue: { name: 'Venue', color: '#3B82F6' }, catering: { name: 'Catering', color: '#15803D' }, entertainment: { name: 'Entertainment', color: '#EC4899' }, decoration: { name: 'Decoration', color: '#7C3AED' }, staff: { name: 'Staff', color: '#F59E0B' }, marketing: { name: 'Marketing', color: '#DC2626' }, other: { name: 'Other', color: '#6B7280' } } },
    { table_name: 'Budget', name: 'Estimated Cost', type: 'number', order_index: 3, options: { format: 'currency' } },
    { table_name: 'Budget', name: 'Actual Cost', type: 'number', order_index: 4, options: { format: 'currency' } },
    { table_name: 'Budget', name: 'Status', type: 'single_select', order_index: 5, options: { planned: { name: 'Planned', color: '#6B7280' }, approved: { name: 'Approved', color: '#3B82F6' }, paid: { name: 'Paid', color: '#15803D' }, pending: { name: 'Pending', color: '#F59E0B' } } },
    { table_name: 'Budget', name: 'Notes', type: 'text', order_index: 6, options: {} }
  ],
  automations: [],
  records: [
    // Sample events
    { table_name: 'Events', values: { 'Event Name': 'Annual Tech Conference 2025', 'Event Type': 'conference', 'Date': '2025-06-15', 'Venue': 'Grand Convention Center', 'Expected Attendees': 500, 'Status': 'planning', 'Total Budget': 75000, 'Notes': 'Three-day tech conference with keynote speakers' } },
    { table_name: 'Events', values: { 'Event Name': 'Smith-Johnson Wedding', 'Event Type': 'wedding', 'Date': '2025-08-20', 'Venue': 'Sunset Gardens', 'Expected Attendees': 150, 'Status': 'confirmed', 'Total Budget': 45000, 'Notes': 'Outdoor ceremony, indoor reception' } },
    
    // Sample attendees
    { table_name: 'Attendees', values: { 'Full Name': 'Alice Cooper', 'Email': 'alice@example.com', 'Phone': '+1234567890', 'Event': 'Annual Tech Conference 2025', 'RSVP Status': 'confirmed', 'Dietary Restrictions': 'Vegetarian', 'Special Requests': 'Accessibility access needed' } },
    { table_name: 'Attendees', values: { 'Full Name': 'Bob Williams', 'Email': 'bob@example.com', 'Phone': '+1234567891', 'Event': 'Smith-Johnson Wedding', 'RSVP Status': 'confirmed', 'Dietary Restrictions': 'None', 'Special Requests': 'Plus one' } },
    { table_name: 'Attendees', values: { 'Full Name': 'Carol Davis', 'Email': 'carol@example.com', 'Phone': '+1234567892', 'Event': 'Annual Tech Conference 2025', 'RSVP Status': 'maybe', 'Dietary Restrictions': 'Gluten-free', 'Special Requests': '' } },
    
    // Sample vendors
    { table_name: 'Vendors', values: { 'Vendor Name': 'Elite Catering Services', 'Service Type': 'catering', 'Contact Person': 'Chef Marco', 'Email': 'marco@elitecatering.com', 'Phone': '+1234567893', 'Cost': 15000, 'Status': 'booked' } },
    { table_name: 'Vendors', values: { 'Vendor Name': 'Picture Perfect Photography', 'Service Type': 'photography', 'Contact Person': 'Sarah Lens', 'Email': 'sarah@pictureperfect.com', 'Phone': '+1234567894', 'Cost': 3500, 'Status': 'confirmed' } },
    
    // Sample budget items
    { table_name: 'Budget', values: { 'Item': 'Venue Rental', 'Event': 'Annual Tech Conference 2025', 'Category': 'venue', 'Estimated Cost': 25000, 'Actual Cost': 25000, 'Status': 'paid', 'Notes': 'Three-day rental including setup' } },
    { table_name: 'Budget', values: { 'Item': 'Catering - Dinner', 'Event': 'Smith-Johnson Wedding', 'Category': 'catering', 'Estimated Cost': 12000, 'Actual Cost': null, 'Status': 'approved', 'Notes': 'Buffet style for 150 guests' } }
  ]
};

export const CONTENT_CALENDAR_TEMPLATE: ExportedBase = {
  version: '1.0.0',
  exportedAt: new Date().toISOString(),
  base: {
    name: 'Content Calendar',
    description: 'Plan and track content creation and publication. Perfect for marketing teams and content creators.'
  },
  tables: [
    { name: 'Content', order_index: 0, is_master_list: true },
    { name: 'Authors', order_index: 1, is_master_list: false },
    { name: 'Campaigns', order_index: 2, is_master_list: false },
    { name: 'Analytics', order_index: 3, is_master_list: false }
  ],
  fields: [
    // Content table fields
    { table_name: 'Content', name: 'Title', type: 'text', order_index: 0, options: {} },
    { table_name: 'Content', name: 'Content Type', type: 'single_select', order_index: 1, options: { blog_post: { name: 'Blog Post', color: '#3B82F6' }, social_media: { name: 'Social Media', color: '#EC4899' }, video: { name: 'Video', color: '#DC2626' }, podcast: { name: 'Podcast', color: '#7C3AED' }, newsletter: { name: 'Newsletter', color: '#F59E0B' }, infographic: { name: 'Infographic', color: '#15803D' } } },
    { table_name: 'Content', name: 'Status', type: 'single_select', order_index: 2, options: { idea: { name: 'Idea', color: '#6B7280' }, in_progress: { name: 'In Progress', color: '#3B82F6' }, review: { name: 'Review', color: '#F59E0B' }, scheduled: { name: 'Scheduled', color: '#7C3AED' }, published: { name: 'Published', color: '#15803D' }, archived: { name: 'Archived', color: '#DC2626' } } },
    { table_name: 'Content', name: 'Author', type: 'text', order_index: 3, options: {} },
    { table_name: 'Content', name: 'Campaign', type: 'text', order_index: 4, options: {} },
    { table_name: 'Content', name: 'Publish Date', type: 'date', order_index: 5, options: {} },
    { table_name: 'Content', name: 'Platform', type: 'multi_select', order_index: 6, options: { website: { name: 'Website', color: '#3B82F6' }, facebook: { name: 'Facebook', color: '#1877F2' }, twitter: { name: 'Twitter', color: '#1DA1F2' }, linkedin: { name: 'LinkedIn', color: '#0A66C2' }, instagram: { name: 'Instagram', color: '#E4405F' }, youtube: { name: 'YouTube', color: '#FF0000' } } },
    { table_name: 'Content', name: 'Keywords', type: 'text', order_index: 7, options: {} },
    { table_name: 'Content', name: 'Notes', type: 'text', order_index: 8, options: {} },
    
    // Authors table fields
    { table_name: 'Authors', name: 'Name', type: 'text', order_index: 0, options: {} },
    { table_name: 'Authors', name: 'Email', type: 'email', order_index: 1, options: {} },
    { table_name: 'Authors', name: 'Role', type: 'single_select', order_index: 2, options: { writer: { name: 'Writer', color: '#3B82F6' }, editor: { name: 'Editor', color: '#15803D' }, social_media_manager: { name: 'Social Media Manager', color: '#EC4899' }, video_producer: { name: 'Video Producer', color: '#DC2626' }, designer: { name: 'Designer', color: '#7C3AED' } } },
    { table_name: 'Authors', name: 'Specialization', type: 'text', order_index: 3, options: {} },
    { table_name: 'Authors', name: 'Status', type: 'single_select', order_index: 4, options: { active: { name: 'Active', color: '#15803D' }, on_leave: { name: 'On Leave', color: '#F59E0B' }, inactive: { name: 'Inactive', color: '#6B7280' } } },
    
    // Campaigns table fields
    { table_name: 'Campaigns', name: 'Campaign Name', type: 'text', order_index: 0, options: {} },
    { table_name: 'Campaigns', name: 'Description', type: 'text', order_index: 1, options: {} },
    { table_name: 'Campaigns', name: 'Start Date', type: 'date', order_index: 2, options: {} },
    { table_name: 'Campaigns', name: 'End Date', type: 'date', order_index: 3, options: {} },
    { table_name: 'Campaigns', name: 'Status', type: 'single_select', order_index: 4, options: { planning: { name: 'Planning', color: '#6B7280' }, active: { name: 'Active', color: '#3B82F6' }, completed: { name: 'Completed', color: '#15803D' }, paused: { name: 'Paused', color: '#F59E0B' } } },
    { table_name: 'Campaigns', name: 'Budget', type: 'number', order_index: 5, options: { format: 'currency' } },
    { table_name: 'Campaigns', name: 'Goals', type: 'text', order_index: 6, options: {} },
    
    // Analytics table fields
    { table_name: 'Analytics', name: 'Content Title', type: 'text', order_index: 0, options: {} },
    { table_name: 'Analytics', name: 'Platform', type: 'single_select', order_index: 1, options: { website: { name: 'Website', color: '#3B82F6' }, facebook: { name: 'Facebook', color: '#1877F2' }, twitter: { name: 'Twitter', color: '#1DA1F2' }, linkedin: { name: 'LinkedIn', color: '#0A66C2' }, instagram: { name: 'Instagram', color: '#E4405F' }, youtube: { name: 'YouTube', color: '#FF0000' } } },
    { table_name: 'Analytics', name: 'Views', type: 'number', order_index: 2, options: {} },
    { table_name: 'Analytics', name: 'Engagement', type: 'number', order_index: 3, options: {} },
    { table_name: 'Analytics', name: 'Shares', type: 'number', order_index: 4, options: {} },
    { table_name: 'Analytics', name: 'Comments', type: 'number', order_index: 5, options: {} },
    { table_name: 'Analytics', name: 'Date', type: 'date', order_index: 6, options: {} }
  ],
  automations: [],
  records: [
    // Sample content
    { table_name: 'Content', values: { 'Title': '10 Tips for Remote Work Productivity', 'Content Type': 'blog_post', 'Status': 'published', 'Author': 'Jane Smith', 'Campaign': 'Remote Work Series', 'Publish Date': '2025-01-15', 'Platform': ['website', 'linkedin'], 'Keywords': 'remote work, productivity, tips', 'Notes': 'Include infographic' } },
    { table_name: 'Content', values: { 'Title': 'Company Culture Video', 'Content Type': 'video', 'Status': 'in_progress', 'Author': 'Mike Johnson', 'Campaign': 'Recruitment Campaign', 'Publish Date': '2025-02-20', 'Platform': ['youtube', 'website'], 'Keywords': 'company culture, careers', 'Notes': 'Interview 5 employees' } },
    { table_name: 'Content', values: { 'Title': 'Weekly Newsletter - Tech Updates', 'Content Type': 'newsletter', 'Status': 'review', 'Author': 'Sarah Lee', 'Campaign': 'Tech Updates 2025', 'Publish Date': '2025-02-05', 'Platform': ['website'], 'Keywords': 'technology, updates, news', 'Notes': 'Ready for editor review' } },
    
    // Sample authors
    { table_name: 'Authors', values: { 'Name': 'Jane Smith', 'Email': 'jane@example.com', 'Role': 'writer', 'Specialization': 'Business and Productivity', 'Status': 'active' } },
    { table_name: 'Authors', values: { 'Name': 'Mike Johnson', 'Email': 'mike@example.com', 'Role': 'video_producer', 'Specialization': 'Corporate Video', 'Status': 'active' } },
    { table_name: 'Authors', values: { 'Name': 'Sarah Lee', 'Email': 'sarah@example.com', 'Role': 'writer', 'Specialization': 'Technology and Innovation', 'Status': 'active' } },
    
    // Sample campaigns
    { table_name: 'Campaigns', values: { 'Campaign Name': 'Remote Work Series', 'Description': 'Content series about remote work best practices', 'Start Date': '2025-01-01', 'End Date': '2025-03-31', 'Status': 'active', 'Budget': 5000, 'Goals': 'Increase blog traffic by 30%' } },
    { table_name: 'Campaigns', values: { 'Campaign Name': 'Recruitment Campaign', 'Description': 'Attract top talent through engaging content', 'Start Date': '2025-02-01', 'End Date': '2025-05-31', 'Status': 'planning', 'Budget': 10000, 'Goals': 'Increase job applications by 50%' } },
    
    // Sample analytics
    { table_name: 'Analytics', values: { 'Content Title': '10 Tips for Remote Work Productivity', 'Platform': 'website', 'Views': 2500, 'Engagement': 185, 'Shares': 42, 'Comments': 18, 'Date': '2025-01-25' } },
    { table_name: 'Analytics', values: { 'Content Title': '10 Tips for Remote Work Productivity', 'Platform': 'linkedin', 'Views': 5200, 'Engagement': 420, 'Shares': 89, 'Comments': 35, 'Date': '2025-01-25' } }
  ]
};

// Export all templates as an array for easy seeding
export const PREDEFINED_TEMPLATES = [
  {
    template: REAL_ESTATE_CRM_TEMPLATE,
    category: 'crm' as const,
    icon: 'Building2'
  },
  {
    template: PROJECT_MANAGEMENT_TEMPLATE,
    category: 'project_management' as const,
    icon: 'Kanban'
  },
  {
    template: INVENTORY_MANAGEMENT_TEMPLATE,
    category: 'inventory' as const,
    icon: 'Package'
  },
  {
    template: EVENT_PLANNING_TEMPLATE,
    category: 'event_planning' as const,
    icon: 'Calendar'
  },
  {
    template: CONTENT_CALENDAR_TEMPLATE,
    category: 'content_calendar' as const,
    icon: 'FileText'
  }
];

