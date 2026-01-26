import { DocumentsService } from "./documents-service";

// Transaction type folder templates
export type TransactionType =
  | "buyer"
  | "seller"
  | "dual_agent"
  | "refinance"
  | "commercial"
  | "custom";

// Event types that trigger auto-folder creation
export type AutoFolderTrigger =
  | "transaction_create"
  | "signature_request"
  | "document_generate"
  | "closing_initiated";

// Folder template configuration
export type FolderTemplate = {
  name: string;
  subfolders?: string[];
};

// Templates for different transaction types
export const TRANSACTION_FOLDER_TEMPLATES: Record<TransactionType, FolderTemplate[]> = {
  buyer: [
    { name: "Contract", subfolders: ["Addendums", "Amendments"] },
    { name: "Buyer docs", subfolders: ["ID Documents", "Financial Documents"] },
    { name: "Lender docs", subfolders: ["Pre-Approval", "Loan Documents", "Conditions"] },
    { name: "Title", subfolders: ["Title Search", "Title Insurance"] },
    { name: "Inspection", subfolders: ["Reports", "Repairs"] },
    { name: "Appraisal" },
    { name: "Insurance", subfolders: ["Homeowners", "Flood"] },
    { name: "HOA", subfolders: ["Docs", "Budget", "Meeting Minutes"] },
    { name: "Closing", subfolders: ["Closing Disclosure", "Final Walkthrough"] },
  ],
  seller: [
    { name: "Contract", subfolders: ["Addendums", "Amendments"] },
    { name: "Seller docs", subfolders: ["ID Documents", "Property Docs"] },
    { name: "Disclosures", subfolders: ["Property Disclosure", "Lead Paint"] },
    { name: "Title", subfolders: ["Title Search", "Payoff Letters"] },
    { name: "Repairs", subfolders: ["Quotes", "Receipts"] },
    { name: "HOA", subfolders: ["Docs", "Estoppel"] },
    { name: "Closing", subfolders: ["Settlement Statement", "Deed"] },
  ],
  dual_agent: [
    { name: "Contract", subfolders: ["Addendums", "Amendments"] },
    { name: "Buyer docs", subfolders: ["ID Documents", "Financial Documents"] },
    { name: "Seller docs", subfolders: ["ID Documents", "Property Docs"] },
    { name: "Lender docs", subfolders: ["Pre-Approval", "Loan Documents"] },
    { name: "Disclosures" },
    { name: "Title" },
    { name: "Inspection" },
    { name: "Appraisal" },
    { name: "HOA" },
    { name: "Insurance" },
    { name: "Closing" },
  ],
  refinance: [
    { name: "Loan Application" },
    { name: "Income Documents", subfolders: ["Pay Stubs", "Tax Returns", "W2s"] },
    { name: "Asset Documents", subfolders: ["Bank Statements", "Investment Statements"] },
    { name: "Property Documents", subfolders: ["Insurance", "Tax Records"] },
    { name: "Title" },
    { name: "Appraisal" },
    { name: "Closing", subfolders: ["Closing Disclosure", "Final Docs"] },
  ],
  commercial: [
    { name: "Letter of Intent" },
    { name: "Purchase Agreement" },
    { name: "Due Diligence", subfolders: ["Financial", "Environmental", "Legal"] },
    { name: "Tenant Files" },
    { name: "Lease Agreements" },
    { name: "Title & Survey" },
    { name: "Financing" },
    { name: "Closing" },
  ],
  custom: [
    { name: "Documents" },
    { name: "Contracts" },
    { name: "Correspondence" },
    { name: "Closing" },
  ],
};

// Event-triggered folder names
export const EVENT_FOLDER_NAMES: Record<AutoFolderTrigger, string> = {
  transaction_create: "", // Uses transaction type templates
  signature_request: "E-Signatures",
  document_generate: "Generated Documents",
  closing_initiated: "Closing Documents",
};

export const AutoFolderService = {
  /**
   * Create folder structure based on transaction type
   */
  async createTransactionFolders(
    baseId: string,
    tableId: string | null,
    transactionType: TransactionType,
    existingFolders?: string[],
    recordId?: string | null
  ): Promise<{ created: string[]; skipped: string[] }> {
    const templates = TRANSACTION_FOLDER_TEMPLATES[transactionType];
    const created: string[] = [];
    const skipped: string[] = [];
    const existing = new Set(existingFolders?.map((f) => f.toLowerCase()) || []);

    for (const template of templates) {
      // Create main folder if doesn't exist
      if (!existing.has(template.name.toLowerCase())) {
        try {
          await DocumentsService.createFolder(baseId, tableId, "", template.name, recordId);
          created.push(template.name);
        } catch (err) {
          console.error(`Failed to create folder "${template.name}":`, err);
          skipped.push(template.name);
        }
      } else {
        skipped.push(template.name);
      }

      // Create subfolders
      if (template.subfolders) {
        for (const subfolder of template.subfolders) {
          const subPath = `${template.name}/`;
          try {
            await DocumentsService.createFolder(baseId, tableId, subPath, subfolder, recordId);
            created.push(`${template.name}/${subfolder}`);
          } catch (err) {
            // Subfolder creation might fail if it already exists
            console.warn(`Subfolder "${template.name}/${subfolder}" might already exist`);
          }
        }
      }
    }

    return { created, skipped };
  },

  /**
   * Create a folder for a specific event (e.g., signature request)
   */
  async createEventFolder(
    baseId: string,
    tableId: string | null,
    trigger: AutoFolderTrigger,
    customName?: string
  ): Promise<string | null> {
    const folderName = customName || EVENT_FOLDER_NAMES[trigger];
    if (!folderName) return null;

    try {
      await DocumentsService.createFolder(baseId, tableId, "", folderName);
      return folderName;
    } catch (err) {
      // Folder might already exist, which is fine
      console.warn(`Event folder "${folderName}" might already exist:`, err);
      return folderName;
    }
  },

  /**
   * Ensure a specific folder exists and return its path
   */
  async ensureFolder(
    baseId: string,
    tableId: string | null,
    parentPath: string,
    folderName: string
  ): Promise<string> {
    const fullPath = parentPath ? `${parentPath}${folderName}/` : `${folderName}/`;
    
    try {
      await DocumentsService.createFolder(baseId, tableId, parentPath, folderName);
    } catch (err) {
      // Folder might already exist
      console.warn(`Folder "${fullPath}" might already exist`);
    }

    return fullPath;
  },

  /**
   * Get folder template for a transaction type
   */
  getTemplateForType(transactionType: TransactionType): FolderTemplate[] {
    return TRANSACTION_FOLDER_TEMPLATES[transactionType] || TRANSACTION_FOLDER_TEMPLATES.custom;
  },

  /**
   * Get all available transaction types
   */
  getTransactionTypes(): { value: TransactionType; label: string }[] {
    return [
      { value: "buyer", label: "Buyer Transaction" },
      { value: "seller", label: "Seller Transaction" },
      { value: "dual_agent", label: "Dual Agent Transaction" },
      { value: "refinance", label: "Refinance" },
      { value: "commercial", label: "Commercial" },
      { value: "custom", label: "Custom" },
    ];
  },
};
