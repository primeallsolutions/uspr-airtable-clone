# Document Management System (DMS) Documentation

This directory contains consolidated documentation for the Document Management System.

---

## Documentation Index

| Document | Purpose | Audience |
|----------|---------|----------|
| [DMS Features and Architecture](./DMS_FEATURES_AND_ARCHITECTURE.md) | System overview, feature list, architecture, gaps | Developers, PMs |
| [DMS Implementation Guide](./DMS_IMPLEMENTATION_GUIDE.md) | API reference, database schema, services, component map | Developers |
| [DMS Setup and Operations](./DMS_SETUP_AND_OPERATIONS.md) | Environment variables, email setup, troubleshooting | Developers, DevOps |

---

## Quick Reference

### Feature Status

| Feature | Status |
|---------|--------|
| Document upload (single/batch) | Complete |
| Folder organization (CRUD, drag-drop) | Complete |
| PDF Editor (modular, annotations, tools) | Complete |
| Template Generator | Complete |
| E-Signatures (multi-signer, template-based) | Complete |
| Document Lock Service | Complete |
| Full-Text Document Search | Complete |
| Version History (signatures) | Complete |
| Merge & Pack | Complete |
| Email Upload | Not implemented |
| Document-level Sharing | Not implemented |

### Key Components

| Area | Components |
|------|------------|
| Documents | DocumentsView, DocumentsSidebar, DocumentsList |
| PDF Editor | pdf-editor/ (index, PageCanvas, Toolbar, SignerPanel) |
| E-Signature | SignatureRequestModal, SignerManager, EmbeddedSigningUI |
| Templates | TemplateManagementModal, TemplateFieldEditor, DocumentGeneratorForm |

### API Endpoints

| Area | Key Endpoints |
|------|---------------|
| Documents | `GET /api/documents/signed-url`, `POST /api/documents/upload`, `POST /api/documents/batch` |
| Templates | `GET/POST/DELETE /api/templates`, `POST /api/templates/generate` |
| E-Signature | `GET/POST /api/esignature/requests`, `POST /api/esignature/requests/[id]/send`, `GET/POST /api/esignature/sign/[token]` |

---

## Getting Started

### For Developers

1. Read [DMS Features and Architecture](./DMS_FEATURES_AND_ARCHITECTURE.md) for system overview
2. Use [DMS Implementation Guide](./DMS_IMPLEMENTATION_GUIDE.md) for API reference and component locations
3. Follow [DMS Setup and Operations](./DMS_SETUP_AND_OPERATIONS.md) for environment and email configuration

### For Product Managers

1. Review [DMS Features and Architecture](./DMS_FEATURES_AND_ARCHITECTURE.md) for feature status and gaps
2. Check the roadmap section for planned enhancements

### For DevOps

1. Configure environment variables per [DMS Setup and Operations](./DMS_SETUP_AND_OPERATIONS.md)
2. Set up Gmail App Password for e-signature email delivery

---

## Services

| Service | Location |
|---------|----------|
| DocumentsService | `lib/services/documents-service.ts` |
| ESignatureService | `lib/services/esign-service.ts` |
| TemplateService | `lib/services/template-service.ts` |
| DocumentLockService | `lib/services/document-lock-service.ts` |
| DocumentSearchService | `lib/services/document-search-service.ts` |
