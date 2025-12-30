# Email Setup Guide - Gmail App Password

This guide explains how to set up email functionality for the e-signature system using Gmail with App Password authentication.

## Prerequisites

- A Gmail account (personal or Google Workspace)
- Access to Google Account settings
- Ability to enable 2-Step Verification

## Step-by-Step Setup

### Step 1: Enable 2-Step Verification

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Under "Signing in to Google", click on **2-Step Verification**
3. Follow the prompts to enable 2-Step Verification
   - You'll need access to your phone for verification
   - You can use an authenticator app or SMS

**Why is this required?**
Google requires 2-Step Verification to be enabled before you can create App Passwords. This adds an extra layer of security.

### Step 2: Generate App Password

1. Still in Google Account Security settings, scroll down to **App passwords**
2. You may be asked to verify your identity again
3. Under "Select app", choose **Mail**
4. Under "Select device", choose **Other (Custom name)**
5. Enter a descriptive name, e.g., "Document Management System" or "E-Signature Service"
6. Click **Generate**
7. Google will display a 16-character password like: `abcd efgh ijkl mnop`
8. **Copy this password immediately** - you won't be able to see it again!

**Important Notes:**
- The password may have spaces, but they're ignored when you use it
- Each App Password is unique and can be revoked independently
- You can create multiple App Passwords for different applications
- If you lose an App Password, you'll need to create a new one

### Step 3: Configure Environment Variables

Add the following to your `.env.local` file (create it if it doesn't exist):

```bash
# Gmail Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_APP_PASSWORD=abcdefghijklmnop
EMAIL_FROM_NAME=Your Company Name

# Base URL for signing links
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**For Production:**
```bash
EMAIL_USER=noreply@yourcompany.com
EMAIL_APP_PASSWORD=your-16-character-password
EMAIL_FROM_NAME=Your Company Name
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Step 4: Verify Setup

1. Restart your development server (`npm run dev`)
2. Create a test signature request
3. Check the server logs for email sending confirmation
4. Check the recipient's inbox (and spam folder) for the email

## Troubleshooting

### Email Not Sending

**Check Environment Variables:**
- Verify `EMAIL_USER` is your full Gmail address
- Verify `EMAIL_APP_PASSWORD` is the exact 16-character password (spaces optional)
- Make sure there are no extra quotes or spaces in `.env.local`

**Check Server Logs:**
Look for error messages like:
- "Invalid login" - Check your App Password
- "Email transporter not available" - Environment variables not loaded
- "Failed to send email" - Network or configuration issue

**Common Issues:**

1. **"Less secure app access" error**: 
   - You're not using an App Password, or it's incorrect
   - Generate a new App Password and try again

2. **"Invalid credentials" error**:
   - Double-check your App Password
   - Make sure 2-Step Verification is enabled
   - Try generating a new App Password

3. **Email goes to spam**:
   - This is normal for automated emails
   - Consider setting up SPF/DKIM records for your domain (for production)
   - For now, recipients can mark as "Not Spam"

4. **Can't find App Passwords option**:
   - Make sure 2-Step Verification is enabled first
   - Refresh the page or try logging out and back in
   - For Google Workspace accounts, your admin may need to enable it

### Testing Email Locally

You can test email functionality without sending actual emails by checking the console logs. The service will log email attempts even if sending fails.

To test actual delivery:
1. Create a signature request with your own email
2. Check your inbox for the signing link
3. Verify the email formatting and links work correctly

## Security Best Practices

1. **Never commit `.env.local`** to version control
2. **Use different App Passwords** for development and production
3. **Rotate App Passwords** if they might be compromised
4. **Revoke unused App Passwords** from Google Account settings
5. **Use a dedicated email account** for production (not your personal email)
6. **Monitor email sending** for unusual activity

## Google Workspace (Business) Accounts

If using Google Workspace:
- The process is the same, but App Passwords may need to be enabled by your admin
- You may need to contact your Google Workspace administrator
- Some organizations restrict App Password usage for security reasons

## Alternative Email Providers

While this guide covers Gmail, you can modify `lib/services/email-service.ts` to use other providers:

- **SMTP**: Most email providers support SMTP
- **SendGrid**: Change transporter configuration
- **Mailgun**: Similar SMTP setup
- **AWS SES**: Use AWS SDK instead of Nodemailer

For other providers, you'll need to:
1. Update the transporter configuration in `email-service.ts`
2. Adjust the authentication method
3. Update environment variable names accordingly

## Support

If you continue to have issues:
1. Check the [Nodemailer documentation](https://nodemailer.com/about/)
2. Review Google's [App Password guide](https://support.google.com/accounts/answer/185833)
3. Check server logs for detailed error messages
4. Verify all environment variables are set correctly




