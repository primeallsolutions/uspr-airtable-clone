import { useState, useEffect } from "react";
import { X, Type, Hash, Calendar, Clock, Mail, Phone, CheckSquare, Link, List, CheckCircle, Plus, Edit2, Trash2, GripVertical, AlignLeft, DollarSign, CircleDot } from "lucide-react";
import type { FieldType, FieldRow } from "@/lib/types/base-detail";

interface OptionItem {
  id: string;
  label: string;
  color: string;
}

interface EditFieldModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEditField: (fieldId: string, fieldData: { name: string; type: FieldType; options?: Record<string, unknown> }) => void;
  field: FieldRow | null;
}

const fieldTypes: Array<{
  type: FieldType;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  // Text Input Types
  {
    type: 'text',
    label: 'Text (Single Line)',
    description: 'Single line of text',
    icon: <Type size={20} className="text-gray-600" />
  },
  {
    type: 'long_text',
    label: 'Long Text (Multi Line)',
    description: 'Multi-line text or text box list',
    icon: <AlignLeft size={20} className="text-gray-600" />
  },
  // Numeric Types
  {
    type: 'number',
    label: 'Number',
    description: 'Numeric values',
    icon: <Hash size={20} className="text-gray-600" />
  },
  {
    type: 'monetary',
    label: 'Monetary',
    description: 'Currency/money values',
    icon: <DollarSign size={20} className="text-gray-600" />
  },
  // Date/Time Types
  {
    type: 'date',
    label: 'Date',
    description: 'Date values',
    icon: <Calendar size={20} className="text-gray-600" />
  },
  {
    type: 'datetime',
    label: 'Date Time',
    description: 'Date and time values',
    icon: <Clock size={20} className="text-gray-600" />
  },
  // Contact Types
  {
    type: 'email',
    label: 'Email',
    description: 'Email addresses',
    icon: <Mail size={20} className="text-gray-600" />
  },
  {
    type: 'phone',
    label: 'Phone',
    description: 'Phone numbers',
    icon: <Phone size={20} className="text-gray-600" />
  },
  // Selection Types
  {
    type: 'single_select',
    label: 'Dropdown (Single)',
    description: 'Choose one option from a dropdown',
    icon: <List size={20} className="text-gray-600" />
  },
  {
    type: 'multi_select',
    label: 'Dropdown (Multiple)',
    description: 'Choose multiple options from a dropdown',
    icon: <CheckCircle size={20} className="text-gray-600" />
  },
  {
    type: 'radio_select',
    label: 'Radio Select',
    description: 'Choose one option with radio buttons',
    icon: <CircleDot size={20} className="text-gray-600" />
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    description: 'True or false values',
    icon: <CheckSquare size={20} className="text-gray-600" />
  },
  // Other Types
  {
    type: 'link',
    label: 'Link',
    description: 'URL links',
    icon: <Link size={20} className="text-gray-600" />
  }
];

const predefinedColors = [
  { name: 'Dark Blue', value: '#1E40AF', bg: 'bg-blue-100', text: 'text-blue-800' },
  { name: 'Dark Green', value: '#065F46', bg: 'bg-green-100', text: 'text-green-800' },
  { name: 'Dark Orange', value: '#C2410C', bg: 'bg-orange-100', text: 'text-orange-800' },
  { name: 'Dark Red', value: '#B91C1C', bg: 'bg-red-100', text: 'text-red-800' },
  { name: 'Dark Purple', value: '#5B21B6', bg: 'bg-purple-100', text: 'text-purple-800' },
  { name: 'Dark Pink', value: '#BE185D', bg: 'bg-pink-100', text: 'text-pink-800' },
  { name: 'Dark Indigo', value: '#3730A3', bg: 'bg-indigo-100', text: 'text-indigo-800' },
  { name: 'Dark Gray', value: '#374151', bg: 'bg-gray-100', text: 'text-gray-800' },
];

