# Document Management System - Implementation Guide

**Purpose:** Developer-facing implementation reference for APIs, schemas, services, and component locations.

---

## Table of Contents

1. [API Reference](#api-reference)
2. [Database Schema](#database-schema)
3. [Key Services](#key-services)
4. [Component Map](#component-map)
5. [Path Conventions](#path-conventions)

---

## API Reference

### Document APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/documents/signed-url` | Get signed URL for document access (supports base/table/record scoping) |
| POST | `/api/documents/upload` | Single file upload |
| POST | `/api/documents/batch` | Batch file upload |
| POST | `/api/documents/thumbnail` | Generate document thumbnail |
| POST | `/api/documents/split` | Split PDF into pages |
| POST | `/api/documents/merge` | Merge multiple PDFs |

**Signed URL API Query Parameters:**
- `path` (required): Storage path to document
- `baseId` (required): Base ID
- `tableId` (optional): Table ID
- `recordId` (optional): Record ID (for record-scoped documents)
- `expiresIn` (optional): Expiration in seconds (validated)

### Template APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/templates` | List templates (query: baseId, tableId) |
| POST | `/api/templates` | Create template (FormData: baseId, tableId, name, description, file) |
| GET | `/api/templates/[id]` | Get template |
| PATCH | `/api/templates/[id]` | Update template |
| DELETE | `/api/templates` | Delete template (query: templateId, baseId, tableId) |
| GET | `/api/templates/[id]/signed-url` | Get template PDF signed URL |
| GET | `/api/templates/[id]/fields` | Get template fields |
| POST | `/api/templates/[id]/fields` | Create/update field |
| DELETE | `/api/templates/[id]/fields` | Delete field |
| POST | `/api/templates/generate` | Generate document from template |

**Generate Request Body:**
```json
{
  "templateId": "uuid",
  "baseId": "uuid",
  "tableId": "uuid",
  "fieldValues": { "field_key": "value" },
  "outputFileName": "name.pdf",
  "skipSignatureRequest": false
}
```

**Generate Response:**
```json
{
  "success": true,
  "pdf": "base64_encoded_pdf",
  "fileName": "name.pdf"
}
```

### E-Signature APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/esignature/requests` | List requests (query: baseId, tableId, recordId) |
| POST | `/api/esignature/requests` | Create request |
| GET | `/api/esignature/requests/[id]` | Get request |
| PATCH | `/api/esignature/requests/[id]` | Update request |
| DELETE | `/api/esignature/requests/[id]` | Cancel request |
| POST | `/api/esignature/requests/[id]/send` | Send to signers |
| GET | `/api/esignature/requests/[id]/view` | Get signed document view URL |
| GET | `/api/esignature/requests/[id]/versions` | Get version history |
| POST | `/api/esignature/requests/[id]/versions` | Create version |
| GET | `/api/esignature/requests/[id]/pack` | Get pack items |
| POST | `/api/esignature/requests/[id]/pack` | Add to pack |
| POST | `/api/esignature/requests/[id]/pack/merge` | Merge pack PDFs |
| GET | `/api/esignature/sign/[token]` | Get signing page data |
| POST | `/api/esignature/sign/[token]` | Submit signature |
| POST | `/api/esignature/webhook` | Webhook handler |

---

## Database Schema

### document_folders

```sql
- id (uuid, PK)
- base_id (uuid, FK → bases)
- table_id (uuid, FK → tables)
- name (text)
- path (text)
- parent_path (text, nullable)
- created_by (uuid, FK → profiles)
- created_at (timestamp)
```

### document_templates

```sql
- id (uuid, PK)
- base_id (uuid, FK → bases)
- table_id (uuid, FK → tables, nullable)
- name (text)
- description (text, nullable)
- template_file_path (text)
- created_by (uuid, FK → profiles, nullable)
- created_at, updated_at (timestamp)
```

### template_fields

```sql
- id (uuid, PK)
- template_id (uuid, FK → document_templates)
- field_name, field_key, field_type (text)
- page_number (integer)
- x_position, y_position, width, height (numeric)
- font_size (default 12), font_name (default 'Helvetica')
- is_required (boolean), default_value (text)
- requires_esignature, esignature_signer_email, esignature_signer_name, esignature_signer_role, esignature_sign_order
- order_index, created_at, updated_at
```

### document_locks (Migration 030)

```sql
CREATE TABLE document_locks (
    id UUID PRIMARY KEY,
    document_path TEXT NOT NULL,
    base_id UUID REFERENCES bases(id),
    locked_by UUID REFERENCES auth.users(id),
    locked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    lock_type TEXT CHECK (lock_type IN ('edit', 'signature', 'exclusive')),
    metadata JSONB
);
```

**Functions:** `acquire_document_lock`, `release_document_lock`, `check_document_lock`, `force_release_document_lock`, `cleanup_expired_document_locks`

### document_search_index (Migration 031)

```sql
CREATE TABLE document_search_index (
    id UUID PRIMARY KEY,
    document_path TEXT NOT NULL,
    base_id UUID REFERENCES bases(id),
    table_id UUID,
    record_id UUID,
    file_name TEXT,
    mime_type TEXT,
    file_size BIGINT,
    content_text TEXT,
    search_vector TSVECTOR,
    indexed_at TIMESTAMPTZ
);
```

**Functions:** `search_documents`, `search_documents_with_highlights`, `get_document_search_suggestions`, `index_document`, `remove_document_from_index`

### E-Signature Tables

- **signature_requests:** Main requests with status, document_path, record_id
- **signature_request_signers:** Signers with email, name, role, sign_order, status, access_token
- **signature_fields:** Field positions (x, y, width, height, type)
- **signature_versions:** Version history
- **signature_request_pack_items:** Pack document order

---

## Key Services

### DocumentLockService (`lib/services/document-lock-service.ts`)

```typescript
static async acquireLock(documentPath, baseId, lockType, durationMinutes): Promise<LockAcquisitionResult>
static async releaseLock(documentPath, baseId): Promise<{ success, message }>
static async checkLockStatus(documentPath, baseId): Promise<LockStatus>
static async forceReleaseLock(documentPath, baseId): Promise<{ success, message }>
static subscribeLockChanges(documentPath, baseId, callback): () => void
static async releaseAllLocks(baseId?): Promise<void>
```

### DocumentSearchService (`lib/services/document-search-service.ts`)

```typescript
static async search(baseId, query, options): Promise<SearchResult[]>
static async getSuggestions(baseId, prefix, limit): Promise<SearchSuggestion[]>
static async indexDocument(params): Promise<string | null>
static async indexPdfDocument(params): Promise<string | null>
static async batchIndex(baseId, documents, onProgress): Promise<{ success, failed }>
static async isIndexed(documentPath, baseId): Promise<boolean>
static async getIndexStats(baseId): Promise<IndexStats>
```

### DocumentsService (`lib/services/documents-service.ts`)

- CRUD for documents and folders
- Signed URL generation
- Path construction for base/table/record scope

### ESignatureService (`lib/services/esign-service.ts`)

- `listSignatureRequests(baseId, tableId?, client?, recordId?)` - supports record filtering
- Create, update, send, sign, versions, pack

### TemplateService (`lib/services/template-service.ts`)

- Template CRUD, field CRUD
- `hasActiveSignatureFields()`, `getActiveSignatureFields()`

---

## Component Map

### Documents View

| Component | Location | Purpose |
|-----------|----------|---------|
| DocumentsView | `components/base-detail/DocumentsView.tsx` | Main DMS container |
| DocumentsHeader | `components/base-detail/documents/DocumentsHeader.tsx` | Header with actions |
| DocumentsSidebar | `components/base-detail/documents/DocumentsSidebar.tsx` | Folder tree, drag-drop |
| DocumentsList | `components/base-detail/documents/DocumentsList.tsx` | Document grid/list |
| RecordDocuments | `components/base-detail/documents/RecordDocuments.tsx` | Record-scoped documents tab |

### PDF Editor (Modular)

| Component | Location |
|-----------|----------|
| PdfEditor | `components/base-detail/documents/pdf-editor/index.tsx` |
| PageCanvas | `pdf-editor/components/PageCanvas.tsx` |
| Toolbar | `pdf-editor/components/Toolbar.tsx` |
| Thumbnails | `pdf-editor/components/Thumbnails.tsx` |
| SignerPanel | `pdf-editor/components/SignerPanel.tsx` |

### Signature Request

| Component | Location |
|-----------|----------|
| SignatureRequestModal | `components/base-detail/documents/SignatureRequestModal.tsx` |
| SignerManager | `components/base-detail/documents/signature-request/SignerManager.tsx` |
| SignatureFieldPlacer | `components/base-detail/documents/signature-request/SignatureFieldPlacer.tsx` |
| StatusColumnConfig | `components/base-detail/documents/signature-request/StatusColumnConfig.tsx` |
| EmbeddedSigningUI | `components/base-detail/documents/EmbeddedSigningUI.tsx` |
| SignatureRequestStatus | `components/base-detail/documents/SignatureRequestStatus.tsx` |

### Templates

| Component | Location |
|-----------|----------|
| TemplateManagementModal | `components/base-detail/documents/TemplateManagementModal.tsx` |
| TemplateFieldEditor | `components/base-detail/documents/TemplateFieldEditor.tsx` |
| DocumentGeneratorForm | `components/base-detail/documents/DocumentGeneratorForm.tsx` |

### UI Helpers

| Component | Location |
|-----------|----------|
| PostActionPrompt | `components/base-detail/documents/PostActionPrompt.tsx` |
| KeyboardShortcutsPanel | `components/base-detail/documents/KeyboardShortcutsPanel.tsx` |
| DocumentStatusBadge | `components/base-detail/documents/DocumentStatusBadge.tsx` |
| FeatureHint | `components/base-detail/documents/FeatureHint.tsx` |

---

## Path Conventions

### Storage Path Structure

**Base scope:** `bases/{baseId}/`
**Table scope:** `bases/{baseId}/tables/{tableId}/`
**Record scope:** `bases/{baseId}/records/{recordId}/`

### Path Construction (Signed URL API)

```typescript
const basePrefix = (baseId, tableId, recordId) => {
  if (recordId) {
    return `bases/${baseId}/records/${recordId}/`;
  }
  return tableId ? `bases/${baseId}/tables/${tableId}/` : `bases/${baseId}/`;
};
```

### Record-Scoped Behavior

- `SignatureRequestStatus` accepts `recordId` and filters requests by record
- API `/api/esignature/requests` accepts `recordId` query param
- `ESignatureService.listSignatureRequests()` filters by `record_id` when provided
- Ensure `recordId` is passed from DocumentsView when in record context
