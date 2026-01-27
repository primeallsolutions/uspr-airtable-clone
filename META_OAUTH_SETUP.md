# Meta OAuth Setup Guide

This guide will walk you through setting up Facebook and Instagram OAuth integration for your SaaS application.

## Overview

Your users will simply click "Connect with Facebook" and authorize your app - no technical setup required on their end. You (the app owner) need to set up ONE Meta Developer App that all users will authenticate through.

## Step 1: Create a Meta Developer Account

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click "Get Started" in the top right
3. Log in with your Facebook account
4. Complete the registration process

## Step 2: Create a New App

1. From the [Meta Apps Dashboard](https://developers.facebook.com/apps/), click "Create App"
2. Select use case: **"Other"** → Click "Next"
3. Select app type: **"Business"** → Click "Next"
4. Fill in app details:
   - **App Name**: Your SaaS App Name (e.g., "US Prime Marketing")
   - **App Contact Email**: Your support email
   - **Business Account**: Select or create a Meta Business Account
5. Click "Create App"

## Step 3: Configure App Settings

### Basic Settings

1. In the left sidebar, go to **Settings** → **Basic**
2. Note your **App ID** (you'll need this)
3. Click "Show" next to **App Secret** (you'll need this too)
4. Scroll down to **App Domains** and add your domain (e.g., `yourdomain.com`)
5. Add a **Privacy Policy URL** (required for app review)
6. Add a **Terms of Service URL** (optional but recommended)
7. Save changes

### Add Products

1. In the left sidebar, find **Add Products to Your App**
2. Find **Facebook Login** and click "Set Up"
3. Select **Web** as the platform
4. Skip the quickstart, go to **Facebook Login** → **Settings** in the left sidebar
5. Add your **Valid OAuth Redirect URIs**:
   ```
   http://localhost:3000/api/meta/callback
   https://yourdomain.com/api/meta/callback
   ```
6. Set **Deauthorize Callback URL**: `https://yourdomain.com/api/meta/deauthorize` (optional)
7. Save changes

## Step 4: Add Required Permissions

Your app needs specific permissions to access Facebook Pages and Instagram accounts:

### Pages Permissions
- `pages_show_list` - View list of Pages the user manages
- `pages_read_engagement` - Read engagement data
- `pages_manage_posts` - Create and manage posts
- `pages_manage_metadata` - Manage Page settings

### Instagram Permissions
- `instagram_basic` - Access Instagram account info
- `instagram_manage_insights` - View Instagram insights
- `instagram_content_publish` - Publish content to Instagram

### Ads Permissions (for Ad Manager feature)
- `ads_management` - Create and manage ads
- `ads_read` - Read ads data

**Note**: Some permissions require App Review before they work for users other than app administrators/developers/testers.

## Step 5: Configure Environment Variables

Add these environment variables to your `.env.local` file:

```env
# Meta OAuth Configuration
NEXT_PUBLIC_META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
NEXT_PUBLIC_META_REDIRECT_URI=http://localhost:3000/api/meta/callback
```

For production, update `NEXT_PUBLIC_META_REDIRECT_URI` to your production URL:
```env
NEXT_PUBLIC_META_REDIRECT_URI=https://yourdomain.com/api/meta/callback
```

## Step 6: App Modes

### Development Mode
- Your app starts in **Development Mode**
- Only administrators, developers, and testers can authenticate
- Perfect for testing your integration

### Live Mode
To make your app available to all users, you need to:

1. Complete App Review for required permissions
2. Switch app to **Live Mode** in App Settings → Basic

## Step 7: Add Test Users (Development Mode)

While in Development Mode, add test users:

1. Go to **Roles** in the left sidebar
2. Click **Add Testers** or **Add Developers**
3. Enter Facebook user IDs or search by name
4. These users can now connect to your app

## Step 8: App Review (For Production)

To use advanced permissions with all users, submit for App Review:

1. Go to **App Review** → **Permissions and Features**
2. Request the permissions you need (listed in Step 4)
3. Provide:
   - Detailed explanation of how you use each permission
   - Screen recording/screenshots of your app's OAuth flow
   - Privacy Policy URL
4. Submit for review (can take 3-5 business days)

## Testing Your Integration

### Test Locally

1. Start your Next.js app: `npm run dev`
2. Navigate to the Marketing tab
3. Click "Connect with Facebook"
4. Log in with a test user account
5. Authorize the app
6. Verify connected Pages and Instagram accounts appear

### Common Issues

**Error: "Redirect URI Mismatch"**
- Ensure the redirect URI in Meta App Settings exactly matches your environment variable
- Check for trailing slashes or http vs https mismatches

**Error: "App Not Set Up"**
- Make sure Facebook Login is added as a product
- Verify OAuth Redirect URIs are saved in Facebook Login settings

**No Instagram accounts showing**
- Instagram accounts must be Instagram Business or Creator accounts
- They must be linked to a Facebook Page
- Personal Instagram accounts won't appear

**Permissions not working**
- In Development Mode, only test users can use the app
- Some permissions require App Review approval
- Check that permissions are enabled in App Review → Permissions and Features

## Meta Graph API Documentation

- [Graph API Reference](https://developers.facebook.com/docs/graph-api/)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login/)
- [Instagram API Documentation](https://developers.facebook.com/docs/instagram-api/)
- [Marketing API (Ads)](https://developers.facebook.com/docs/marketing-apis/)

## Security Best Practices

1. **Never expose your App Secret** - Keep it server-side only
2. **Use HTTPS in production** - Meta requires secure redirect URIs
3. **Validate state parameter** - Prevent CSRF attacks
4. **Store tokens securely** - Encrypt sensitive data in your database
5. **Refresh tokens regularly** - Meta tokens expire after 60 days
6. **Implement token rotation** - Exchange short-lived tokens for long-lived ones

## Next Steps

After setup is complete:

1. Test the OAuth flow thoroughly
2. Add your logo and app icon in App Settings → Basic
3. Prepare for App Review if needed
4. Build out Social Planner and Ad Manager features
5. Monitor API usage in Meta App Dashboard

## Support

- Meta Developer Support: https://developers.facebook.com/support/
- Community Forum: https://developers.facebook.com/community/
