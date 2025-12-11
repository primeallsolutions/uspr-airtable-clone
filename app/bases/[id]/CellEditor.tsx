"use client";
import { useMemo, useState, useEffect } from "react";
import type { FieldRow } from "@/lib/types/base-detail";

const DEFAULT_CHOICE_COLORS = ['#1E40AF', '#C2410C', '#B91C1C']; // dark blue, dark orange, dark red

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
  
  // Sync local state when value prop changes (e.g., after sync from GHL)
  useEffect(() => {
    setLocal(value == null ? "" : String(value));
  }, [value]);

  type SelectOptions = { choices?: string[] } | Record<string, { label: string; color: string }>;

  const selectChoices = useMemo(() => {
    if (field.type === 'single_select' || field.type === 'multi_select') {
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
    if (field.type !== 'single_select' && field.type !== 'multi_select') return {} as Record<string, string>;

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
    onUpdate(local);
  };

  const baseInputClass = "w-full px-2 py-1 text-sm border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white rounded transition-all disabled:opacity-60";
  const centeredInputClass = baseInputClass + " text-center";

  if (field.type === 'single_select') {
    const selectedColor = value == null ? undefined : choiceColors[String(value)];

    return (
      <select
        className={`${centeredInputClass} cursor-pointer rounded-sm`}
        value={value == null ? '' : String(value)}
        onChange={(e) => onUpdate(e.target.value || null)}
        disabled={isSaving}
        style={selectedColor ? {
          backgroundColor: selectedColor,
          borderColor: selectedColor,
          color: 'white'
        } : undefined}
      >
        <option value="">Select...</option>
        {selectChoices.map((choice) => (
          <option
            key={choice.key}
            value={choice.key}
            style={{ backgroundColor: hexToRgba(choice.color, 0.18) }}
          >
            {choice.label}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'multi_select') {
    const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);

    return (
      <div className="w-full min-h-[32px] px-2 py-1 text-center">
        <select
          className={`${centeredInputClass} cursor-pointer rounded-sm`}
          value=""
          onChange={(e) => {
            const newValue = e.target.value;
            if (newValue) {
              const currentValues = Array.isArray(value) ? value : (value ? [value] : []);
              if (!currentValues.includes(newValue)) {
                onUpdate([...currentValues, newValue]);
              }
            }
          }}
          disabled={isSaving}
        >
          <option value="">Add option...</option>
          {selectChoices.map((choice) => (
            <option
              key={choice.key}
              value={choice.key}
              style={{ backgroundColor: hexToRgba(choice.color, 0.18) }}
            >
              {choice.label}
            </option>
          ))}
        </select>

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
                    ×
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
      <input
        type="date"
        className={centeredInputClass}
        value={value == null ? '' : String(value)}
        onChange={(e) => onUpdate(e.target.value || null)}
        disabled={isSaving}
      />
    );
  }

  if (field.type === 'datetime') {
    return (
      <input
        type="datetime-local"
        className={centeredInputClass}
        value={value == null ? '' : String(value)}
        onChange={(e) => onUpdate(e.target.value || null)}
        disabled={isSaving}
      />
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
          placeholder="Enter email address..."
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
          placeholder="Enter phone number..."
        />
        {phoneError && (
          <div className="text-xs text-red-600 mt-1 px-3">{phoneError}</div>
        )}
      </div>
    );
  }

  if (field.type === 'checkbox') {
    const isChecked = value === true || value === 'true' || value === 1 || value === '1';

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
      </div>
    );
  }

  if (field.type === 'number') {
    return (
      <input
        type="number"
        className={centeredInputClass}
        value={value == null ? '' : String(value)}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => { if (e.key === 'Enter') handleCommit(); }}
        disabled={isSaving}
        placeholder="0"
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
        placeholder="Enter text..."
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
      placeholder="Enter text..."
    />
  );
}


