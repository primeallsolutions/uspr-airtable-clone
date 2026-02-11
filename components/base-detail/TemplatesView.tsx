"use client";

import { useState, useEffect, useCallback } from "react";
import { X, FileText, Upload, Trash2, Plus, Loader2, Settings, CheckCircle2, AlertCircle, PenTool, CheckSquare, Edit2, GripVertical, ChevronUp, ChevronDown } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import type { DocumentTemplate, TemplateField } from "@/lib/services/template-service";
import type { ChecklistTemplate, ChecklistItem } from "@/lib/services/checklist-templates-service";
import { ChecklistTemplatesService } from "@/lib/services/checklist-templates-service";
import type { FieldRow, RecordRow } from "@/lib/types/base-detail";
import { BaseDetailService } from "@/lib/services/base-detail-service";
import { TemplateFieldEditor } from "./documents/TemplateFieldEditor";
import { SignatureRequestModal } from "./documents/SignatureRequestModal";

type TemplatesViewProps = {
  baseId: string;
  baseName?: string;
  tables?: Array<{ id: string; name: string }>;
  records?: RecordRow[];
  fields?: FieldRow[];
};

export const TemplatesView = ({ baseId, baseName = "Base", tables = [], records = [], fields = [] }: TemplatesViewProps) => {
  // Document Templates State
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showTemplateFieldEditor, setShowTemplateFieldEditor] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [showSignatureRequestModal, setShowSignatureRequestModal] = useState(false);
  const [templateForSignature, setTemplateForSignature] = useState<DocumentTemplate | null>(null);
  const [selectedTableForRecords, setSelectedTableForRecords] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
  const [tableRecords, setTableRecords] = useState<RecordRow[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [tableFields, setTableFields] = useState<FieldRow[]>([]);

  // Checklist Templates State
  const [activeTab, setActiveTab] = useState<"documents" | "tasks">("documents");
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([]);
  const [checklistLoading, setChecklistLoading] = useState(false);
  const [showCreateChecklist, setShowCreateChecklist] = useState(false);
  const [checklistName, setChecklistName] = useState("");
  const [checklistDescription, setChecklistDescription] = useState("");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDescription, setNewItemDescription] = useState("");
  const [selectedChecklistTemplate, setSelectedChecklistTemplate] = useState<ChecklistTemplate | null>(null);
  const [editingChecklistId, setEditingChecklistId] = useState<string | null>(null);
  const [editingChecklistTemplateName, setEditingChecklistTemplateName] = useState("");
  const [editingChecklistTemplateDescription, setEditingChecklistTemplateDescription] = useState("");
  const [deletingChecklistId, setDeletingChecklistId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemTitle, setEditingItemTitle] = useState("");
  const [editingItemDescription, setEditingItemDescription] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }
      
      const response = await fetch(
        `/api/templates?baseId=${baseId}`,
        { headers }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to load templates");
      }
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err: any) {
      console.error("Failed to load templates", err);
      setError(err.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [baseId]);

  const loadTableRecords = useCallback(async (tableId: string) => {
    try {
      setLoadingRecords(true);
      
      // Use BaseDetailService to fetch records and fields
      const [recordsData, fieldsData] = await Promise.all([
        BaseDetailService.getRecords(tableId),
        BaseDetailService.getFields(tableId)
      ]);

      setTableRecords(recordsData || []);
      setTableFields(fieldsData || []);
    } catch (err: any) {
      console.error("Failed to load table records", err);
      setTableRecords([]);
      setTableFields([]);
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  // Get primary field value for a record
  const getPrimaryValue = (record: RecordRow, fieldsForTable: FieldRow[] = []): string => {
    if (!record.values) return "No value";
    // Get first field value (assuming first field is primary)
    const firstFieldId = fieldsForTable[0]?.id;
    if (firstFieldId && record.values[firstFieldId]) {
      return `${record.values[firstFieldId]} (${record.id?.slice(0, 8)})`;
    }
    return `Record ${record.id?.slice(0, 8)}`;
  };

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Load records when selected table changes
  useEffect(() => {
    if (selectedTableForRecords) {
      loadTableRecords(selectedTableForRecords);
    } else {
      setTableRecords([]);
      setTableFields([]);
    }
    setTableRecords([]);
    setSelectedRecord(null);
  }, [selectedTableForRecords, loadTableRecords]);

  // Auto-clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleUpload = async () => {
    if (!templateName.trim() || !selectedFile) {
      setError("Please provide a template name and select a PDF file");
      return;
    }

    if (selectedFile.type !== "application/pdf") {
      setError("Only PDF files are supported");
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const formData = new FormData();
      formData.append("baseId", baseId);
      formData.append("name", templateName.trim());
      if (templateDescription) formData.append("description", templateDescription);
      formData.append("file", selectedFile);

      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch("/api/templates", {
        method: "POST",
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload template");
      }

      const result = await response.json();
      console.log("Template uploaded successfully:", result);

      // Reset form
      setTemplateName("");
      setTemplateDescription("");
      setSelectedFile(null);
      setShowUploadForm(false);
      setSuccessMessage("Template uploaded successfully!");

      // Reload templates immediately
      await loadTemplates();
    } catch (err: any) {
      console.error("Failed to upload template", err);
      setError(err.message || "Failed to upload template");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!window.confirm("Are you sure you want to delete this template? This cannot be undone.")) {
      return;
    }

    setDeletingId(templateId);
    setError(null);
    try {
      // Get auth token from Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch(
        `/api/templates?templateId=${templateId}&baseId=${baseId}`,
        { 
          method: "DELETE",
          headers
        }
      );

      // Handle error responses
      if (!response.ok) {
        // Check if response has JSON content
        const contentType = response.headers.get("content-type");
        let errorMessage = `Failed to delete template: ${response.status} ${response.statusText}`;
        
        if (contentType && contentType.includes("application/json")) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            if (errorData.details) {
              console.error("Delete template error details:", errorData.details);
            }
            if (errorData.code) {
              console.error("Delete template error code:", errorData.code);
            }
          } catch (jsonError) {
            // If JSON parsing fails, try to get text
            try {
              const text = await response.text();
              if (text) {
                errorMessage = text;
              }
            } catch (textError) {
              // Use default error message
              console.error("Failed to parse error response:", textError);
            }
          }
        } else {
          // Try to get text response
          try {
            const text = await response.text();
            if (text) {
              errorMessage = text;
            }
          } catch (textError) {
            // Use default error message
            console.error("Failed to read error response:", textError);
          }
        }
        
        throw new Error(errorMessage);
      }
      
      // Success - no need to parse response body
      setSuccessMessage("Template deleted successfully!");
      await loadTemplates();
    } catch (err: any) {
      console.error("Failed to delete template", err);
      setError(err.message || "Failed to delete template");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") {
      setSelectedFile(file);
      if (!showUploadForm) {
        setShowUploadForm(true);
      }
    } else if (file) {
      setError("Only PDF files are supported");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Checklist Templates Functions
  const loadChecklistTemplates = useCallback(async () => {
    try {
      setChecklistLoading(true);
      const templates = await ChecklistTemplatesService.listTemplates(baseId);
      setChecklistTemplates(templates);
    } catch (err: any) {
      console.error("Failed to load checklist templates", err);
      setError(err.message || "Failed to load checklist templates");
    } finally {
      setChecklistLoading(false);
    }
  }, [baseId]);

  // Load checklist templates on mount
  useEffect(() => {
    loadChecklistTemplates();
  }, [loadChecklistTemplates]);

  const handleCreateChecklist = async () => {
    if (!checklistName.trim()) {
      setError("Checklist name is required");
      return;
    }

    try {
      const newChecklist = await ChecklistTemplatesService.createTemplate({
        baseId,
        name: checklistName,
        description: checklistDescription || null,
        items: checklistItems,
      });

      setChecklistTemplates([newChecklist, ...checklistTemplates]);
      setChecklistName("");
      setChecklistDescription("");
      setChecklistItems([]);
      setShowCreateChecklist(false);
      setSuccessMessage("Checklist template created successfully!");
    } catch (err: any) {
      console.error("Failed to create checklist", err);
      setError(err.message || "Failed to create checklist");
    }
  };

  const handleAddChecklistItem = () => {
    if (!newItemTitle.trim()) {
      setError("Item title is required");
      return;
    }

    const newItem: ChecklistItem = {
      title: newItemTitle,
      description: newItemDescription || null,
      order_index: checklistItems.length,
      is_required: false,
    };

    setChecklistItems([...checklistItems, newItem]);
    setNewItemTitle("");
    setNewItemDescription("");
  };

  const handleRemoveChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    if (!window.confirm("Are you sure you want to delete this checklist template? This cannot be undone.")) {
      return;
    }

    setDeletingChecklistId(checklistId);
    try {
      await ChecklistTemplatesService.deleteTemplate(checklistId);
      setChecklistTemplates(checklistTemplates.filter(t => t.id !== checklistId));
      setSuccessMessage("Checklist template deleted successfully!");
    } catch (err: any) {
      console.error("Failed to delete checklist", err);
      setError(err.message || "Failed to delete checklist");
    } finally {
      setDeletingChecklistId(null);
    }
  };

  const handleViewChecklist = async (checklistId: string) => {
    try {
      const fullTemplate = await ChecklistTemplatesService.getTemplate(checklistId);
      setSelectedChecklistTemplate(fullTemplate);
    } catch (err: any) {
      console.error("Failed to load checklist items", err);
      setError(err.message || "Failed to load checklist items");
    }
  };

  const handleEditItem = (item: ChecklistItem) => {
    setEditingItemId(item.id || "");
    setEditingItemTitle(item.title);
    setEditingItemDescription(item.description || "");
  };

  const handleSaveEditItem = async (itemId: string) => {
    if (!editingItemTitle.trim()) {
      setError("Item title is required");
      return;
    }

    try {
      await ChecklistTemplatesService.updateItem(itemId, {
        title: editingItemTitle,
        description: editingItemDescription || null,
      });

      // Update the selected template with the new item data
      if (selectedChecklistTemplate?.items) {
        const updatedItems = selectedChecklistTemplate.items.map((item) =>
          item.id === itemId
            ? { ...item, title: editingItemTitle, description: editingItemDescription || null }
            : item
        );
        setSelectedChecklistTemplate({
          ...selectedChecklistTemplate,
          items: updatedItems,
        });
      }

      setEditingItemId(null);
      setSuccessMessage("Item updated successfully!");
    } catch (err: any) {
      console.error("Failed to update item", err);
      setError(err.message || "Failed to update item");
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm("Are you sure you want to delete this item?")) {
      return;
    }

    try {
      await ChecklistTemplatesService.deleteItem(itemId);

      // Remove the item from the selected template
      if (selectedChecklistTemplate?.items) {
        const updatedItems = selectedChecklistTemplate.items.filter((item) => item.id !== itemId);
        setSelectedChecklistTemplate({
          ...selectedChecklistTemplate,
          items: updatedItems,
        });
      }

      setSuccessMessage("Item deleted successfully!");
    } catch (err: any) {
      console.error("Failed to delete item", err);
      setError(err.message || "Failed to delete item");
    }
  };

  const handleItemDragStart = (e: React.DragEvent, itemId: string) => {
    setDraggedItemId(itemId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleItemDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleItemDrop = async (e: React.DragEvent, targetItemId: string) => {
    e.preventDefault();
    if (!draggedItemId || draggedItemId === targetItemId || !selectedChecklistTemplate?.items) {
      return;
    }

    const items = selectedChecklistTemplate.items;
    const draggedIndex = items.findIndex((item) => item.id === draggedItemId);
    const targetIndex = items.findIndex((item) => item.id === targetItemId);

    if (draggedIndex === -1 || targetIndex === -1) {
      return;
    }

    // Reorder items
    const newItems = [...items];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(targetIndex, 0, removed);

    // Update order_index for each item
    const updatedItems = newItems.map((item, index) => ({
      ...item,
      order_index: index,
    }));

    try {
      await ChecklistTemplatesService.reorderItems(
        updatedItems.map((item) => ({
          id: item.id!,
          order_index: item.order_index || 0,
        }))
      );

      setSelectedChecklistTemplate({
        ...selectedChecklistTemplate,
        items: updatedItems,
      });

      setSuccessMessage("Items reordered successfully!");
    } catch (err: any) {
      console.error("Failed to reorder items", err);
      setError(err.message || "Failed to reorder items");
    } finally {
      setDraggedItemId(null);
    }
  };

  const handleMoveItem = async (itemId: string, direction: "up" | "down") => {
    if (!selectedChecklistTemplate?.items) return;

    const items = selectedChecklistTemplate.items;
    const currentIndex = items.findIndex((item) => item.id === itemId);

    if (currentIndex === -1) return;

    const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (newIndex < 0 || newIndex >= items.length) return;

    // Swap items
    const newItems = [...items];
    [newItems[currentIndex], newItems[newIndex]] = [newItems[newIndex], newItems[currentIndex]];

    // Update order_index for each item
    const updatedItems = newItems.map((item, index) => ({
      ...item,
      order_index: index,
    }));

    try {
      await ChecklistTemplatesService.reorderItems(
        updatedItems.map((item) => ({
          id: item.id!,
          order_index: item.order_index || 0,
        }))
      );

      setSelectedChecklistTemplate({
        ...selectedChecklistTemplate,
        items: updatedItems,
      });

      setSuccessMessage("Item moved successfully!");
    } catch (err: any) {
      console.error("Failed to move item", err);
      setError(err.message || "Failed to move item");
    }
  };

  const handleEditChecklistTemplate = () => {
    if (selectedChecklistTemplate) {
      setEditingChecklistId(selectedChecklistTemplate.id);
      setEditingChecklistTemplateName(selectedChecklistTemplate.name);
      setEditingChecklistTemplateDescription(selectedChecklistTemplate.description || "");
    }
  };

  const handleSaveChecklistTemplate = async () => {
    if (!editingChecklistTemplateName.trim()) {
      setError("Checklist name is required");
      return;
    }

    if (!selectedChecklistTemplate) return;

    try {
      const updatedTemplate = await ChecklistTemplatesService.updateTemplate(
        selectedChecklistTemplate.id,
        {
          name: editingChecklistTemplateName,
          description: editingChecklistTemplateDescription || null,
        }
      );

      if (updatedTemplate) {
        setSelectedChecklistTemplate({
          ...selectedChecklistTemplate,
          name: editingChecklistTemplateName,
          description: editingChecklistTemplateDescription || null,
        });

        // Update the checklist list
        setChecklistTemplates(
          checklistTemplates.map((t) =>
            t.id === selectedChecklistTemplate.id
              ? { ...t, name: editingChecklistTemplateName, description: editingChecklistTemplateDescription || null }
              : t
          )
        );

        setEditingChecklistId(null);
        setSuccessMessage("Checklist template updated successfully!");
      }
    } catch (err: any) {
      console.error("Failed to update checklist", err);
      setError(err.message || "Failed to update checklist");
    }
  };

  const handleCancelEditChecklist = () => {
    setEditingChecklistId(null);
    setEditingChecklistTemplateName("");
    setEditingChecklistTemplateDescription("");
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-5 flex items-center justify-between border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Templates</h2>
            <p className="text-sm text-gray-600">Manage your PDF templates and field mappings for {baseName}</p>
          </div>
          <button
            onClick={() => activeTab === "documents" ? setShowUploadForm(!showUploadForm) : setShowCreateChecklist(!showCreateChecklist)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {activeTab === "documents" ? "New Template" : "New Checklist"}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 flex gap-8 border-t border-gray-200">
          <button
            onClick={() => setActiveTab("documents")}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "documents"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Documents
            </div>
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "tasks"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-600 hover:text-gray-900"
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              Tasks
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto p-6">
        {activeTab === "documents" ? (
          <>
            {/* Documents Section */}
            {tables.length > 0 && (
              <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                  {/* Table Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Table for Records
                    </label>
                    <select
                      value={selectedTableForRecords || ""}
                      onChange={(e) => setSelectedTableForRecords(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">-- No table selected --</option>
                      {tables.map((table) => (
                        <option key={table.id} value={table.id}>
                          {table.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Record Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Record <span style={{ color: "red" }}>*</span>
                    </label>
                    <select
                      disabled={!selectedTableForRecords || loadingRecords}
                      value={selectedRecord || ""}
                      onChange={(e) => setSelectedRecord(e.target.value || null)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">
                        {loadingRecords ? "Loading records..." : "-- No specific record --"}
                      </option>
                      {tableRecords.map((record) => (
                        <option key={record.id} value={record.id}>
                          {getPrimaryValue(record, tableFields)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Selecting a record will automatically attach the signed document to that record when the signature is complete.
                </p>
              </div>
            )}

            {/* Success Message */}
            {successMessage && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-green-800 font-medium">{successMessage}</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-800 font-medium">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-600 hover:text-red-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Upload Form */}
            {showUploadForm && (
              <div className="mb-6 p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl space-y-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Upload New Template</h3>
                  <button
                    onClick={() => {
                      setShowUploadForm(false);
                      setTemplateName("");
                      setTemplateDescription("");
                      setSelectedFile(null);
                      setError(null);
                    }}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="e.g., Purchase Agreement"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      value={templateDescription}
                      onChange={(e) => setTemplateDescription(e.target.value)}
                      placeholder="Brief description of this template..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      PDF File *
                    </label>
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                        dragActive
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-300 hover:border-gray-400"
                      }`}
                    >
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        className="hidden"
                        id="file-input"
                      />
                      <label htmlFor="file-input" className="block cursor-pointer">
                        {selectedFile ? (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                            <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm text-gray-600 mb-1">
                              <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-gray-500">PDF files only, up to 10MB</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleUpload}
                      disabled={uploading || !templateName.trim() || !selectedFile}
                      className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Upload Template
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowUploadForm(false);
                        setTemplateName("");
                        setTemplateDescription("");
                        setSelectedFile(null);
                        setError(null);
                      }}
                      disabled={uploading}
                      className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Templates List */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                <p className="text-sm text-gray-500">Loading templates...</p>
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No templates yet</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Get started by uploading your first PDF template. You can then map fields and generate documents.
                </p>
                <button
                  onClick={() => setShowUploadForm(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-md hover:shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First Template
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="group p-5 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all duration-200 bg-white cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                            <FileText className="w-5 h-5 text-blue-600" />
                          </div>
                          <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                            {template.name}
                          </h3>
                        </div>
                        {template.description && (
                          <p className="text-sm text-gray-600 mb-3 ml-11">{template.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 ml-11">
                          <span className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                            {new Date(template.created_at).toLocaleDateString()}
                          </span>
                          {template.fields && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
                              {template.fields.length} field{template.fields.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-4" onClick={(e) => e.stopPropagation()}>
                        {template.fields?.some((f: any) => f.field_type === "signature") ? (
                          <button
                            onClick={() => {
                              setTemplateForSignature(template);
                              setShowSignatureRequestModal(true);
                            }}
                            className={`p-2.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all hover:scale-110 active:scale-95 ${
                                !selectedRecord ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''
                            }`}
                            title="Request signature using this template"
                            disabled={!selectedRecord}
                          >
                            <PenTool className="w-5 h-5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => alert("This template has no signature fields")}
                            className="p-2.5 text-gray-400 bg-gray-100 rounded-lg"
                            title="This template has no signature fields"
                          >
                            <PenTool className="w-5 h-5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedTemplate(template);
                            setShowTemplateFieldEditor(true);
                          }}
                          className="p-2.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-all hover:scale-110 active:scale-95"
                          title="Edit template fields"
                        >
                          <Settings className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          disabled={deletingId === template.id}
                          className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                          title="Delete template"
                        >
                          {deletingId === template.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Trash2 className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {/* Tasks Section */}
            {showCreateChecklist && (
              <div className="mb-6 p-6 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-xl space-y-4 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-gray-900">Create New Checklist Template</h3>
                  <button
                    onClick={() => {
                      setShowCreateChecklist(false);
                      setChecklistName("");
                      setChecklistDescription("");
                      setChecklistItems([]);
                      setNewItemTitle("");
                      setNewItemDescription("");
                      setError(null);
                    }}
                    className="text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Template Name *
                    </label>
                    <input
                      type="text"
                      value={checklistName}
                      onChange={(e) => setChecklistName(e.target.value)}
                      placeholder="e.g., Client Onboarding Checklist"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (optional)
                    </label>
                    <textarea
                      value={checklistDescription}
                      onChange={(e) => setChecklistDescription(e.target.value)}
                      placeholder="What is this checklist for?"
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                    />
                  </div>

                  {/* Add Items Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Checklist Items
                    </label>
                    <div className="space-y-2 mb-3">
                      <input
                        type="text"
                        value={newItemTitle}
                        onChange={(e) => setNewItemTitle(e.target.value)}
                        placeholder="Item title"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      />
                      <textarea
                        value={newItemDescription}
                        onChange={(e) => setNewItemDescription(e.target.value)}
                        placeholder="Item description (optional)"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                      />
                      <button
                        onClick={handleAddChecklistItem}
                        disabled={!newItemTitle.trim()}
                        className="w-full px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                      >
                        <Plus className="w-4 h-4 inline mr-2" />
                        Add Item
                      </button>
                    </div>

                    {/* Items List */}
                    {checklistItems.length > 0 && (
                      <div className="space-y-2 p-3 bg-white rounded-lg border border-gray-200">
                        {checklistItems.map((item, index) => (
                          <div key={index} className="flex items-start justify-between p-2 bg-gray-50 rounded border border-gray-200">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">{item.title}</p>
                              {item.description && (
                                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                              )}
                            </div>
                            <button
                              onClick={() => handleRemoveChecklistItem(index)}
                              className="text-red-600 hover:text-red-800 transition-colors ml-2"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={handleCreateChecklist}
                      disabled={!checklistName.trim() || checklistItems.length === 0}
                      className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 active:scale-95 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      <CheckSquare className="w-4 h-4" />
                      Create Checklist
                    </button>
                    <button
                      onClick={() => {
                        setShowCreateChecklist(false);
                        setChecklistName("");
                        setChecklistDescription("");
                        setChecklistItems([]);
                        setError(null);
                      }}
                      className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 active:scale-95 transition-all shadow-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Checklists List */}
            {checklistLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mb-3" />
                <p className="text-sm text-gray-500">Loading checklists...</p>
              </div>
            ) : checklistTemplates.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-100 rounded-full mb-4">
                  <CheckSquare className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No checklists yet</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Get started by creating your first checklist template. These will be available for agents to use on records.
                </p>
                <button
                  onClick={() => setShowCreateChecklist(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 active:scale-95 transition-all shadow-md hover:shadow-lg"
                >
                  <Plus className="w-5 h-5" />
                  Create Your First Checklist
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {checklistTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="group p-5 border-2 border-gray-200 rounded-xl hover:border-emerald-400 hover:shadow-lg transition-all duration-200 bg-white"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-emerald-100 rounded-lg group-hover:bg-emerald-200 transition-colors">
                            <CheckSquare className="w-5 h-5 text-emerald-600" />
                          </div>
                          <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-emerald-600 transition-colors">
                            {template.name}
                          </h3>
                        </div>
                        {template.description && (
                          <p className="text-sm text-gray-600 mb-3 ml-11">{template.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500 ml-11">
                          {template.items && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-medium">
                              {template.items.length} item{template.items.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 ml-4" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleViewChecklist(template.id)}
                          className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all hover:scale-110 active:scale-95"
                          title="View checklist items"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteChecklist(template.id)}
                          disabled={deletingChecklistId === template.id}
                          className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-all hover:scale-110 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                          title="Delete checklist"
                        >
                          {deletingChecklistId === template.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Trash2 className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Show items preview */}
                    {template.items && template.items.length > 0 && (
                      <div className="mt-3 ml-11 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs font-medium text-gray-600 mb-2">Items:</p>
                        <ul className="space-y-1">
                          {template.items.slice(0, 3).map((item) => (
                            <li key={item.id} className="text-xs text-gray-600 flex items-start gap-2">
                              <span className="text-emerald-600 mt-0.5">•</span>
                              <span>{item.title}</span>
                            </li>
                          ))}
                          {template.items.length > 3 && (
                            <li className="text-xs text-gray-500 italic">
                              +{template.items.length - 3} more items
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Template Field Editor Modal */}
      {selectedTemplate && (
        <TemplateFieldEditor
          isOpen={showTemplateFieldEditor}
          onClose={() => {
            setShowTemplateFieldEditor(false);
            setSelectedTemplate(null);
            loadTemplates();
          }}
          template={selectedTemplate}
          baseId={baseId}
        />
      )}

      {/* Signature Request Modal */}
      {templateForSignature && (
        <SignatureRequestModal
          isOpen={showSignatureRequestModal}
          onClose={() => {
            setShowSignatureRequestModal(false);
            setTemplateForSignature(null);
          }}
          baseId={baseId}
          tableId={selectedTableForRecords ?? null}
          onRequestCreated={() => {
            setShowSignatureRequestModal(false);
            setTemplateForSignature(null);
          }}
          selectedTemplateId={templateForSignature.id}
          availableFields={tableFields.map(f => ({
            id: f.id,
            name: f.name,
            type: f.type,
            options: f.options as Record<string, { name?: string; label?: string }> | undefined
          }))}
          recordValues={undefined}
          records={tableRecords}
          recordId={selectedRecord}
        />
      )}

      {/* Checklist Template Viewer Modal */}
      {selectedChecklistTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              {editingChecklistId === selectedChecklistTemplate.id ? (
                <input
                  type="text"
                  value={editingChecklistTemplateName}
                  onChange={(e) => setEditingChecklistTemplateName(e.target.value)}
                  className="flex-1 px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              ) : (
                <h3 className="text-lg font-bold text-gray-900">{selectedChecklistTemplate.name}</h3>
              )}
              <div className="flex items-center gap-2 ml-4">
                {editingChecklistId !== selectedChecklistTemplate.id && (
                  <button
                    onClick={handleEditChecklistTemplate}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Edit template"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedChecklistTemplate(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {editingChecklistId === selectedChecklistTemplate.id ? (
                <div className="space-y-3 mb-6">
                  <textarea
                    value={editingChecklistTemplateDescription}
                    onChange={(e) => setEditingChecklistTemplateDescription(e.target.value)}
                    placeholder="Description (optional)"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveChecklistTemplate}
                      className="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                    >
                      Save
                    </button>
                    <button
                      onClick={handleCancelEditChecklist}
                      className="flex-1 px-3 py-2 bg-gray-300 text-gray-700 rounded text-sm font-medium hover:bg-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {selectedChecklistTemplate.description && (
                    <p className="text-sm text-gray-600 mb-4">{selectedChecklistTemplate.description}</p>
                  )}
                </>
              )}
              
              {selectedChecklistTemplate.items && selectedChecklistTemplate.items.length > 0 ? (
                <div className="space-y-2">
                  {selectedChecklistTemplate.items.map((item, index) => (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={(e) => handleItemDragStart(e, item.id!)}
                      onDragOver={handleItemDragOver}
                      onDrop={(e) => handleItemDrop(e, item.id!)}
                      className={`p-3 bg-gray-50 rounded-lg border border-gray-200 transition-all ${
                        draggedItemId === item.id ? "opacity-50 border-blue-400" : ""
                      }`}
                    >
                      {editingItemId === item.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingItemTitle}
                            onChange={(e) => setEditingItemTitle(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <textarea
                            value={editingItemDescription}
                            onChange={(e) => setEditingItemDescription(e.target.value)}
                            placeholder="Description (optional)"
                            rows={2}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          />
                          <div className="flex gap-2 justify-end">
                            <button
                              onClick={() => handleSaveEditItem(item.id!)}
                              className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingItemId(null)}
                              className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-xs font-medium hover:bg-gray-400"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <div className="flex flex-col gap-0.5 mt-1 flex-shrink-0">
                              <button
                                onClick={() => handleMoveItem(item.id!, "up")}
                                disabled={index === 0}
                                className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Move up"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <div className="flex justify-center cursor-grab active:cursor-grabbing py-0.5">
                                <GripVertical className="w-4 h-4 text-gray-400" />
                              </div>
                              <button
                                onClick={() => handleMoveItem(item.id!, "down")}
                                disabled={index === selectedChecklistTemplate.items!.length - 1}
                                className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                title="Move down"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{item.title}</p>
                              {item.description && (
                                <p className="text-xs text-gray-600 mt-1">{item.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() => handleEditItem(item)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Edit item"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id!)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No items in this checklist</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};