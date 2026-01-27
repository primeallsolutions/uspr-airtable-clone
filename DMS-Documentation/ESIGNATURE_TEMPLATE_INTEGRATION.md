# E-Signature Template Integration Workflow

## Overview
E-signatures are now fully integrated into the template workflow. Signature fields can be configured during template editing, and signature requests are automatically created when documents are generated from templates.

## New Workflow

### 1. Template Creation/Editing
When editing a template and placing a **signature field**:
- Select field type: "Signature"
- Check **"Require E-Signature"** checkbox
- Configure signer:
  - **Signer Email** (required)
  - **Signer Name** (optional)
  - **Signer Role** (signer/viewer/approver)
  - **Sign Order** (0 = parallel, >0 = sequential)

### 2. Document Generation
When generating a document from a template:
- All regular fields are filled in as normal
- **Signature fields with e-signature enabled are left blank**
- After document is generated and uploaded:
  - System automatically detects signature fields with e-signature requirements
  - Creates a signature request with all configured signers
  - Maps template signature field positions to signature request fields
  - Sends emails to all signers automatically

### 3. Signing Process
- Signer receives email with signing link
- Clicks link to access embedded signing UI
- Views document with signature fields highlighted
- Clicks on signature fields to sign
- Submits signature

### 4. Document Completion
- When last signer completes:
  - All signatures are merged into the final document
  - Original generated document is **replaced** with signed version
  - Completion certificate is generated
  - Document is ready in the documents folder

## Database Changes

**Migration 017**: Added e-signature configuration columns to `template_fields`:
- `requires_esignature` (boolean)
- `esignature_signer_email` (text)
- `esignature_signer_name` (text)
- `esignature_signer_role` (text)
- `esignature_sign_order` (integer)

## UI Changes

### Template Field Editor
- New "Require E-Signature" checkbox for signature fields
- Signer configuration section (appears when checkbox is checked)
- Email, name, role, and sign order fields

### Document Generator
- Signature fields with e-signature are automatically skipped during generation
- Success message indicates if signature requests were sent

## API Changes

### Template Generation (`POST /api/templates/generate`)
- Detects signature fields with `requires_esignature = true`
- Skips filling those fields
- After generation, automatically:
  - Creates signature request
  - Adds signers from template configuration
  - Creates signature fields based on template field positions
  - Sends emails to signers

### Signature Submission (`POST /api/esignature/sign/[token]`)
- When last signer completes, replaces original document
- Generates completion certificate

## Example Workflow

1. **Admin creates template**:
   - Uploads contract PDF
   - Places "Buyer Signature" field at position (100, 200)
   - Checks "Require E-Signature"
   - Sets signer email: buyer@example.com
   - Sets signer name: "John Buyer"

2. **Admin generates document**:
   - Fills in buyer name, address, etc.
   - Signature field is left blank
   - Document is generated and saved
   - System automatically creates signature request
   - Email sent to buyer@example.com

3. **Buyer signs**:
   - Receives email
   - Clicks signing link
   - Views document
   - Signs at the "Buyer Signature" field
   - Submits

4. **Document complete**:
   - Signed document replaces original
   - Appears in documents folder with all signatures
   - Completion certificate generated

## Benefits

✅ **Seamless Integration**: No separate signature request creation needed
✅ **Template-Based**: Signature requirements defined once in template
✅ **Automatic**: Emails sent automatically when document is generated
✅ **Replaces Original**: Signed document replaces generated document automatically
✅ **Multi-Signer Support**: Template can have multiple signature fields with different signers

## Migration Required

Run migration `017_add_template_field_esignature_config.sql` to add e-signature configuration columns to template_fields table.