export const EditFieldModal = ({ isOpen, onClose, onEditField, field }: EditFieldModalProps) => {
  const [fieldName, setFieldName] = useState("");
  const [selectedType, setSelectedType] = useState<FieldType>('text');
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [newOptionLabel, setNewOptionLabel] = useState("");
  const [newOptionColor, setNewOptionColor] = useState(predefinedColors[0].value);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Initialize form with field data when modal opens
  useEffect(() => {
    if (field && isOpen) {
      setFieldName(field.name);
      setSelectedType(field.type);
      
      // Parse existing options if they exist
      if (field.options && (field.type === 'single_select' || field.type === 'multi_select' || field.type === 'radio_select')) {
        const parsedOptions: OptionItem[] = [];
        Object.entries(field.options).forEach(([id, optionData]) => {
          if (typeof optionData === 'object' && optionData !== null) {
            const data = optionData as { name?: string; label?: string; color?: string };
            parsedOptions.push({
              id,
              label: data.name || data.label || '',
              color: data.color || predefinedColors[0].value
            });
          }
        });
        setOptions(parsedOptions);
      } else {
        setOptions([]);
      }
    }
  }, [field, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fieldName.trim() || !field) return;
    
    // Validate that selectedType is a valid FieldType
    const validTypes: FieldType[] = [
      'text', 'long_text', 'number', 'monetary', 'date', 'datetime', 
      'email', 'phone', 'single_select', 'multi_select', 'radio_select', 
      'checkbox', 'link'
    ];
    if (!validTypes.includes(selectedType)) {
      console.error('Invalid field type selected:', selectedType);
      return;
    }
    
    const fieldData: { name: string; type: FieldType; options?: Record<string, unknown> } = {
      name: fieldName.trim(),
      type: selectedType
    };
    
    // Add options for select fields (single_select, multi_select, radio_select)
    if (selectedType === 'single_select' || selectedType === 'multi_select' || selectedType === 'radio_select') {
      const optionsMap: Record<string, unknown> = {};
      options.forEach(option => {
        optionsMap[option.id] = {
          label: option.label,
          color: option.color
        };
      });
      fieldData.options = optionsMap;
    }
    
    // Add currency options for monetary fields
    if (selectedType === 'monetary') {
      fieldData.options = { currency: 'USD', symbol: '$' };
    }
    
    onEditField(field.id, fieldData);
    handleClose();
  };

  const handleClose = () => {
    setFieldName("");
    setSelectedType('text');
    setOptions([]);
    setEditingOption(null);
    setNewOptionLabel("");
    setNewOptionColor(predefinedColors[0].value);
    onClose();
  };

  const handleAddOption = () => {
    if (!newOptionLabel.trim()) return;
    
    const newOption: OptionItem = {
      id: `option_${Date.now()}`,
      label: newOptionLabel.trim(),
      color: newOptionColor
    };
    
    setOptions(prev => [...prev, newOption]);
    setNewOptionLabel("");
    setNewOptionColor(predefinedColors[0].value);
  };

  const handleUpdateOptionColor = (optionId: string, color: string) => {
    setOptions(prev => prev.map(option => 
      option.id === optionId ? { ...option, color } : option
    ));
  };

  const handleRemoveOption = (optionId: string) => {
    setOptions(prev => prev.filter(option => option.id !== optionId));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOption();
    }
  };

  // Drag and drop handlers for reordering options
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Set a transparent drag image for better UX
    const dragImage = document.createElement('div');
    dragImage.style.opacity = '0';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    // Reorder the options array
    const reorderedOptions = [...options];
    const [movedOption] = reorderedOptions.splice(draggedIndex, 1);
    reorderedOptions.splice(dropIndex, 0, movedOption);

    setOptions(reorderedOptions);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  if (!isOpen || !field) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/20 backdrop-blur-sm" 
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-[50vw] w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Edit Field</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        
        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Field Name */}
          <div>
            <label htmlFor="fieldName" className="block text-sm font-medium text-gray-700 mb-2">
              Field Name
            </label>
            <input
              id="fieldName"
              type="text"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="Enter field name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
              required
            />
          </div>
          
          {/* Field Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Field Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              {fieldTypes.map((fieldType) => (
                <button
                  key={fieldType.type}
                  type="button"
                  onClick={() => setSelectedType(fieldType.type)}
                  className={`p-3 border rounded-lg text-left transition-colors ${
                    selectedType === fieldType.type
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {fieldType.icon}
                    <span className="font-medium text-sm">{fieldType.label}</span>
                  </div>
                  <p className="text-xs text-gray-500">{fieldType.description}</p>
                </button>
              ))}
            </div>
          </div>
          
          {/* Options for Select Fields (single_select, multi_select, radio_select) */}
          {(selectedType === 'single_select' || selectedType === 'multi_select' || selectedType === 'radio_select') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Options
              </label>
              
              {/* Existing Options */}
              <div className="space-y-2 mb-4">
                {options.map((option, index) => {
                  const isDragging = draggedIndex === index;
                  const isDragOver = dragOverIndex === index;
                  
                  return (
                  <div 
                    key={option.id} 
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-2 p-3 bg-gray-50 rounded-lg group transition-all ${
                      isDragging ? 'opacity-50' : ''
                    } ${isDragOver ? 'border-l-4 border-l-blue-500' : ''}`}
                  >
                    <GripVertical size={16} className="text-gray-400 cursor-grab active:cursor-grabbing" />
                    
                    {/* Option Label */}
                    {editingOption === option.id ? (
                      <input
                        type="text"
                        value={option.label}
                        onChange={(e) => setOptions(prev => prev.map(opt => 
                          opt.id === option.id ? { ...opt, label: e.target.value } : opt
                        ))}
                        onBlur={() => setEditingOption(null)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            setEditingOption(null);
                          }
                        }}
                        className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <span 
                        className="flex-1 text-sm cursor-pointer px-2 py-1 rounded text-white font-medium"
                        style={{ backgroundColor: option.color }}
                        onClick={() => setEditingOption(option.id)}
                      >
                        {option.label}
                      </span>
                    )}
                    
                    {/* Color Picker */}
                    <div className="flex items-center gap-1">
                      {predefinedColors.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => handleUpdateOptionColor(option.id, color.value)}
                          className={`w-4 h-4 rounded-full border-2 ${
                            option.color === color.value ? 'border-gray-400' : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: color.value }}
                          title={color.name}
                        />
                      ))}
                    </div>
                    
                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => setEditingOption(option.id)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-blue-600"
                        title="Edit option"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(option.id)}
                        className="p-1 hover:bg-gray-200 rounded text-gray-500 hover:text-red-600"
                        title="Remove option"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  );
                })}
              </div>
              
              {/* Add New Option */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="text"
                    value={newOptionLabel}
                    onChange={(e) => setNewOptionLabel(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter option name..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleAddOption}
                    disabled={!newOptionLabel.trim()}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                
                {/* Color Selection for New Option */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Color:</span>
                  <div className="flex items-center gap-1">
                    {predefinedColors.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setNewOptionColor(color.value)}
                        className={`w-5 h-5 rounded-full border-2 ${
                          newOptionColor === color.value ? 'border-gray-400' : 'border-gray-200'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!fieldName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Update Field
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
