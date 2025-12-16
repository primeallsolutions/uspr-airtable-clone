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

