# Document Management System - Features and Architecture

**Last Updated:** February 2025  
**Version:** 2.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Document Upload and Organization](#document-upload-and-organization)
3. [PDF Editor](#pdf-editor)
4. [Template Generator](#template-generator)
5. [E-Signature System](#e-signature-system)
6. [Document Lock and Search Services](#document-lock-and-search-services)
7. [Technical Architecture](#technical-architecture)
8. [Gaps and Roadmap](#gaps-and-roadmap)

---

## Executive Summary

The Document Management System (DMS) is a comprehensive solution built on Next.js, Supabase, and React. It provides document storage, organization, editing, e-signature workflows, template-based document generation, document locking, and full-text search. The system is production-ready for core functionality.

**Overall Status:** ~85% Complete

- **Fully Implemented:** Document upload, folder organization, drag-and-drop (files and folders), modular PDF editing, e-signatures, merge/pack, template generation, document locking, full-text document search
- **Partially Implemented:** Version history (signatures and documents), document sharing (base-level only)
- **Not Implemented:** Email upload, granular document/folder sharing permissions

---

## Document Upload and Organization

### Upload Capability

**Status:** Fully Implemented  
**Location:** `components/base-detail/DocumentsView.tsx`, `lib/services/documents-service.ts`, `app/api/documents/upload/route.ts`, `app/api/documents/batch/route.ts`

**Features:**
- Single file upload via file picker
- Multiple file upload (batch processing)
- File validation (size limits 100MB max, empty files)
- Progress tracking for batch uploads
- Concurrent uploads (3 files at a time)
- Error handling per file (continues on failure)
- New batch upload API (`/api/documents/batch`)
- New single upload API (`/api/documents/upload`)

**Limitations:**
- No file type restrictions (accepts all file types)
- No virus scanning
- No duplicate file detection

### Drag-and-Drop Interface

**Status:** Fully Implemented

**File Upload:**
- Visual drag-over feedback in DocumentsView
- Drag-and-drop zone highlighting
- Supports multiple files
- Works with folder navigation

**Folder and Document Reorganization (Feb 2025):**
- **Folder drag-and-drop:** Reorganize folder hierarchy by dragging folders
- **Document move:** Drag documents between folders
- **Visual feedback:** Drag handles with grip icon, highlighted drop targets, animated transitions, "Drop to move" indicator
- **DocumentsList:** Documents can be dragged to folders in the sidebar; grid view supports drag operations
- **Path structure:** Supports base-scoped, table-scoped, and record-scoped document paths

### Folder Organization

**Status:** Fully Implemented  
**Location:** `components/base-detail/DocumentsView.tsx`, `components/base-detail/documents/DocumentsSidebar.tsx`, `lib/services/documents-service.ts`

**Default Folders:** Contract, Buyer docs, Seller docs, HOA, Lender docs, Title, Inspection, Appraisal, Insurance, Closing

**Features:**
- Hierarchical folder structure
- Create/rename/delete folders
- Folder metadata in database (`document_folders` table)
- Recursive folder operations
- Folder navigation sidebar
- Default folders auto-created on first load

**Limitations:**
- Default folders are hardcoded (real estate specific)
- No folder permissions/access control
- No folder-level sharing

---

## PDF Editor

The PDF editor was refactored in February 2025 into a **modular component architecture**. The previous monolithic `PdfEditor.tsx` was replaced with a structured module.

### Component Structure

```
components/base-detail/documents/pdf-editor/
├── index.tsx              # Main PdfEditor component
├── types.ts               # TypeScript definitions
├── components/
│   ├── PageCanvas.tsx     # PDF page rendering with annotations
│   ├── Toolbar.tsx        # Editor toolbar with tools
│   ├── StatusBar.tsx      # Status indicators
│   ├── Thumbnails.tsx     # Page thumbnail navigation
│   ├── TextEditOverlay.tsx # Text editing overlay
│   └── SignerPanel.tsx    # Signer management panel
├── hooks/
│   ├── useAnnotationStore.ts  # Annotation state management
│   ├── usePdfLoader.ts       # PDF loading logic
│   └── usePdfPage.ts         # Page rendering hook
└── utils/
    ├── coordinates.ts     # Coordinate transformation utilities
    └── pdf-save.ts        # PDF save/export utilities
```

### Features

**Viewing and Navigation:**
- Native PDF rendering using pdfjs-dist
- Multi-page support with thumbnail sidebar
- Zoom controls, page navigation (prev/next, direct thumbnail selection)
- Pan tool for navigating large documents

**Tools:**
- Select tool (move text and annotation blocks)
- Pan tool (navigate viewport)
- Highlight tool (yellow transparent overlays)
- Text annotation tool
- Text editing tool (edit existing PDF text)
- Signature, initials, and date fields

**Annotations:**
- Highlight, text, signature annotations
- Content block outlines (optional): green (text), blue (annotations), red (other)
- Drag-and-drop repositioning of content blocks
- Signature image caching for performance

**Keyboard Shortcuts:**
- `V` - Select tool
- `T` - Text tool
- `H` - Highlight tool
- `P` - Pan tool
- `F` - Signature field
- `I` - Initials field
- `D` - Date field
- `Ctrl+S` - Save
- `Ctrl+Z` / `Ctrl+Y` - Undo/Redo
- `Tab` - Cycle through signature fields
- `PageUp` / `PageDown` - Page navigation
- `?` - Toggle keyboard shortcuts panel

**Implementation Notes:**
- Uses pdfjs-dist for rendering and pdf-lib for modification
- Canvas null reference guards prevent render crashes
- isDragging guards prevent re-render spam during drag
- Dual-canvas approach: main canvas for PDF, overlay for annotations

---

## Template Generator

**Status:** Fully Implemented  
**Locations:** `components/base-detail/documents/TemplateManagementModal.tsx`, `TemplateFieldEditor.tsx`, `DocumentGeneratorForm.tsx`, `app/api/templates/generate/route.ts`

### Template Management

- Upload PDF templates with name and description
- List all templates for a base/table
- Delete templates with confirmation
- Template selection for generation and signature requests

### Template Field Definition

**Field Types:** text, number, date, checkbox, signature

**Features:**
- Click-to-place and drag-to-move field placement
- Resize handles for fields
- Snap-to-grid option
- Field validation rules and formatting options
- Coordinate mapping (X, Y, width, height)
- Font customization (size, name)
- Required field flag and default values
- Signature image capture and embedding

### Document Generation

- Server-side PDF generation using pdf-lib
- Field value mapping and filling
- Text wrapping for overflow
- Checkbox rendering (✓ mark)
- Date formatting
- Signature image embedding
- Auto-upload to storage after generation

### Limitations

- No template preview before generation
- No batch generation from table rows
- No table data auto-population
- No alignment guides during field placement

---

## E-Signature System

**Status:** Fully Implemented  
**Locations:** `lib/services/esign-service.ts`, `components/base-detail/documents/SignatureRequestModal.tsx`, `EmbeddedSigningUI.tsx`, `app/sign/[token]/page.tsx`

### Workflow

1. **Create Request:** Admin selects template or document, adds signers, places signature fields
2. **Send:** Email notifications with signing links (Nodemailer/Gmail)
3. **Sign:** Token-based embedded signing UI (no login required)
4. **Complete:** Version history, merge/pack, completion certificate

### Signer Management

**Components:**
- SignerManager: Add, remove, edit signers; roles (signer, viewer, approver); sign order (sequential/parallel)
- SignatureFieldPlacer: Click-to-place signature fields on PDF preview
- StatusColumnConfig: Map signature statuses to record field values
- SignerPanel: Integrated in PDF editor for adding signers and sending requests without leaving the editor

### Features

- Multi-signer workflows (sequential and parallel)
- Template-based signature requests (filters templates with `hasActiveSignatureFields`)
- Signature capture: draw and type modes (Dancing Script font)
- Signature field types: signature, initials, date
- Version history (signature_versions table)
- Merge and pack documents
- Completion certificate generation
- View signed documents
- Success page after signing
- Record-scoped filtering (signature requests filtered by recordId when in record context)

### Security

- Unique 32-byte hex access tokens per signer
- RLS policies
- Token-based signing (no auth required for signers)
- Optional expiration dates
- Completion certificate embedded in final PDF

---

## Document Lock and Search Services

### Document Lock Service

**Status:** Fully Implemented (Feb 2025)  
**Location:** `lib/services/document-lock-service.ts`, `supabase/migrations/030_add_document_locks.sql`

**Purpose:** Prevents concurrent editing conflicts.

**Features:**
- Lock types: edit, signature, exclusive
- Auto-refresh before expiration
- Real-time subscriptions via Supabase Realtime
- Force release (admin)
- `useDocumentLock` React hook

### Document Search Service

**Status:** Fully Implemented (Feb 2025)  
**Location:** `lib/services/document-search-service.ts`, `supabase/migrations/031_add_document_search.sql`

**Features:**
- PostgreSQL full-text search
- Search with highlighted previews
- Autocomplete suggestions
- Filter by table, MIME type
- Client-side PDF text extraction (pdf.js)
- Batch indexing with progress

---

## Technical Architecture

### Technology Stack

| Layer        | Technology                                      |
|-------------|--------------------------------------------------|
| Framework   | Next.js 16 (App Router, Turbopack)              |
| UI          | React 19, Tailwind CSS 4, Lucide icons          |
| Database    | Supabase (PostgreSQL + Storage + Auth)          |
| State       | React hooks, Zustand                             |
| PDF         | pdf-lib, pdfjs-dist                              |
| Email       | Nodemailer (Gmail)                               |

### Key Services

- **DocumentsService** (`lib/services/documents-service.ts`): Document CRUD, folder management, signed URLs
- **ESignatureService** (`lib/services/esign-service.ts`): Signature requests, signers, fields, versions, pack
- **TemplateService** (`lib/services/template-service.ts`): Templates, fields, active signature field checking
- **EmailService** (`lib/services/email-service.ts`): Email sending, HTML templates
- **DocumentLockService** (`lib/services/document-lock-service.ts`): Lock acquisition, release, subscriptions
- **DocumentSearchService** (`lib/services/document-search-service.ts`): Full-text search, indexing

### Path Conventions

Documents can be scoped at three levels:
- **Base:** `bases/{baseId}/`
- **Table:** `bases/{baseId}/tables/{tableId}/`
- **Record:** `bases/{baseId}/records/{recordId}/`

The signed URL API (`/api/documents/signed-url`) handles all path types with proper authorization.

---

## Gaps and Roadmap

### High Priority (Not Implemented)

1. **Email Upload:** Email forwarding endpoint, attachment extraction, automatic upload from emails
2. **Granular Sharing:** Document-level and folder-level sharing, permission types (view/download/edit/delete), link expiration, password protection
3. **Document Version History (general):** Version tracking for non-signature documents, version comparison UI, rollback

### Medium Priority

4. **Bulk Operations:** Multi-select documents, bulk delete, bulk move, bulk download
5. **Document Sorting:** Sort by name, date, size, type
6. **Advanced Search:** Full-text search is implemented; additional metadata filters
7. **Audit Log UI:** Document operation logging, audit log viewer, export

### Low Priority

8. **Configurable Default Folders:** Make folders configurable per base/table
9. **File Size Limits:** Configurable per base or user role
10. **Accessibility:** ARIA labels, keyboard navigation

---

**Document Version:** 2.0  
**Last Reviewed:** February 2025
