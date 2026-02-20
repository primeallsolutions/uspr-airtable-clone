# Document Management System - Setup and Operations

**Purpose:** Environment configuration, email setup for e-signatures, and operational reference.

---

## Environment Variables

### E-Signature Email (Required for sending signature requests)

The DMS supports two backends for e-signature emails:

#### Option 1: Resend (Recommended)

When `RESEND_API_KEY` is set, the DMS uses Resend for all e-signature emails.

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key (required for Resend) |
| `RESEND_FROM_EMAIL` | From address (e.g. `noreply@yourdomain.com`) |
| `EMAIL_FROM_NAME` | Sender display name |

```bash
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com
EMAIL_FROM_NAME=Your Company Name
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Option 2: Gmail (Fallback)

When `RESEND_API_KEY` is not set, the DMS falls back to Nodemailer with Gmail.

| Variable | Purpose |
|----------|---------|
| `EMAIL_USER` | Gmail address |
| `EMAIL_APP_PASSWORD` | Gmail App Password (16 characters) |
| `EMAIL_FROM_NAME` | Sender display name |

See [EMAIL_SETUP_GUIDE.md](./EMAIL_SETUP_GUIDE.md) for detailed Gmail setup (2-Step Verification, App Password generation).

### Shared Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | Base URL for signing links (e.g. `https://yourdomain.com`) |

### Supabase

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (admin operations) |
| `NEXT_PUBLIC_SUPABASE_DOCUMENTS_BUCKET` | Storage bucket name (default: `documents`) |

---

## Email Setup Summary

**Priority:** Resend is used when `RESEND_API_KEY` is configured. Otherwise, Gmail (EMAIL_USER + EMAIL_APP_PASSWORD) is used.

For production, Resend is recommended for better deliverability and domain authentication (SPF/DKIM).
