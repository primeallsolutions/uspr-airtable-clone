import nodemailer from "nodemailer";

// Create reusable transporter using Gmail with App Password
const createTransporter = () => {
  const email = process.env.EMAIL_USER;
  const password = process.env.EMAIL_APP_PASSWORD;

  if (!email || !password) {
    console.warn("Email credentials not configured. Email functionality will be disabled.");
    return null;
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: email,
      pass: password, // Gmail App Password
    },
  });
};

export type EmailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
};

export const EmailService = {
  /**
   * Send an email using Nodemailer with Gmail
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    const transporter = createTransporter();
    
    if (!transporter) {
      const errorMsg = "Email transporter not available. Please configure EMAIL_USER and EMAIL_APP_PASSWORD environment variables.";
      console.warn(errorMsg);
      throw new Error(errorMsg);
    }

    const fromEmail = options.from || process.env.EMAIL_USER || "noreply@example.com";
    const fromName = process.env.EMAIL_FROM_NAME || "Document Management System";

    try {
      // Add timeout to prevent hanging (30 seconds)
      const emailPromise = transporter.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || options.html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Email sending timeout after 30 seconds")), 30000);
      });

      await Promise.race([emailPromise, timeoutPromise]);

      console.log(`Email sent successfully to: ${options.to}`);
    } catch (error) {
      console.error("Failed to send email:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Provide more helpful error messages
      if (errorMessage.includes("Invalid login") || errorMessage.includes("authentication")) {
        throw new Error("Email authentication failed. Please check your EMAIL_USER and EMAIL_APP_PASSWORD.");
      } else if (errorMessage.includes("timeout")) {
        throw new Error("Email sending timed out. Please check your network connection and email configuration.");
      }
      
      throw new Error(`Failed to send email: ${errorMessage}`);
    }
  },

  /**
   * Generate HTML email template for signature requests
   */
  generateSignatureRequestEmail(data: {
    signerName: string;
    requestTitle: string;
    message?: string;
    signUrl: string;
    expiresAt?: string;
  }): string {
    const { signerName, requestTitle, message, signUrl, expiresAt } = data;
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Signature Request: ${requestTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Signature Request</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Hello ${signerName || "there"},
              </p>
              
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                You have been requested to sign the following document:
              </p>
              
              <div style="background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #333333; font-size: 18px; font-weight: 600;">${requestTitle}</p>
              </div>
              
              ${message ? `
              <div style="background-color: #f8f9fa; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #666666; font-size: 14px; line-height: 1.6; font-style: italic;">${message}</p>
              </div>
              ` : ""}
              
              <div style="text-align: center; margin: 32px 0;">
                <a href="${signUrl}" 
                   style="display: inline-block; padding: 14px 32px; background-color: #10b981; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);">
                  Sign Document
                </a>
              </div>
              
              <p style="margin: 24px 0 0; color: #666666; font-size: 14px; line-height: 1.6;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 8px 0 0; color: #667eea; font-size: 12px; word-break: break-all; font-family: monospace;">
                ${signUrl}
              </p>
              
              ${expiresAt ? `
              <div style="margin-top: 32px; padding: 12px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                <p style="margin: 0; color: #856404; font-size: 14px;">
                  <strong>Note:</strong> This request expires on ${new Date(expiresAt).toLocaleDateString()} at ${new Date(expiresAt).toLocaleTimeString()}
                </p>
              </div>
              ` : ""}
              
              <p style="margin: 32px 0 0; color: #999999; font-size: 12px; line-height: 1.6;">
                If you did not expect to receive this request, please ignore this email or contact the sender.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                This is an automated message from the Document Management System.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  },

  /**
   * Generate HTML email template for signature completed notification
   */
  generateSignatureCompletedEmail(data: {
    requestTitle: string;
    signerName: string;
    completedAt: string;
  }): string {
    const { requestTitle, signerName, completedAt } = data;
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document Signed: ${requestTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">Document Signed</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Hello,
              </p>
              
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                This is a confirmation that <strong>${signerName}</strong> has successfully signed the document:
              </p>
              
              <div style="background-color: #f8f9fa; border-left: 4px solid #10b981; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #333333; font-size: 18px; font-weight: 600;">${requestTitle}</p>
              </div>
              
              <p style="margin: 0; color: #666666; font-size: 14px;">
                Signed on: ${new Date(completedAt).toLocaleString()}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                This is an automated message from the Document Management System.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  },
};

