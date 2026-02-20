# Document Management System - Setup and Operations

**Purpose:** Environment configuration, email setup for e-signatures, troubleshooting, and contributing practices.

---

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Email Setup for E-Signatures](#email-setup-for-e-signatures)
3. [Troubleshooting](#troubleshooting)
4. [Contributing](#contributing)

---

## Environment Variables

### Required

| Variable | Purpose |
|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (admin operations) |
| `EMAIL_USER` | Gmail address for e-signature emails |
| `EMAIL_APP_PASSWORD` | Gmail App Password (16 characters) |

### Optional

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET` | Storage bucket name | `documents` |
| `EMAIL_FROM_NAME` | Sender display name | Document Management System |
| `NEXT_PUBLIC_APP_URL` | Base URL for signing links | `http://localhost:3000` |
| `ESIGNATURE_WEBHOOK_SECRET` | Webhook signature verification | - |

### Example `.env.local`

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET=documents

# Email (Gmail)
EMAIL_USER=your-company@gmail.com
EMAIL_APP_PASSWORD=abcdefghijklmnop
EMAIL_FROM_NAME=Your Company Name

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
# Production: NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

---

## Email Setup for E-Signatures

E-signature notifications use Nodemailer with Gmail App Password authentication.

### Step 1: Enable 2-Step Verification

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "Signing in to Google", click **2-Step Verification**
3. Follow the prompts (phone, authenticator app, or SMS)

Google requires 2-Step Verification before creating App Passwords.

### Step 2: Generate App Password

1. In Google Account Security, scroll to **App passwords**
2. Verify your identity if prompted
3. Select **Mail** as app
4. Select **Other (Custom name)** as device
5. Enter a name, e.g., "Document Management System"
6. Click **Generate**
7. Copy the 16-character password immediately (you cannot see it again)

**Notes:**
- Spaces in the password are ignored
- Each App Password can be revoked independently
- If lost, create a new one

### Step 3: Configure and Verify

1. Add variables to `.env.local` (see above)
2. Restart the dev server (`npm run dev`)
3. Create a test signature request
4. Check server logs and recipient inbox (and spam folder)

### Troubleshooting Email

| Issue | Solution |
|-------|----------|
| "Less secure app access" error | Use App Password, not your regular password |
| "Invalid credentials" | Verify App Password, ensure 2-Step Verification is enabled |
| Email goes to spam | Normal for automated emails; recipients can mark "Not Spam" |
| Can't find App Passwords option | Enable 2-Step Verification first; for Google Workspace, admin may need to enable |

### Alternative Providers

Modify `lib/services/email-service.ts` to use SendGrid, Mailgun, AWS SES, or other SMTP providers.

---

## Troubleshooting

### Template Generation

| Issue | Cause | Solution |
|------|-------|----------|
| Fields not appearing in generated PDF | Coordinate system mismatch (PDF uses bottom-left origin) | Verify Y coordinates are calculated correctly |
| Text overflow | Field width too small or text too long | Increase field width or enable text wrapping |
| Template not loading | Storage permissions or invalid path | Check RLS policies and path format |
| Generation fails silently | Missing field values or invalid data | Add error logging; validate required fields |

### PDF Editor

| Issue | Cause | Solution |
|------|-------|----------|
| Canvas null reference | Canvas ref null during lifecycle | Added guards in PageCanvas; update if new rendering paths added |
| Continuous re-rendering during drag | useEffect triggers during drag | Ensure `isDragging` guard in rendering-related effects |
| Dragging not working | Wrong tool selected | Use Select tool and click on blue annotation outlines |
| Panning issues | Wrong tool | Use Pan tool and click-drag in document area |

### Document Operations

| Issue | Cause | Solution |
|------|-------|----------|
| Record-scoped view shows all requests | Missing recordId propagation | Ensure SignatureRequestStatus receives recordId from DocumentsView |
| Signed URL fails for record docs | Wrong path construction | Use correct base prefix: `bases/{baseId}/records/{recordId}/` |
| Full refresh on every action | No optimistic updates | Consider React Query/SWR for caching; optimistic UI |

### General

| Issue | Solution |
|-------|----------|
| RLS blocking operations | Verify routes use correct Supabase client (user vs admin); service methods accept optional client |
| Foreign key violations on created_by | Ensure user profile exists; migration 018 made created_by nullable |
| Empty error messages on email fail | Check esign-service and send route; improve error re-throwing |

---

## Contributing

### When Making DMS Changes

1. **Update documentation:** Keep DMS_FEATURES_AND_ARCHITECTURE.md and DMS_IMPLEMENTATION_GUIDE.md in sync with code changes
2. **API changes:** Document new/updated endpoints in DMS_IMPLEMENTATION_GUIDE.md
3. **New features:** Add to feature list and component map
4. **Environment variables:** Document in this file

### Code Quality Notes

- Consider splitting DocumentsView into smaller components if it grows significantly
- Use TypeScript types; avoid `any`
- Standardize error response format across API routes
- Add ARIA labels and keyboard shortcuts for accessibility

### Security Practices

- Never commit `.env.local` to version control
- Use different App Passwords for development and production
- Rotate App Passwords if compromised
- Use a dedicated email account for production
