import { BaseDetailService } from './base-detail-service';
import type { Automation } from '../types/base-detail';

export type ExportedBase = {
  version: string;
  exportedAt: string;
  base: {
    name: string;
    description: string | null;
  };
  tables: Array<{
    name: string;
    order_index: number;
    is_master_list: boolean;
  }>;
  fields: Array<{
    table_name: string; // Reference to table by name
    name: string;
    type: string;
    order_index: number;
    options: Record<string, unknown> | null;
  }>;
  automations: Array<{
    table_name: string; // Reference to table by name
    name: string;
    enabled: boolean;
    trigger: {
      type: Automation['trigger']['type'];
      table_id?: string; // Will be converted to table_name
      field_id?: string; // Will be converted to field_name
      field_name?: string; // Added for export
      condition?: Automation['trigger']['condition'];
    };
    action: {
      type: Automation['action']['type'];
      target_table_id?: string; // Will be converted to table_name
      target_table_name?: string; // Added for export
      field_mappings: Array<{
        source_field_id?: string; // Will be converted to field_name
        source_field_name?: string; // Added for export
        target_field_id?: string; // Will be converted to field_name
        target_field_name?: string; // Added for export
      }>;
      preserve_original?: boolean;
      sync_mode?: string;
      duplicate_handling?: string;
      visibility_field_id?: string;
      visibility_field_name?: string; // Added for export
      visibility_value?: string;
    };
  }>;
  records?: Array<{
    table_name: string; // Reference to table by name
    values: Record<string, unknown>;
  }>;
};

export class BaseExportService {
  /**
   * Export a base with all its tables, fields, automations, and optionally records
   * @param baseId - The ID of the base to export
   * @param includeRecords - Whether to include records in the export
   * @param exportName - Optional custom name for the exported base (defaults to base.name)
   */
  static async exportBase(baseId: string, includeRecords: boolean = false, exportName?: string): Promise<ExportedBase> {
    // 1. Get base metadata
    const base = await BaseDetailService.getBase(baseId);
    
    // 2. Get all tables
    const tables = await BaseDetailService.getTables(baseId);
    
    // 3. Get all fields for all tables
    const allFields = await BaseDetailService.getAllFields(baseId);
    
    // 4. Get all automations for the base (base-level automations)
    const allAutomations: Array<{ automation: Automation; tableName: string }> = [];
    const fieldIdToName = new Map<string, { name: string; tableName: string }>();
    
    // Build field ID to name mapping
    for (const field of allFields) {
      const table = tables.find(t => t.id === field.table_id);
      if (table) {
        fieldIdToName.set(field.id, { name: field.name, tableName: table.name });
      }
    }
    
    // Get all automations for the base (not per table anymore)
    try {
      const automations = await BaseDetailService.getAutomations(baseId);
      for (const automation of automations) {
        // Get table name from trigger.table_name if specified, otherwise use "All tables"
        const tableName = automation.trigger?.table_name || 'All tables';
        allAutomations.push({ automation, tableName });
      }
    } catch (error) {
      console.warn(`No automations found for base ${base.name}`, error);
    }
    
    // 5. Optionally get all records
    let records: Array<{ table_name: string; values: Record<string, unknown> }> | undefined;
    if (includeRecords) {
      const allRecords = await BaseDetailService.getAllRecordsFromBase(baseId);
      
      // Create a map of table_id -> table_name for record mapping
      const tableIdToName = new Map(tables.map(t => [t.id, t.name]));
      
      // Create a map of field_id -> field_name for each table
      const fieldIdToNameByTable = new Map<string, Map<string, string>>();
      for (const table of tables) {
        const tableFields = allFields.filter(f => f.table_id === table.id);
        const fieldMap = new Map(tableFields.map(f => [f.id, f.name]));
        fieldIdToNameByTable.set(table.id, fieldMap);
      }
      
      // Map records to include table names and convert field IDs to field names
      records = allRecords.map(record => {
        const tableName = tableIdToName.get(record.table_id) || 'Unknown';
        const fieldIdToName = fieldIdToNameByTable.get(record.table_id);
        
        // Convert field IDs to field names in values
        const mappedValues: Record<string, unknown> = {};
        if (fieldIdToName) {
          for (const [fieldId, value] of Object.entries(record.values)) {
            const fieldName = fieldIdToName.get(fieldId);
            if (fieldName) {
              mappedValues[fieldName] = value;
            } else {
              // Keep the field ID if we can't find the name (shouldn't happen, but safe fallback)
              mappedValues[fieldId] = value;
            }
          }
        } else {
          // If we can't map fields, keep original values
          Object.assign(mappedValues, record.values);
        }
        
        return {
          table_name: tableName,
          values: mappedValues
        };
      });
    }
    
    // Build the exported structure
    const exported: ExportedBase = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      base: {
        name: exportName || base.name,
        description: base.description
      },
      tables: tables.map(t => ({
        name: t.name,
        order_index: t.order_index,
        is_master_list: t.is_master_list
      })),
      fields: allFields.map(f => {
        // Find the table name for this field
        const table = tables.find(t => t.id === f.table_id);
        return {
          table_name: table?.name || 'Unknown',
          name: f.name,
          type: f.type,
          order_index: f.order_index,
          options: f.options
        };
      }),
      automations: allAutomations.map(({ automation, tableName }) => {
        // Map trigger field - prefer field_name if available, otherwise resolve from field_id
        let triggerFieldName: string | undefined;
        if (automation.trigger?.field_name) {
          triggerFieldName = automation.trigger.field_name;
        } else if (automation.trigger?.field_id) {
          const triggerFieldInfo = fieldIdToName.get(automation.trigger.field_id);
          triggerFieldName = triggerFieldInfo?.name;
        }
        // Map field mappings - safely handle missing field_mappings
        const fieldMappings = (automation.action?.field_mappings || []).map(mapping => {
          // For source field - prefer field name resolution from field_id
          let sourceFieldName: string | undefined;
          if (mapping.source_field_id) {
            const sourceFieldInfo = fieldIdToName.get(mapping.source_field_id);
            sourceFieldName = sourceFieldInfo?.name;
          }
          
          // For target field - prefer field name resolution from field_id
          let targetFieldName: string | undefined;
          if (mapping.target_field_id) {
            const targetFieldInfo = fieldIdToName.get(mapping.target_field_id);
            targetFieldName = targetFieldInfo?.name;
          }
          
          return {
            source_field_id: mapping.source_field_id,
            source_field_name: sourceFieldName,
            target_field_id: mapping.target_field_id,
            target_field_name: targetFieldName
          };
        });
        
        // Map visibility field if it exists
        const visibilityFieldInfo = automation.action?.visibility_field_id
          ? fieldIdToName.get(automation.action.visibility_field_id)
          : undefined;
        
        return {
          table_name: tableName,
          name: automation.name,
          enabled: automation.enabled !== false,
          trigger: {
            type: automation.trigger?.type || 'record_created',
            ...(automation.trigger?.field_id && { field_id: automation.trigger.field_id }),
            ...(triggerFieldName && { field_name: triggerFieldName }),
            ...(automation.trigger?.condition && { condition: automation.trigger.condition }),
            ...(automation.trigger?.table_name && { table_name: automation.trigger.table_name })
          },
          action: {
            type: automation.action?.type || 'create_record',
            ...(automation.action?.target_table_name && { target_table_name: automation.action.target_table_name }),
            field_mappings: fieldMappings,
            ...(automation.action?.preserve_original !== undefined && { preserve_original: automation.action.preserve_original }),
            ...(automation.action?.sync_mode && { sync_mode: automation.action.sync_mode }),
            ...(automation.action?.duplicate_handling && { duplicate_handling: automation.action.duplicate_handling }),
            ...(automation.action?.visibility_field_id && { visibility_field_id: automation.action.visibility_field_id }),
            ...(visibilityFieldInfo?.name && { visibility_field_name: visibilityFieldInfo.name }),
            ...(automation.action?.visibility_value !== undefined && { visibility_value: automation.action.visibility_value })
          }
        };
      }),
      ...(includeRecords && records ? { records } : {})
    };
    
