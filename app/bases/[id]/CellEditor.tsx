"use client";
import { useMemo, useState, useEffect } from "react";
import type { FieldRow } from "@/lib/types/base-detail";
import { XIcon } from "lucide-react";

const DEFAULT_CHOICE_COLORS = ['#1E40AF', '#C2410C', '#B91C1C']; // dark blue, dark orange, dark red
const EMPTY_LABEL = 'No data';

export default function CellEditor({
  field,
  value,
  onUpdate,
  isSaving,
}: {
  field: FieldRow;
  value: unknown;
  onUpdate: (val: unknown) => void;
  isSaving?: boolean;
}) {
  const [local, setLocal] = useState<string>(() => (value == null ? "" : String(value)));
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const isEmptyValue =
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0);
  
  // Sync local state when value prop changes (e.g., after sync from GHL)
  useEffect(() => {
    setLocal(value == null ? "" : String(value));
  }, [value]);

  const SelectDropdown = ({ 
    value,
    onUpdate,
    selectChoices,
    selectedColor,
    isEmptyValue,
    EMPTY_LABEL,
    isSaving
  }: {
    value?: unknown;
    onUpdate: (val: unknown) => void;
    selectChoices: { key: string; label: string; color: string }[];
    selectedColor?: string;
    isEmptyValue: boolean;
    EMPTY_LABEL: string;
    isSaving?: boolean;
  }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Find the label of the currently selected item
    const selectedChoice = selectChoices.find(c => String(c.key) === String(value));
    const displayLabel = selectedChoice ? selectedChoice.label : (isEmptyValue ? EMPTY_LABEL : 'Select...');

    const handleSelect = (key: string) => {
      onUpdate(key || null);
      setIsOpen(false);
    };

    return (
      <div className="relative inline-block w-full">
        {/* Dropdown select box */}
        <button
          type="button"
          disabled={isSaving}
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-3 py-1 text-left border rounded-sm transition-colors cursor-pointer flex justify-between items-center ${isSaving ? 'opacity-50' : ''}`}
          style={selectedColor ? {
            backgroundColor: selectedColor,
            borderColor: selectedColor,
            color: 'white'
          } : {
            backgroundColor: 'white',
            borderColor: '#e2e8f0',
            color: '#1a202c'
          }}
        >
          <span>{displayLabel}</span>
          <span className="ml-2 text-xs">▼</span>
        </button>

        {/* Dropdown menu */}
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg overflow-hidden">
            <div
              onClick={() => handleSelect('')}
              className="px-3 py-1 cursor-pointer hover:brightness-95 text-gray-700 bg-white"
              style={{
                backgroundColor: 'white',
                borderLeft: `4px solid ${hexToRgba('', 0.3)}`
              }}
            >
              {isEmptyValue ? EMPTY_LABEL : 'Select...'}
            </div>

            {selectChoices.map((choice) => (
              <div
                key={choice.key}
                onClick={() => handleSelect(choice.key)}
                className="px-3 py-1 cursor-pointer hover:brightness-150 transition-all text-black"
                style={{
                  // Separate background to avoid parent element color being inherited
                  backgroundColor: choice.color ? hexToRgba(choice.color, 0.3) : 'white',
                  borderLeft: choice.color ? `4px solid ${hexToRgba(choice.color, 0.3)}` : 'none'
                }}
              >
                {choice.label}
              </div>
            ))}
          </div>
        )}

        {/* Close dropdown when user clicks outside */}
        {isOpen && (
          <div 
            className="fixed inset-0 z-0" 
            onClick={() => setIsOpen(false)}
          />
        )}
      </div>
    );
  };

  type SelectOptions = { choices?: string[] } | Record<string, { label: string; color: string }>;

  const selectChoices = useMemo(() => {
    if (field.type === 'single_select' || field.type === 'multi_select' || field.type === 'radio_select') {
      const options = field.options as SelectOptions | null | undefined;

      // Handle format: { optionId: { name: string, color: string } }
      if (options && typeof options === 'object' && !Array.isArray(options)) {
        const hasValidFormat = Object.values(options).some(val =>
          typeof val === 'object' && val !== null && ('name' in val || 'label' in val)
        );

        if (hasValidFormat) {
          return Object.entries(options).map(([key, option]) => {
            const optionData = option as { name?: string; label?: string; color: string };
            return {
              key,
              label: optionData.name || optionData.label || '', // Use name first, fallback to label for compatibility
              color: optionData.color
            };
          });
        }
      }

      // Handle old format: { choices: string[] }
      const choices = (options as { choices?: string[] })?.choices;
      if (Array.isArray(choices)) {
        return choices.map((choice, idx) => ({
          key: choice,
          label: choice,
          color: DEFAULT_CHOICE_COLORS[idx % DEFAULT_CHOICE_COLORS.length]
        }));
      }
    }
    return [];
  }, [field]);
  const choiceColors = useMemo(() => {
    if (field.type !== 'single_select' && field.type !== 'multi_select' && field.type !== 'radio_select') return {} as Record<string, string>;

    const map: Record<string, string> = {};
    selectChoices.forEach((choice) => {
      map[choice.key] = choice.color;
    });
    return map;
  }, [field, selectChoices]);

  const hexToRgba = (hex: string, alpha: number): string => {
    if (!hex) return `rgba(200, 200, 200, ${alpha})`;
    const sanitized = hex.replace('#', '');
    const bigint = parseInt(sanitized, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhone = (phone: string): boolean => {
    // Remove all non-digit characters for validation
    const digitsOnly = phone.replace(/\D/g, '');
    // Accept 10-15 digits (covers most international formats)
    return digitsOnly.length >= 10 && digitsOnly.length <= 15;
  };

  const formatPhone = (phone: string): string => {
    // Remove all non-digit characters
    const digitsOnly = phone.replace(/\D/g, '');

    // Format as US phone number if 10 digits, otherwise return as-is with dashes
    if (digitsOnly.length === 10) {
      return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    } else if (digitsOnly.length === 11 && digitsOnly[0] === '1') {
      return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
    }
    return phone;
  };

  const handleCommit = () => {
    if (field.type === 'number') {
      const num = local.trim() === '' ? null : Number(local);
      onUpdate(Number.isNaN(num as number) ? null : num);
      return;
    }
    if (field.type === 'date') {
      onUpdate(local.trim() === '' ? null : local);
      return;
    }
    if (field.type === 'email') {
      const emailValue = local.trim();
      if (emailValue === '') {
        setEmailError(null);
        onUpdate(null);
        return;
      }
      if (!validateEmail(emailValue)) {
        setEmailError('Please enter a valid email address');
        return;
      }
      setEmailError(null);
      onUpdate(emailValue);
      return;
    }
    if (field.type === 'phone') {
      const phoneValue = local.trim();
      if (phoneValue === '') {
        setPhoneError(null);
        onUpdate(null);
        return;
      }
      if (!validatePhone(phoneValue)) {
        setPhoneError('Please enter a valid phone number (10-15 digits)');
        return;
      }
      setPhoneError(null);
      const formatted = formatPhone(phoneValue);
      setLocal(formatted);
      onUpdate(formatted);
      return;
    }
    if (field.type === 'link') {
      const urlValue = local.trim();
      if (urlValue === '') {
        setLinkError(null);
        onUpdate(null);
        return;
      }
      if (!/^https?:\/\/[^\s$.?#].[^\s]*$/i.test(urlValue)) {
        setLinkError('Please enter a valid URL (must start with http:// or https://)');
        return;
      }
      setLinkError(null);
      onUpdate(urlValue);
      return;
    }
    onUpdate(local);
  };

  const baseInputClass = "w-full px-2 py-1 text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white rounded transition-all disabled:opacity-60";
  const centeredInputClass = baseInputClass + " text-center";

  if (field.type === 'single_select') {
    const selectedColor = value == null ? undefined : choiceColors[String(value)];

    return <SelectDropdown
      value={value}
      onUpdate={onUpdate}
      selectChoices={selectChoices}
      selectedColor={selectedColor}
      isEmptyValue={isEmptyValue}
      EMPTY_LABEL={EMPTY_LABEL}
      isSaving={isSaving}
    />;
  }

  if (field.type === 'multi_select') {
    const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);

    return (
      <div className="w-full min-h-[32px] px-2 py-1 text-center">
        <SelectDropdown
          value={selectedValues.length > 0 ? "" : null}
          onUpdate={(newValue) => {
            if (newValue) {
              const currentValues = Array.isArray(value) ? value : (value ? [value] : []);
              if (!currentValues.includes(newValue)) {
                onUpdate([...currentValues, newValue]);
              }
            }
          }}
          selectChoices={selectChoices}
          isEmptyValue={isEmptyValue}
          EMPTY_LABEL={EMPTY_LABEL}
          isSaving={isSaving}
        />

        {selectedValues.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 justify-center">
            {selectedValues.map((val) => {
              const choice = selectChoices.find(c => c.key === String(val));
              const color = choice?.color || '#6B7280';
              return (
                <span
                  key={val}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded text-white font-medium"
                  style={{ backgroundColor: color }}
                >
                  {choice?.label || String(val)}
                  <button
                    type="button"
                    onClick={() => {
                      const newValues = selectedValues.filter(v => v !== val);
                      onUpdate(newValues.length > 0 ? newValues : null);
                    }}
                    className="ml-1 hover:bg-black/20 rounded-full p-0.5"
                    disabled={isSaving}
                  >
                    <XIcon size={12} />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <div className="flex items-center hover:overflow-hidden hover:w-full">
        <input
          type="date"
          className={`${centeredInputClass} max-w-full [&::-webkit-calendar-picker-indicator]:opacity-0 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
          value={local}
          onChange={(e) => {
            setLocal(e.target.value);
            // Only commit if the day actually changed from the original saved value; the month can be changed while the popup is still open so we don't want to save yet
            // This won't autosave when, for example, the date is changed from 2025-01-01 to 2025-02-01, but this is better than the alternative of it never autosaving
            // The date will still always save when the user clicks elsewhere on the page and defocuses the input box.
            const originalValue = value == null ? "" : String(value);
            const originalDay = originalValue.split('-')[2]; // Extract day from YYYY-MM-DD
            const currentDay = e.target.value.split('-')[2];
            if (currentDay !== originalDay) {
              handleCommit();
            }
          }}
          onBlur={handleCommit}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCommit(); }}
          disabled={isSaving}
          placeholder={isEmptyValue ? EMPTY_LABEL : undefined}
        />
      </div>
    );
  }

  if (field.type === 'datetime') {
    return (
      <div className="flex items-center hover:overflow-hidden hover:w-full">
        <input
          type="datetime-local"
          className={`${centeredInputClass} max-w-full [&::-webkit-calendar-picker-indicator]:opacity-0 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer`}
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCommit(); }}
          disabled={isSaving}
          placeholder={isEmptyValue ? EMPTY_LABEL : undefined}
        />
      </div>
    );
  }

  if (field.type === 'email') {
    return (
      <div className="w-full">
        <input
          type="email"
          className={`${centeredInputClass} ${emailError ? 'focus:ring-red-500 text-red-600' : ''}`}
          value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          if (emailError) setEmailError(null); // Clear error on typing
        }}
        onBlur={handleCommit}
        onKeyDown={(e) => { if (e.key === 'Enter') handleCommit(); }}
        disabled={isSaving}
          placeholder={isEmptyValue ? EMPTY_LABEL : 'Enter email address...'}
        />
        {emailError && (
          <div className="text-xs text-red-600 mt-1 px-3">{emailError}</div>
        )}
      </div>
    );
  }

  if (field.type === 'phone') {
    return (
      <div className="w-full">
        <input
          type="tel"
          className={`${centeredInputClass} ${phoneError ? 'focus:ring-red-500 text-red-600' : ''}`}
          value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          if (phoneError) setPhoneError(null); // Clear error on typing
        }}
        onBlur={handleCommit}
        onKeyDown={(e) => { if (e.key === 'Enter') handleCommit(); }}
        disabled={isSaving}
          placeholder={isEmptyValue ? EMPTY_LABEL : 'Enter phone number...'}
        />
        {phoneError && (
          <div className="text-xs text-red-600 mt-1 px-3">{phoneError}</div>
        )}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    const isChecked = value === true || value === 'true' || value === 1 || value === '1';
    const isCheckboxUnset = value === null || value === undefined || value === '';

    return (
      <div className="flex items-center justify-start h-full">
        <button
          type="button"
          onClick={() => onUpdate(!isChecked)}
          disabled={isSaving}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${isChecked ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isChecked ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        {isCheckboxUnset && (
          <span className="ml-2 text-xs text-gray-400 italic">{EMPTY_LABEL}</span>
        )}
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <input
        type="number"
        className={centeredInputClass}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => { if (e.key === 'Enter') handleCommit(); }}
        disabled={isSaving}
        placeholder={isEmptyValue ? EMPTY_LABEL : "0"}
      />
    );
  }

  // Monetary field - formatted currency input
  if (field.type === 'monetary') {
    const currencyOptions = field.options as { currency?: string; symbol?: string } | null;
    const symbol = currencyOptions?.symbol || '$';

    const formatMonetary = (val: string) => {
      const num = parseFloat(val.replace(/[^\d.-]/g, ''));
      if (isNaN(num)) return '';
      return num.toFixed(2);
    };

    const handleMonetaryCommit = () => {
      const cleanValue = local.replace(/[^\d.-]/g, '');
      const num = parseFloat(cleanValue);
      onUpdate(isNaN(num) ? null : num);
    };

    return (
      <div className="flex items-center w-full">
        <span className="text-gray-500 mr-1">{symbol}</span>
        <input
          type="text"
          className={baseInputClass}
          value={formatMonetary(local)}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={() => {
            setLocal(formatMonetary(local));
            handleMonetaryCommit();
          }}
        onKeyDown={(e) => { 
          if (e.key === 'Enter') {
            setLocal(formatMonetary(local));
            handleMonetaryCommit();
          }
        }}
        disabled={isSaving}
          placeholder={isEmptyValue ? EMPTY_LABEL : "0.00"}
      />
    </div>
    );
  }

  // Radio Select - like single_select but with radio buttons UI
  if (field.type === 'radio_select') {
    return (
      <div className="w-full min-h-[32px] px-2 py-1">
        <div className="flex flex-wrap gap-2">
          {selectChoices.map((choice) => {
            const isSelected = local === choice.key;
            return (
              <label
                key={choice.key}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all ${
                  isSelected 
                    ? 'text-white' 
                    : (!isSaving ? 'text-gray-600 hover:bg-gray-100 cursor-pointer' : 'text-gray-400')
                }`}
                style={isSelected ? { backgroundColor: choice.color } : undefined}
              >
                <input
                  type="radio"
                  name={`radio_${field.id}`}
                  value={choice.key}
                  checked={isSelected}
                  onChange={(e) => {
                    setLocal(choice.key);
                    onUpdate(e.target.value || null);
                  }}
                  disabled={isSaving}
                  className="sr-only"
                />
                <span 
                  className={`w-3 h-3 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'border-white' : 'border-gray-400'
                  }`}
                >
                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                </span>
                {choice.label}
              </label>
            );
          })}
        </div>
        {isEmptyValue && (
          <div className="text-xs text-gray-400 italic mt-1">{EMPTY_LABEL}</div>
        )}
      </div>
    );
  }

  // Link type - this is here for data validation
  if (field.type === 'link') {
    const handleLinkClick = (e: React.MouseEvent<HTMLInputElement>) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (local && /^https?:\/\/[^\s$.?#].[^\s]*$/i.test(local)) {
          window.open(local, '_blank');
        }
      }
    };

    return (
      <div className="w-full">
        <input
          type="url"
          title={local ? 'Ctrl+Click to open link in new tab' : undefined}
          className={`${centeredInputClass} ${linkError ? 'focus:ring-red-500 text-red-600' : ''} ${local && /^https?:\/\/[^\s$.?#].[^\s]*$/i.test(local) ? 'cursor-pointer' : ''}`}
          value={local}
          onChange={(e) => {
            setLocal(e.target.value);
            if (linkError) setLinkError(null); // Clear error on typing
          }}
          onBlur={handleCommit}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCommit(); }}
          onClick={handleLinkClick}
          disabled={isSaving}
          placeholder={isEmptyValue ? EMPTY_LABEL : 'Enter URL...'}
        />
        {linkError && (
          <div className="text-xs text-red-600 mt-1 px-3">{linkError}</div>
        )}
      </div>
    )
  }

  // Long text - always renders as textarea
  if (field.type === 'long_text') {
    return (
      <textarea
        className={`${baseInputClass} resize-none min-h-[60px] max-h-[120px] overflow-y-auto`}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => { 
          // Allow Enter for new lines in textarea, Ctrl+Enter or Cmd+Enter to commit
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleCommit();
          }
        }}
        disabled={isSaving}
        placeholder={isEmptyValue ? EMPTY_LABEL : "Enter text..."}
        rows={Math.min(5, Math.max(2, (local.match(/\n/g) || []).length + 1))}
      />
    );
  }

  // default: text
  // Check if the value contains newlines (multi-line text or text box list from GHL)
  const isMultiLine = typeof value === 'string' && value.includes('\n');
  
  if (isMultiLine) {
    return (
      <textarea
        className={`${baseInputClass} resize-none min-h-[60px] max-h-[120px] overflow-y-auto`}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => { 
          // Allow Enter for new lines in textarea, Ctrl+Enter or Cmd+Enter to commit
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleCommit();
          }
        }}
        disabled={isSaving}
        placeholder={isEmptyValue ? EMPTY_LABEL : "Enter text..."}
        rows={Math.min(5, (local.match(/\n/g) || []).length + 1)}
      />
    );
  }
  
  return (
    <input
      type="text"
      className={centeredInputClass}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={handleCommit}
      onKeyDown={(e) => { if (e.key === 'Enter') handleCommit(); }}
      disabled={isSaving}
      placeholder={isEmptyValue ? EMPTY_LABEL : "Enter text..."}
    />
  );
}
