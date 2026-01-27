/**
 * Field validation utilities for template fields
 */

export type ValidationRule = {
  type: "minLength" | "maxLength" | "pattern" | "min" | "max" | "required";
  value?: string | number;
  message?: string;
};

export type ValidationResult = {
  isValid: boolean;
  error?: string;
};

/**
 * Validate a field value against validation rules
 */
export function validateField(
  value: any,
  rules: ValidationRule[] = []
): ValidationResult {
  // Empty value check
  if (value === null || value === undefined || value === "") {
    const requiredRule = rules.find((r) => r.type === "required");
    if (requiredRule) {
      return {
        isValid: false,
        error: requiredRule.message || "This field is required",
      };
    }
    return { isValid: true }; // Empty is valid if not required
  }

  const stringValue = String(value);

  for (const rule of rules) {
    switch (rule.type) {
      case "minLength":
        if (stringValue.length < (rule.value as number)) {
          return {
            isValid: false,
            error: rule.message || `Minimum length is ${rule.value} characters`,
          };
        }
        break;

      case "maxLength":
        if (stringValue.length > (rule.value as number)) {
          return {
            isValid: false,
            error: rule.message || `Maximum length is ${rule.value} characters`,
          };
        }
        break;

      case "pattern":
        if (rule.value) {
          const regex = new RegExp(rule.value as string);
          if (!regex.test(stringValue)) {
            return {
              isValid: false,
              error: rule.message || "Invalid format",
            };
          }
        }
        break;

      case "min":
        const numValue = parseFloat(stringValue);
        if (!isNaN(numValue) && numValue < (rule.value as number)) {
          return {
            isValid: false,
            error: rule.message || `Minimum value is ${rule.value}`,
          };
        }
        break;

      case "max":
        const numValueMax = parseFloat(stringValue);
        if (!isNaN(numValueMax) && numValueMax > (rule.value as number)) {
          return {
            isValid: false,
            error: rule.message || `Maximum value is ${rule.value}`,
          };
        }
        break;
    }
  }

  return { isValid: true };
}

/**
 * Common validation patterns
 */
export const ValidationPatterns = {
  email: {
    pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
    message: "Invalid email address",
  },
  phone: {
    pattern: "^[\\d\\s\\-\\(\\)\\+]+$",
    message: "Invalid phone number",
  },
  ssn: {
    pattern: "^\\d{3}-\\d{2}-\\d{4}$",
    message: "Invalid SSN format (XXX-XX-XXXX)",
  },
  zipCode: {
    pattern: "^\\d{5}(-\\d{4})?$",
    message: "Invalid ZIP code",
  },
  url: {
    pattern: "^https?://.+",
    message: "Invalid URL",
  },
};















