import type { ContextMenuOption } from "@/components/ui/context-menu";
import type { BaseRecord } from "../types/dashboard";

interface ContextMenuActions {
  onOpen: (baseId: string) => void;
  onRename: (base: BaseRecord) => void;
  onToggleStar: (base: BaseRecord) => void;
  onDuplicate: (base: BaseRecord) => void;
  onSaveAsTemplate?: (base: BaseRecord) => void;
  onDelete: (base: BaseRecord) => void;
}

export const getBaseContextMenuOptions = (
  base: BaseRecord, 
  actions: ContextMenuActions
): ContextMenuOption[] => [
  {
    id: "open",
    label: "Open",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    ),
    onClick: () => actions.onOpen(base.id),
  },
  {
    id: "rename",
    label: "Rename",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    onClick: () => actions.onRename(base),
  },
  {
    id: "duplicate",
    label: "Duplicate",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    onClick: () => actions.onDuplicate(base),
  },
  ...(actions.onSaveAsTemplate ? [{
    id: "save-as-template",
    label: "Save as Template",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
    onClick: () => actions.onSaveAsTemplate!(base),
  }] : []),
  {
    id: "delete",
    label: "Delete",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="red" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    onClick: () => actions.onDelete(base),
    separator: true,
  },
];
