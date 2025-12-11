# Go High Level Integration Setup Guide

This guide will help you set up the Go High Level (GHL) integration for your Airtable clone.

## Quick Start (Private Integration - Recommended)

The easiest way to connect is using a **Private Integration Token**. This doesn't require OAuth setup.

### Step 1: Create a Private Integration in GHL

1. Log in to your Go High Level account
2. Go to **Settings** → **Integrations** → **Private Integrations**
3. Click **Create Private Integration**
4. Give it a name (e.g., "Airtable Clone Sync")
5. Select the scopes you need:
   - `contacts.readonly` - Read contacts
   - `contacts.write` - Write contacts (optional)
6. Click **Create**
7. **Copy the Access Token** (starts with `pit-`)
8. **Find your Location ID**: Look in your GHL URL (after `/location/`) or in Settings → Business Info

### Step 2: Connect in Your App

1. Open a base in your application
2. Click the **Connect GHL** button in the top navigation
3. Enter your:
   - **Access Token**: The `pit-xxxxx` token from Step 1
   - **Location ID**: Your GHL location ID
4. Click **Connect**
5. Configure field mapping to map GHL contact fields to your base fields

That's it! Contacts will now sync from GHL to your base.

---

## Alternative: OAuth Setup (For Multi-Tenant Apps)

If you need users to connect their own GHL accounts, use OAuth instead.

### Step 1: Create GHL OAuth Application

1. Log in to your Go High Level account
2. Navigate to **Marketplace** → **Developers** → **OAuth Apps**
3. Click **Create New OAuth App**
4. Fill in the application details:
   - **App Name**: Your App Name (e.g., "Airtable Clone Integration")
   - **Description**: Brief description of your integration
   - **Redirect URI**: 
     - For local development: `http://localhost:3000/api/ghl/callback`
     - For production: `https://yourdomain.com/api/ghl/callback`
5. Select the following **Scopes**:
   - `contacts.readonly` - Read contacts from GHL
   - `contacts.write` - Write contacts to GHL (optional)
6. Click **Create App**
7. Copy your **Client ID** and **Client Secret**

### Step 2: Configure Environment Variables (OAuth only)

Add the following environment variables to your `.env.local` file:

```bash
# Go High Level OAuth Configuration (only needed for OAuth flow)
NEXT_PUBLIC_GHL_CLIENT_ID=your_ghl_client_id_here
GHL_CLIENT_SECRET=your_ghl_client_secret_here

# Redirect URI (must match what you configured in GHL)
NEXT_PUBLIC_GHL_REDIRECT_URI=http://localhost:3000/api/ghl/callback
# For production: https://yourdomain.com/api/ghl/callback
```

---

## Environment Variables Reference

```bash
# Required for all setups
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here

# Optional: Webhook signature verification
GHL_WEBHOOK_SECRET=your_random_webhook_secret_here

# Only for OAuth flow (not needed for Private Integration)
NEXT_PUBLIC_GHL_CLIENT_ID=your_ghl_client_id_here
GHL_CLIENT_SECRET=your_ghl_client_secret_here
NEXT_PUBLIC_GHL_REDIRECT_URI=http://localhost:3000/api/ghl/callback
```

### Generating a Webhook Secret (Optional)

```bash
# On Linux/Mac:
openssl rand -hex 32

# On Windows (PowerShell):
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

## Step 3: Run Database Migration

Run the database migration to create the required tables:

```bash
# If using Supabase CLI:
supabase migration up

# Or apply the migration manually in your Supabase dashboard:
# Navigate to SQL Editor and run: supabase/migrations/20250211_add_ghl_integration.sql
```

The migration creates:
- `ghl_integrations` - Stores OAuth tokens and integration settings
- `ghl_sync_logs` - Tracks sync operations for debugging

## Step 4: Configure Webhook (Optional)

The integration will automatically register webhooks when a user connects their GHL account. However, you may also configure webhooks manually in GHL:

1. In your GHL account, go to **Settings** → **Integrations** → **Webhooks**
2. Add a new webhook with:
   - **Event**: Contact Created/Updated
   - **URL**: `https://yourdomain.com/api/ghl/webhook`
   - **Method**: POST
   - **Headers**: (if GHL requires signature verification)

## Step 5: Test the Integration

1. Start your Next.js application:
   ```bash
   npm run dev
   ```

2. Navigate to a base in your application
3. Click the **Connect GHL** button in the top navigation
4. You'll be redirected to GHL to authorize the application
5. After authorization, you'll be redirected back to your base
6. The integration is now connected!

## Troubleshooting

### OAuth Flow Issues

- **"Invalid redirect_uri"**: Make sure the redirect URI in your environment variables exactly matches what you configured in GHL
- **"Invalid client_id"**: Verify `NEXT_PUBLIC_GHL_CLIENT_ID` is set correctly
- **"Invalid client_secret"**: Verify `GHL_CLIENT_SECRET` is set correctly

### Webhook Issues

- **Webhooks not received**: 
  - Check that your webhook URL is accessible from the internet (use ngrok for local development)
  - Verify the webhook was registered in GHL (check the `ghl_integrations` table)
  - Check server logs for webhook errors

- **"Invalid signature" errors**:
  - Verify `GHL_WEBHOOK_SECRET` matches what GHL is sending (if applicable)
  - Note: GHL may not always send signatures - the code handles this gracefully

### Database Issues

- **"Service role key required"**: Make sure `SUPABASE_SERVICE_ROLE_KEY` is set for webhook processing
- **RLS policy errors**: Verify Row Level Security policies are correctly set up in the migration

### Sync Issues

- **Contacts not appearing**: 
  - Check `ghl_sync_logs` table for errors
  - Verify field mapping is configured correctly
  - Ensure the masterlist table exists in your base
  - Check that required fields (Name, Email, Phone) exist

## Local Development with Webhooks

For local development, you'll need to expose your local server to the internet so GHL can send webhooks:

### Using ngrok:

1. Install ngrok: `npm install -g ngrok` or download from [ngrok.com](https://ngrok.com)
2. Start your Next.js app: `npm run dev`
3. In another terminal, run: `ngrok http 3000`
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
5. Update your redirect URI in GHL and environment variables to use this URL:
   ```
   NEXT_PUBLIC_GHL_REDIRECT_URI=https://abc123.ngrok.io/api/ghl/callback
   ```
6. When connecting, the webhook will be registered with the ngrok URL

**Note**: ngrok URLs change on each restart. For production, use a permanent domain.

## Security Considerations

1. **Never commit `.env.local`** to version control
2. **Use environment-specific secrets** for production
3. **Rotate secrets regularly** if they're compromised
4. **Use HTTPS** in production (required for OAuth callbacks)
5. **Monitor sync logs** for suspicious activity
6. **Implement rate limiting** on the webhook endpoint (consider using middleware)

## Next Steps

- Customize field mapping in the integration settings
- Monitor sync logs to ensure contacts are syncing correctly
- Consider implementing two-way sync (app → GHL) for future enhancements
- Add filtering rules to only sync specific contacts (e.g., by tags)

## Support

For issues or questions:
1. Check the `ghl_sync_logs` table for error messages
2. Review server logs for detailed error information
3. Verify all environment variables are set correctly
4. Test the OAuth flow manually using the GHL API documentation

## API References

- [Go High Level API Documentation](https://highlevel.stoplight.io/docs/integrations)
- [GHL OAuth Guide](https://highlevel.stoplight.io/docs/integrations/75b67e7b8e5c4-oauth-2-0)