    return exported;
  }
  
  /**
   * Download exported base as JSON file
   */
  static downloadAsJson(exported: ExportedBase, baseName: string): void {
    const jsonString = JSON.stringify(exported, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${baseName.replace(/[^a-z0-9]/gi, '_')}_export_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Download exported base as CSV files (one per table).
   * Returns the number of files downloaded.
   */
  static downloadAsCsv(exported: ExportedBase, baseName: string): number {
    if (!exported.records || exported.records.length === 0) {
      throw new Error("CSV export requires records. Enable \"Include records\" before exporting.");
    }

    // Group records by table
    const recordsByTable = new Map<string, Array<Record<string, unknown>>>();
    for (const record of exported.records) {
      const tableRecords = recordsByTable.get(record.table_name) || [];
      tableRecords.push(record.values);
      recordsByTable.set(record.table_name, tableRecords);
    }

    // Build field order per table using the exported field list
    const fieldsByTable = new Map<string, string[]>();
    for (const table of exported.tables) {
      const fieldNames = exported.fields
        .filter((f) => f.table_name === table.name)
        .sort((a, b) => a.order_index - b.order_index)
        .map((f) => f.name);
      fieldsByTable.set(table.name, fieldNames);
    }

    const sanitize = (value: unknown): string => {
      if (value === null || value === undefined) return "";
      if (typeof value === "object") {
        try {
          return JSON.stringify(value);
        } catch {
          return "";
        }
      }
      return String(value);
    };

    const escapeCsv = (value: string): string => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const today = new Date().toISOString().split("T")[0];
    let fileCount = 0;

    for (const [tableName, tableRecords] of recordsByTable.entries()) {
      const fieldOrder = fieldsByTable.get(tableName) || [];

      // Ensure we include any ad-hoc fields that aren't in the schema
      const extraFields = new Set<string>();
      for (const rec of tableRecords) {
        Object.keys(rec).forEach((key) => {
          if (!fieldOrder.includes(key)) extraFields.add(key);
        });
      }
      const header = [...fieldOrder, ...extraFields];

      const rows: string[] = [];
      rows.push(header.map((h) => escapeCsv(h)).join(","));

      for (const rec of tableRecords) {
        const row = header.map((field) => escapeCsv(sanitize((rec as any)[field])));
        rows.push(row.join(","));
      }

      const csvContent = rows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeBase = baseName.replace(/[^a-z0-9]/gi, "_");
      const safeTable = tableName.replace(/[^a-z0-9]/gi, "_");
      link.download = `${safeBase}_${safeTable}_export_${today}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      fileCount += 1;
    }

    return fileCount;
  }
}

