import type { StoredDocument } from "@/lib/services/documents-service";

export const formatSize = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const isText = (type: string) => type.startsWith("text/") || type == "application/json";
export const isImage = (type: string) => type.startsWith("image/");
export const isPdf = (type: string) => type === "application/pdf" || type.includes("pdf");

export const isFolder = (doc: StoredDocument): boolean => {
  return (
    doc.path.endsWith("/.keep") ||
    doc.path.endsWith(".keep") ||
    doc.path.endsWith("/") ||
    doc.path.includes("/.keep")
  );
};

/**
 * Validates a file name for use in document operations.
 * Returns an error message string, or null if valid.
 */
export const validateFileName = (name: string): string | null => {
  const trimmed = name.trim();

  if (!trimmed) {
    return "File name is required";
  }

  if (trimmed.length > 255) {
    return "File name must be 255 characters or less";
  }

  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
  if (invalidChars.test(trimmed)) {
    return "File name contains invalid characters";
  }

  const reservedNames = [
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
  ];
  const nameWithoutExt = trimmed.split(".")[0].toUpperCase();
  if (reservedNames.includes(nameWithoutExt)) {
    return "File name is reserved and cannot be used";
  }

  if (trimmed.startsWith(".") || (trimmed.endsWith(".") && !trimmed.match(/\.[^.]+$/))) {
    return "File name cannot start or end with a dot";
  }

  if (name !== trimmed) {
    return "File name cannot start or end with spaces";
  }

  const parts = trimmed.split(".");
  if (parts.length > 1 && parts[0].trim() === "") {
    return "File name must have a name before the extension";
  }

  return null;
};

