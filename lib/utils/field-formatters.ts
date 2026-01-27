/**
 * Field formatting utilities for template fields
 */

export type FormattingOptions = {
  textCase?: "uppercase" | "lowercase" | "title";
  numberFormat?: "currency" | "percentage" | "decimal" | "integer";
  currencySymbol?: string;
  decimalPlaces?: number;
  dateFormat?: string;
  inputMask?: string;
};

/**
 * Format a field value based on formatting options
 */
export function formatFieldValue(
  value: any,
  options: FormattingOptions = {}
): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  let formatted = String(value);

  // Text case formatting
  if (options.textCase) {
    switch (options.textCase) {
      case "uppercase":
        formatted = formatted.toUpperCase();
        break;
      case "lowercase":
        formatted = formatted.toLowerCase();
        break;
      case "title":
        formatted = formatted.replace(/\w\S*/g, (txt) => {
          return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
        break;
    }
  }

  // Number formatting
  if (options.numberFormat && !isNaN(parseFloat(formatted))) {
    const numValue = parseFloat(formatted);
    const decimals = options.decimalPlaces ?? 2;

    switch (options.numberFormat) {
      case "currency":
        const symbol = options.currencySymbol || "$";
        formatted = `${symbol}${numValue.toFixed(decimals)}`;
        break;
      case "percentage":
        formatted = `${(numValue * 100).toFixed(decimals)}%`;
        break;
      case "decimal":
        formatted = numValue.toFixed(decimals);
        break;
      case "integer":
        formatted = Math.round(numValue).toString();
        break;
    }
  }

  // Date formatting
  if (options.dateFormat && value instanceof Date) {
    // Handle date formatting (simplified - could use date-fns or similar)
    const date = value as Date;
    formatted = date.toLocaleDateString();
  }

  return formatted;
}

/**
 * Apply input mask to a value
 */
export function applyInputMask(value: string, mask: string): string {
  if (!mask || !value) return value;

  // Simple mask implementation
  // Supports: # (digit), A (letter), * (any)
  let masked = "";
  let valueIndex = 0;

  for (let i = 0; i < mask.length && valueIndex < value.length; i++) {
    const maskChar = mask[i];
    const valueChar = value[valueIndex];

    if (maskChar === "#") {
      if (/\d/.test(valueChar)) {
        masked += valueChar;
        valueIndex++;
      } else {
        break; // Invalid character
      }
    } else if (maskChar === "A") {
      if (/[a-zA-Z]/.test(valueChar)) {
        masked += valueChar;
        valueIndex++;
      } else {
        break; // Invalid character
      }
    } else if (maskChar === "*") {
      masked += valueChar;
      valueIndex++;
    } else {
      // Literal character in mask
      masked += maskChar;
      if (maskChar === valueChar) {
        valueIndex++;
      }
    }
  }

  return masked;
}

/**
 * Common input masks
 */
export const InputMasks = {
  phone: "(###) ###-####",
  ssn: "###-##-####",
  zipCode: "#####-####",
  date: "##/##/####",
  time: "##:##",
};















