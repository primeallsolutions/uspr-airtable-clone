"use client";
import { useState, useCallback, useRef } from "react";
import { X, Upload, FileText, AlertCircle, CheckCircle } from "lucide-react";
import type { FieldRow } from "@/lib/types/base-detail";

interface ImportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: { 
    file: File; 
    fieldMappings: Record<string, string | { type: 'create', fieldType: string, fieldName: string }> 
  }) => Promise<{ imported: number; errors: string[] }>;
  fields: FieldRow[];
  tableName: string;
}

interface CsvColumn {
  index: number;
  header: string;
  sampleValue: string;
  uniqueCount?: number;
  nonEmptyCount?: number;
}

export const ImportCsvModal = ({
  isOpen,
  onClose,
  onImport,
  fields,
  tableName
}: ImportCsvModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [csvColumns, setCsvColumns] = useState<CsvColumn[]>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string | { type: 'create', fieldType: string, fieldName: string }>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'upload' | 'mapping' | 'importing' | 'success'>('upload');
  const [rowCount, setRowCount] = useState<number>(0);
  const [createAllFields, setCreateAllFields] = useState(false);
  const [firstDataRow, setFirstDataRow] = useState<Record<string, string>>({});
  const [mappingValidationErrors, setMappingValidationErrors] = useState<Record<string, string[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to properly parse CSV rows
  const parseCSVLine = useCallback((line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote - add one quote and skip the next
          current += '"';
          i++;
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    result.push(current.trim());
    
    return result;
  }, []);

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }
    
    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      setError('File size must be less than 10MB');
      return;
    }

    setFile(selectedFile);
    setError(null);
    
    // Parse CSV to get column headers and sample data
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      
      // Parse CSV into lines while respecting quoted fields that may contain newlines
      const parseCSVLines = (csvText: string): string[] => {
        const lines: string[] = [];
        let currentLine = '';
        let inQuotes = false;
        
        for (let i = 0; i < csvText.length; i++) {
          const char = csvText[i];
          const nextChar = csvText[i + 1];
          
          if (char === '"') {
            currentLine += char;
            if (inQuotes && nextChar === '"') {
              // Escaped quote
              currentLine += nextChar;
              i++;
            } else {
              // Toggle quote state
              inQuotes = !inQuotes;
            }
          } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
            // End of line (not inside quotes)
            if (currentLine.trim()) {
              lines.push(currentLine);
            }
            currentLine = '';
            if (char === '\r' && nextChar === '\n') {
              i++; // Skip the \n after \r
            }
          } else if (char !== '\r') {
            // Add character (skip standalone \r)
            currentLine += char;
          }
        }
        
        // Add the last line if it exists
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        
        return lines;
      };
      
      const lines = parseCSVLines(text);
      
      if (lines.length < 1) {
        setError('CSV file appears to be empty');
        return;
      }

      const headerRow = parseCSVLine(lines[0]);
      
      // Count data rows (excluding header)
      const dataRowCount = lines.length - 1;
      setRowCount(dataRowCount);
      
      // Parse data rows to find sample values (look through up to 20 rows to find non-empty samples)
      const dataRows = lines.slice(1, Math.min(lines.length, 21)).map(line => parseCSVLine(line));
      
      // Store the first data row for validation
      const firstRow: Record<string, string> = {};
      if (dataRows.length > 0) {
        headerRow.forEach((header, index) => {
          let value = dataRows[0][index] ? dataRows[0][index].trim() : '';
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          value = value.replace(/""/g, '"');
          firstRow[header] = value;
        });
      }
      setFirstDataRow(firstRow);
      
      const headers = headerRow.map((header, index) => {
        // Find first non-empty value for this column
        let sampleValue = '';
        let nonEmptyCount = 0;
        const uniqueValues = new Set<string>();
        
        for (const row of dataRows) {
          let value = row[index] ? row[index].trim() : '';
          // Remove surrounding quotes if present
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }
          // Unescape double quotes
          value = value.replace(/""/g, '"');
          
          if (value) {
            uniqueValues.add(value);
            nonEmptyCount++;
            // Use the first non-empty value as sample, but also collect unique values
            if (!sampleValue) {
              sampleValue = value;
            }
          }
        }
        
        // If we found multiple unique values, show a more informative sample
        if (uniqueValues.size > 1) {
          const valuesArray = Array.from(uniqueValues).slice(0, 3); // Show up to 3 different values
          sampleValue = valuesArray.join(', ');
          if (uniqueValues.size > 3) {
            sampleValue += ` (+${uniqueValues.size - 3} more)`;
          }
        }
        
        // Clean header
        let cleanHeader = header.trim();
        if (cleanHeader.startsWith('"') && cleanHeader.endsWith('"')) {
          cleanHeader = cleanHeader.slice(1, -1);
        }
        cleanHeader = cleanHeader.replace(/""/g, '"');
        
        return {
          index,
          header: cleanHeader,
          sampleValue: sampleValue || '(empty)',
          uniqueCount: uniqueValues.size,
          nonEmptyCount
        };
      });

      console.log('Parsed CSV columns:', headers); // Debug log
      console.log('Total rows to import:', dataRowCount); // Debug log
      
      // Debug logging for potential select fields
      headers.forEach(header => {
        if (header.uniqueCount && header.uniqueCount >= 2) {
          const isSelectCandidate = header.uniqueCount <= 5;
          console.log(`🔍 ${isSelectCandidate ? 'POTENTIAL SELECT FIELD' : 'TEXT FIELD (too many values)'}: ${header.header} - ${header.uniqueCount} unique values, sample: "${header.sampleValue}"`);
        }
      });

      setCsvColumns(headers);
      setMappingValidationErrors({});
      
      // Automatically map CSV columns to existing fields if they match
      const autoMappings: Record<string, string | { type: 'create', fieldType: string, fieldName: string }> = {};
      headers.forEach(column => {
        // Clean the header name to use for matching
        const fieldName = column.header.trim();
        // Remove special characters and replace with underscores
        let cleanFieldName = fieldName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        // Ensure it starts with a letter
        if (!/^[a-zA-Z]/.test(cleanFieldName)) {
          cleanFieldName = 'field_' + cleanFieldName;
        }
        
        // Check if a field with this name already exists (exact match first, then similar)
        let existingField = fields.find(field => 
          field.name.toLowerCase() === fieldName.toLowerCase() ||
          field.name.toLowerCase() === cleanFieldName.toLowerCase()
        );
        
        // If no exact match, try to find similar field names
        if (!existingField) {
          existingField = fields.find(field => {
            const fieldNameLower = field.name.toLowerCase();
            const cleanFieldNameLower = cleanFieldName.toLowerCase();
            const originalFieldNameLower = fieldName.toLowerCase();
            
            // Check for common variations
            return fieldNameLower === originalFieldNameLower ||
                   fieldNameLower.includes(originalFieldNameLower) ||
                   originalFieldNameLower.includes(fieldNameLower) ||
                   fieldNameLower.replace(/[_\s-]/g, '') === cleanFieldNameLower.replace(/[_\s-]/g, '') ||
                   cleanFieldNameLower.replace(/[_\s-]/g, '') === fieldNameLower.replace(/[_\s-]/g, '');
          });
        }
        
        if (existingField) {
          // Automatically map to existing field
          autoMappings[column.header] = existingField.id;
        }
      });
      
      setFieldMappings(autoMappings);
      setStep('mapping');
    };
    reader.readAsText(selectedFile);
  }, [parseCSVLine, fields]);

  // Function to validate field mappings against the first data row
  const validateMappings = useCallback((mappings: Record<string, string | { type: 'create', fieldType: string, fieldName: string }>) => {
    const errors: Record<string, string[]> = {};

    Object.entries(mappings).forEach(([csvColumn, fieldMapping]) => {
      const csvValue = firstDataRow[csvColumn] || '';
      const columnErrors: string[] = [];

      // Skip empty CSV values
      if (!csvValue) {
        return;
      }

      // Get the target field info
      let targetFieldType: string | null = null;
      if (typeof fieldMapping === 'string') {
        // Mapping to existing field
        const targetField = fields.find(f => f.id === fieldMapping);
        targetFieldType = targetField?.type || null;
      } else if (fieldMapping.type === 'create') {
        // Mapping to new field
        targetFieldType = fieldMapping.fieldType;
      }

      if (!targetFieldType) return;

      // Validate based on target field type
      switch (targetFieldType) {
        case 'number':
        case 'monetary':
          if (isNaN(Number(csvValue))) {
            columnErrors.push(`Value "${csvValue}" is not a valid number ${isValidPhone(csvValue) ? "(did you mean to use the \"Phone\" field type?)" : ""}`);
          }
          break;

        case 'date':
          // Check if it looks like a date
          if (!isValidDate(csvValue)) {
            columnErrors.push(`Value "${csvValue}" does not appear to be a valid date`);
          }
          break;

        case 'datetime':
          if (!isValidDateTime(csvValue)) {
            columnErrors.push(`Value "${csvValue}" does not appear to be a valid date/time`);
          }
          break;

        case 'email':
          if (!isValidEmail(csvValue)) {
            columnErrors.push(`Value "${csvValue}" does not appear to be a valid email address`);
          }
          break;

        case 'phone':
          if (!isValidPhone(csvValue)) {
            columnErrors.push(`Value "${csvValue}" does not appear to be a valid phone number`);
          }
          break;

        case 'checkbox':
          if (!isValidBoolean(csvValue)) {
            columnErrors.push(`Value "${csvValue}" is not a valid boolean (true/false, yes/no, 1/0)`);
          }
          break;

        case 'link':
          if (!isValidUrl(csvValue)) {
            columnErrors.push(`Value "${csvValue}" does not appear to be a valid URL`);
          }
          break;
      }

      if (columnErrors.length > 0) {
        errors[csvColumn] = columnErrors;
      }
    });

    setMappingValidationErrors(errors);
  }, [firstDataRow, fields]);

  // Validation helper functions
  const isValidDate = (value: string): boolean => {
    if (!value) return true; // Empty is ok
    // Check for common date formats
    const dateRegex = /^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$|^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/;
    if (!dateRegex.test(value)) return false;
    
    // Try parsing to ensure it's valid
    const parsed = new Date(value);
    return !isNaN(parsed.getTime());
  };

  const isValidDateTime = (value: string): boolean => {
    if (!value) return true;
    const parsed = new Date(value);
    return !isNaN(parsed.getTime());
  };

  const isValidEmail = (value: string): boolean => {
    if (!value) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const isValidPhone = (value: string): boolean => {
    if (!value) return true;
    // Phone number should contain digits and allow for common separators
    const phoneRegex = /^[\+]?[\d\s\-\(\)\.]+$|^\d{7,}$/;
    return phoneRegex.test(value) && /\d/.test(value);
  };

  const isValidBoolean = (value: string): boolean => {
    if (!value) return true;
    const booleanValues = ['true', 'false', 'yes', 'no', '1', '0', 'on', 'off', 'y', 'n'];
    return booleanValues.includes(value.toLowerCase());
  };

  const isValidUrl = (value: string): boolean => {
    if (!value) return true;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleMappingChange = useCallback((csvColumn: string, fieldId: string | 'create') => {
    if (fieldId === 'create') {
      // Check if a field with this name already exists before creating a new one
      const fieldName = csvColumn.trim();
      // Remove special characters and replace with underscores
      let cleanFieldName = fieldName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
      // Ensure it starts with a letter
      if (!/^[a-zA-Z]/.test(cleanFieldName)) {
        cleanFieldName = 'field_' + cleanFieldName;
      }
      
      // Check if a field with this name already exists (exact match first, then similar)
      let existingField = fields.find(field => 
        field.name.toLowerCase() === fieldName.toLowerCase() ||
        field.name.toLowerCase() === cleanFieldName.toLowerCase()
      );
      
      // If no exact match, try to find similar field names
      if (!existingField) {
        existingField = fields.find(field => {
          const fieldNameLower = field.name.toLowerCase();
          const cleanFieldNameLower = cleanFieldName.toLowerCase();
          const originalFieldNameLower = fieldName.toLowerCase();
          
          // Check for common variations
          return fieldNameLower === originalFieldNameLower ||
                 fieldNameLower.includes(originalFieldNameLower) ||
                 originalFieldNameLower.includes(fieldNameLower) ||
                 fieldNameLower.replace(/[_\s-]/g, '') === cleanFieldNameLower.replace(/[_\s-]/g, '') ||
                 cleanFieldNameLower.replace(/[_\s-]/g, '') === fieldNameLower.replace(/[_\s-]/g, '');
        });
      }
      
      if (existingField) {
        // Map to existing field instead of creating a new one
        const newMappings: Record<string, string | { type: 'create', fieldType: string, fieldName: string }> = {
          ...fieldMappings,
          [csvColumn]: existingField!.id
        };
        setFieldMappings(newMappings);
        validateMappings(newMappings);
      } else {
        // Initialize with default values for creating a new field
        const newMappings: Record<string, string | { type: 'create', fieldType: string, fieldName: string }> = {
          ...fieldMappings,
          [csvColumn]: { type: 'create' as const, fieldType: 'text', fieldName: cleanFieldName }
        };
        setFieldMappings(newMappings);
        validateMappings(newMappings);
      }
    } else {
      const newMappings: Record<string, string | { type: 'create', fieldType: string, fieldName: string }> = {
        ...fieldMappings,
        [csvColumn]: fieldId
      };
      setFieldMappings(newMappings);
      validateMappings(newMappings);
    }
  }, [fields, fieldMappings, validateMappings]);

  const handleCreateFieldTypeChange = useCallback((csvColumn: string, fieldType: string) => {
    setFieldMappings(prev => {
      const current = prev[csvColumn];
      if (typeof current === 'object' && current.type === 'create') {
        const newMappings = {
          ...prev,
          [csvColumn]: { ...current, fieldType }
        };
        validateMappings(newMappings);
        return newMappings;
      }
      return prev;
    });
  }, [validateMappings]);

  const handleCreateFieldNameChange = useCallback((csvColumn: string, fieldName: string) => {
    setFieldMappings(prev => {
      const current = prev[csvColumn];
      if (typeof current === 'object' && current.type === 'create') {
        const newMappings = {
          ...prev,
          [csvColumn]: { ...current, fieldName }
        };
        validateMappings(newMappings);
        return newMappings;
      }
      return prev;
    });
  }, [validateMappings]);

  // Function to automatically create field mappings for all columns
  const handleCreateAllFields = useCallback((checked: boolean) => {
    console.log('🔍 CREATE ALL FIELDS DEBUG:');
    console.log('📊 Checked:', checked);
    console.log('📊 CSV columns:', csvColumns.length);
    console.log('📊 CSV columns data:', csvColumns);
    
    setCreateAllFields(checked);
    
    if (checked) {
      // Create mappings for all CSV columns
      const allMappings: Record<string, string | { type: 'create', fieldType: string, fieldName: string }> = {};
      
      csvColumns.forEach(column => {
        // Clean the header name to use as field name
        let fieldName = column.header.trim();
        // Remove special characters and replace with underscores
        fieldName = fieldName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
        // Ensure it starts with a letter
        if (!/^[a-zA-Z]/.test(fieldName)) {
          fieldName = 'field_' + fieldName;
        }
        
        // Check if a field with this name already exists (exact match first, then similar)
        let existingField = fields.find(field => 
          field.name.toLowerCase() === fieldName.toLowerCase()
        );
        
        // If no exact match, try to find similar field names
        if (!existingField) {
          existingField = fields.find(field => {
            const fieldNameLower = field.name.toLowerCase();
            const cleanFieldNameLower = fieldName.toLowerCase();
            
            // Check for common variations
            return fieldNameLower === cleanFieldNameLower ||
                   fieldNameLower.includes(cleanFieldNameLower) ||
                   cleanFieldNameLower.includes(fieldNameLower) ||
                   fieldNameLower.replace(/[_\s-]/g, '') === cleanFieldNameLower.replace(/[_\s-]/g, '');
          });
        }
        
        if (existingField) {
          // Map to existing field
          console.log(`📋 Mapping to existing field: ${fieldName} (${existingField.type})`);
          allMappings[column.header] = existingField.id;
        } else {
          // Determine field type based on sample data for new field
          let fieldType = 'text'; // default
          if (column.sampleValue && column.sampleValue !== '(empty)') {
            const sample = column.sampleValue.toLowerCase();
            
            // Check for email
            if (sample.includes('@') && sample.includes('.')) {
              fieldType = 'email';
            }
            // Check for phone number
            else if (/^[\+]?[\d\s\-\(\)]+$/.test(column.sampleValue)) {
              fieldType = 'phone';
            }
            // Check for date
            else if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(column.sampleValue) || 
                     /^\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}$/.test(column.sampleValue)) {
              fieldType = 'date';
            }
            // Check for number
            else if (!isNaN(Number(column.sampleValue)) && column.sampleValue.trim() !== '') {
              fieldType = 'number';
            }
            // Check for boolean values
            else if (['true', 'false', 'yes', 'no', '1', '0'].includes(sample)) {
              fieldType = 'checkbox';
            }
          }
          
          // Smart detection for select option fields
          // Use the improved sample data to make better initial guesses
          if (fieldType === 'text' && column.sampleValue && column.sampleValue !== '(empty)') {
            // If we have multiple unique values in the sample, this might be a select field
            // Updated threshold: only detect as select if 5 or fewer unique values
            if (column.uniqueCount && column.uniqueCount >= 2 && column.uniqueCount <= 5) {
              // Check if the sample contains multiple values (comma-separated)
              if (column.sampleValue.includes(', ')) {
                // This looks like a select field with multiple options
                fieldType = 'single_select';
                console.log(`🎯 POTENTIAL SELECT FIELD DETECTED: ${fieldName} with ${column.uniqueCount} unique values in sample`);
              }
            }
          }
          
          console.log(`📋 Creating new field: ${fieldName} (${fieldType})`);
          allMappings[column.header] = {
            type: 'create',
            fieldType,
            fieldName
          };
        }
      });
      
      console.log('📊 Created mappings:', allMappings);
      setFieldMappings(allMappings);
      validateMappings(allMappings);
    } else {
      // Clear all mappings when unchecked
      console.log('📊 Clearing all mappings');
      setFieldMappings({});
      setMappingValidationErrors({});
    }
  }, [csvColumns, fields, validateMappings]);

  const handleImport = useCallback(async () => {
    if (!file) return;

    console.log('🔍 IMPORT VALIDATION DEBUG:');
    console.log('📊 Field mappings:', fieldMappings);
    console.log('📊 Mapping count:', Object.keys(fieldMappings).length);
    console.log('📊 Create all fields:', createAllFields);
    console.log('📊 CSV columns:', csvColumns.length);

    // Validate that at least one field mapping is configured
    const mappingCount = Object.keys(fieldMappings).length;
    if (mappingCount === 0 && !createAllFields) {
      setError('Please map at least one CSV column to a field before importing. You can either map to an existing field or create a new field.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setStep('importing');

    try {
      await onImport({ file, fieldMappings });
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStep('mapping');
    } finally {
      setIsProcessing(false);
    }
  }, [createAllFields, csvColumns, fieldMappings, file, onImport]);

  const handleClose = useCallback(() => {
    setFile(null);
    setCsvColumns([]);
    setFieldMappings({});
    setError(null);
    setStep('upload');
    setCreateAllFields(false);
    setFirstDataRow({});
    setMappingValidationErrors({});
    onClose();
  }, [onClose]);

  const handleReset = useCallback(() => {
    setFile(null);
    setCsvColumns([]);
    setFieldMappings({});
    setError(null);
    setStep('upload');
    setRowCount(0);
    setCreateAllFields(false);
    setFirstDataRow({});
    setMappingValidationErrors({});
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Import CSV to {tableName}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {step === 'upload' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                  <Upload className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload CSV File</h3>
                <p className="text-gray-500 mb-6">
                  Select a CSV file to import data into your table. The first row should contain column headers.
                </p>
              </div>

              <div
                onDrop={handleFileDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
              >
                <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-600 mb-4">Drag and drop your CSV file here, or</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Choose File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  className="hidden"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Map CSV Columns to Fields</h3>
                <p className="text-gray-500 mb-2">
                  Match your CSV columns with the table fields. Unmapped columns will be ignored.
                </p>
                
                {/* Create All Fields Checkbox */}
                <div className="flex items-center justify-center gap-3 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createAllFields}
                      onChange={(e) => handleCreateAllFields(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      Create all fields automatically
                    </span>
                  </label>
                  <div className="text-xs text-gray-500">
                    (Auto-detects field types from sample data)
                  </div>
                </div>
                
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                  <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-900">
                    {rowCount} {rowCount === 1 ? 'row' : 'rows'} ready to import • {Object.keys(fieldMappings).length} columns mapped
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {createAllFields && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-900">Auto-mapping all columns</span>
                    </div>
                    <div className="text-sm text-green-700">
                      {csvColumns.length} columns will be mapped to existing fields or new fields will be created with smart type detection.
                      <br />
                      <span className="text-blue-600 font-medium">Select fields will be automatically detected when columns contain 5 or fewer unique, repeated values.</span>
                    </div>
                  </div>
                )}
                
                {csvColumns.map((column) => {
                  const mapping = fieldMappings[column.header];
                  const isCreateNew = typeof mapping === 'object' && mapping.type === 'create';
                  const existingFieldId = typeof mapping === 'string' ? mapping : '';
                  
                  return (
                    <div key={column.index} className={`p-4 rounded-lg space-y-3 ${
                      createAllFields ? 'bg-green-50 border border-green-200' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{column.header}</div>
                          <div className="text-sm text-gray-500">
                            Sample: {column.sampleValue}
                            {column.uniqueCount && column.uniqueCount > 1 && (
                              <span className="ml-2 text-blue-600 font-medium">
                                ({column.uniqueCount} unique values)
                              </span>
                            )}
                          </div>
                          {createAllFields && mapping && (
                            <div className="text-xs text-green-600 mt-1">
                              {typeof mapping === 'string' ? (
                                <>→ Will map to existing field &quot;{fields.find(f => f.id === mapping)?.name}&quot;</>
                              ) : (
                                <>
                                  → Will create new field &quot;{mapping.fieldName}&quot; ({mapping.fieldType})
                                  {mapping.fieldType === 'single_select' && (
                                    <span className="ml-1 text-blue-600 font-medium">
                                      (Select field detected)
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">→</span>
                          <select
                            value={isCreateNew ? 'create' : existingFieldId}
                            onChange={(e) => handleMappingChange(column.header, e.target.value)}
                            disabled={createAllFields}
                            className={`px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              createAllFields ? 'bg-gray-100 cursor-not-allowed' : ''
                            }`}
                          >
                            <option value="">Skip this column</option>
                            <option value="create">Create new field</option>
                            {fields.map((field) => (
                              <option key={field.id} value={field.id}>
                                {field.name} ({field.type})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      {/* Show field creation options when "Create new field" is selected */}
                      {isCreateNew && !createAllFields && (
                        <div className="flex items-center gap-4 pl-4 border-l-2 border-blue-200">
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Field Name
                            </label>
                            <input
                              type="text"
                              value={mapping.fieldName}
                              onChange={(e) => handleCreateFieldNameChange(column.header, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Enter field name"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Field Type
                            </label>
                            <select
                              value={mapping.fieldType}
                              onChange={(e) => handleCreateFieldTypeChange(column.header, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="text">Text</option>
                              <option value="number">Number</option>
                              <option value="date">Date</option>
                              <option value="datetime">Date Time</option>
                              <option value="email">Email</option>
                              <option value="phone">Phone</option>
                              <option value="checkbox">Checkbox</option>
                              <option value="single_select">Dropdown (Single)</option>
                              <option value="multi_select">Dropdown (Multiple)</option>
                              <option value="radio_select">Radio Select</option>
                              <option value="link">Link</option>
                              <option value="long_text">Long Text</option>
                              <option value="monetary">Monetary</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              {/* Mapping Validation Errors */}
              {Object.keys(mappingValidationErrors).length > 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <span className="font-medium text-yellow-900">Data Type Mismatches Detected</span>
                  </div>
                  <div className="space-y-2 text-sm text-yellow-800">
                    {Object.entries(mappingValidationErrors).map(([csvColumn, errors]) => (
                      <div key={csvColumn} className="ml-7">
                        <span className="font-medium">{csvColumn}:</span>
                        <ul className="list-disc ml-5 mt-1">
                          {errors.map((error, index) => (
                            <li key={index}>{error}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-yellow-700 mt-3 italic">
                    Note: These values may be left blank or cause errors during import. Consider changing the field type or mapping to a different field.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 'importing' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Importing {rowCount} Rows...</h3>
              <p className="text-gray-500">Please wait while we process your CSV file.</p>
              <p className="text-sm text-gray-400 mt-2">Large imports may take a few moments</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Import Successful!</h3>
              <p className="text-gray-500 mb-6">Your CSV data has been imported into the table.</p>
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'success' && (
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${step === 'upload' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`w-2 h-2 rounded-full ${step === 'mapping' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`w-2 h-2 rounded-full ${step === 'importing' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            </div>
            
            <div className="flex items-center gap-3">
              {step === 'mapping' && (
                <button
                  onClick={handleReset}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Back
                </button>
              )}
              {step === 'mapping' && (
                <button
                  onClick={handleImport}
                  disabled={isProcessing || (Object.keys(fieldMappings).length === 0 && !createAllFields)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isProcessing ? (
                    'Importing...'
                  ) : (
                    <>
                      {Object.keys(mappingValidationErrors).length > 0 && (
                        <AlertCircle size={16} />
                      )}
                      Import {rowCount} {rowCount === 1 ? 'Row' : 'Rows'} ({Object.keys(fieldMappings).length} mapped)
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
