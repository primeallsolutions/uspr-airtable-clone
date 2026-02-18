import { createClient } from "@supabase/supabase-js";
import type { 
  RecordEmail, 
  RecordEmailAddress, 
  SendEmailPayload, 
  InboundEmailPayload,
  EmailRecipient,
  EmailTemplate,
  EmailEvent,
  EmailEventType,
  EmailAttachment,
  EmailStats,
} from "@/lib/types/base-detail";

// Supabase client for server-side operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const getSupabaseAdmin = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

// Resend configuration
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@example.com";
const RESEND_INBOUND_DOMAIN = process.env.RESEND_INBOUND_DOMAIN || "inbound.allprimesolutions.com";
const EMAIL_FROM_NAME = process.env.EMAIL_FROM_NAME || "US Prime Realty";

/**
 * Record Email Service
 * Handles all email operations for records including sending, receiving, and managing email addresses
 */
export const RecordEmailService = {
  /**
   * Generate a unique email address for a record
   * Format: rec_[shortId]@[inbound-domain]
   */
  async generateRecordEmailAddress(recordId: string): Promise<RecordEmailAddress> {
    const supabase = getSupabaseAdmin();

    // Check if address already exists
    const { data: existing } = await supabase
      .from("record_email_addresses")
      .select("*")
      .eq("record_id", recordId)
      .single();

    if (existing) {
      return existing as RecordEmailAddress;
    }

    // Generate short ID from record ID (first 12 chars)
    const shortId = recordId.replace(/-/g, "").substring(0, 12).toLowerCase();
    const emailAddress = `rec_${shortId}@${RESEND_INBOUND_DOMAIN}`;

    const { data, error } = await supabase
      .from("record_email_addresses")
      .insert({
        record_id: recordId,
        email_address: emailAddress,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation - address might already exist
      if (error.code === "23505") {
        const { data: retryData } = await supabase
          .from("record_email_addresses")
          .select("*")
          .eq("record_id", recordId)
          .single();
        
        if (retryData) {
          return retryData as RecordEmailAddress;
        }
      }
      throw new Error(`Failed to generate email address: ${error.message}`);
    }

    return data as RecordEmailAddress;
  },

  /**
   * Get the email address for a record
   */
  async getRecordEmailAddress(recordId: string): Promise<RecordEmailAddress | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("record_email_addresses")
      .select("*")
      .eq("record_id", recordId)
      .eq("is_active", true)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to get email address: ${error.message}`);
    }

    return data as RecordEmailAddress | null;
  },

  /**
   * Find record ID from an email address
   */
  async findRecordByEmailAddress(emailAddress: string): Promise<string | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("record_email_addresses")
      .select("record_id")
      .eq("email_address", emailAddress.toLowerCase())
      .eq("is_active", true)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to find record: ${error.message}`);
    }

    return data?.record_id || null;
  },

  /**
   * Get all emails for a record
   */
  async getRecordEmails(
    recordId: string, 
    options?: { 
      direction?: "inbound" | "outbound"; 
      limit?: number; 
      offset?: number;
    }
  ): Promise<RecordEmail[]> {
    const supabase = getSupabaseAdmin();
    
    let query = supabase
      .from("record_emails")
      .select("*")
      .eq("record_id", recordId)
      .order("created_at", { ascending: false });

    if (options?.direction) {
      query = query.eq("direction", options.direction);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get emails: ${error.message}`);
    }

    return (data || []) as RecordEmail[];
  },

  /**
   * Get email count for a record
   */
  async getEmailCount(recordId: string): Promise<number> {
    const supabase = getSupabaseAdmin();

    const { count, error } = await supabase
      .from("record_emails")
      .select("*", { count: "exact", head: true })
      .eq("record_id", recordId);

    if (error) {
      console.error("Failed to get email count:", error);
      return 0;
    }

    return count || 0;
  },

  /**
   * Send an email from a record
   */
  async sendEmail(payload: SendEmailPayload, userId?: string): Promise<RecordEmail> {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = getSupabaseAdmin();

    // Get or create the record's unique email address for Reply-To
    const recordEmailAddress = await this.generateRecordEmailAddress(payload.record_id);

    // Generate thread ID if this is a new conversation
    const threadId = payload.in_reply_to || `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Send via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${EMAIL_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
        to: [payload.to],
        subject: payload.subject,
        html: payload.body_html,
        text: payload.body_text || payload.body_html.replace(/<[^>]*>/g, ""),
        reply_to: recordEmailAddress.email_address,
        cc: payload.cc?.map((r) => r.email),
        bcc: payload.bcc?.map((r) => r.email),
        headers: {
          "X-Record-ID": payload.record_id,
          "X-Thread-ID": threadId,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Failed to send email via Resend:", errorBody);
      throw new Error(`Failed to send email: ${response.status}`);
    }

    const result = await response.json();

    // Store the sent email in database
    const { data, error } = await supabase
      .from("record_emails")
      .insert({
        record_id: payload.record_id,
        direction: "outbound",
        from_email: RESEND_FROM_EMAIL,
        from_name: EMAIL_FROM_NAME,
        to_email: payload.to,
        to_name: payload.to_name,
        cc_emails: payload.cc || [],
        bcc_emails: payload.bcc || [],
        subject: payload.subject,
        body_text: payload.body_text || payload.body_html.replace(/<[^>]*>/g, ""),
        body_html: payload.body_html,
        message_id: result.id,
        in_reply_to: payload.in_reply_to,
        thread_id: threadId,
        status: "sent",
        sent_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to store sent email:", error);
      throw new Error(`Failed to store email: ${error.message}`);
    }

    console.log(`Email sent successfully to ${payload.to}`, { id: result.id });

    return data as RecordEmail;
  },

  /**
   * Process an inbound email from Resend webhook
   */
  async processInboundEmail(payload: InboundEmailPayload): Promise<RecordEmail | null> {
    const supabase = getSupabaseAdmin();

    // Extract record ID from the recipient email address
    const recordId = await this.findRecordByEmailAddress(payload.to);

    if (!recordId) {
      console.warn(`No record found for email address: ${payload.to}`);
      return null;
    }

    // Check for duplicate message
    if (payload.message_id) {
      const { data: existing } = await supabase
        .from("record_emails")
        .select("id")
        .eq("message_id", payload.message_id)
        .single();

      if (existing) {
        console.log(`Duplicate email received, skipping: ${payload.message_id}`);
        return null;
      }
    }

    // Determine thread ID from in_reply_to or create new
    let threadId: string | undefined;
    if (payload.in_reply_to) {
      // Try to find the parent message to get thread ID
      const { data: parentEmail } = await supabase
        .from("record_emails")
        .select("thread_id")
        .eq("message_id", payload.in_reply_to)
        .single();

      threadId = parentEmail?.thread_id;
    }

    if (!threadId) {
      threadId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Process attachments (store metadata, optionally store files)
    const attachments = payload.attachments?.map((att) => ({
      filename: att.filename,
      content_type: att.content_type,
      size: att.size,
      // Note: In production, you'd want to store the content in Supabase Storage
      // and save the storage_path here
    })) || [];

    // Store the inbound email
    const { data, error } = await supabase
      .from("record_emails")
      .insert({
        record_id: recordId,
        direction: "inbound",
        from_email: payload.from,
        from_name: payload.from_name,
        to_email: payload.to,
        subject: payload.subject,
        body_text: payload.text,
        body_html: payload.html,
        message_id: payload.message_id,
        in_reply_to: payload.in_reply_to,
        thread_id: threadId,
        attachments,
        status: "delivered",
        metadata: { headers: payload.headers },
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to store inbound email:", error);
      throw new Error(`Failed to store inbound email: ${error.message}`);
    }

    console.log(`Inbound email processed for record ${recordId}`, { 
      from: payload.from, 
      subject: payload.subject 
    });

    return data as RecordEmail;
  },

  /**
   * Mark an email as read
   */
  async markAsRead(emailId: string): Promise<void> {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("record_emails")
      .update({ read_at: new Date().toISOString() })
      .eq("id", emailId)
      .is("read_at", null);

    if (error) {
      throw new Error(`Failed to mark email as read: ${error.message}`);
    }
  },

  /**
   * Update email status (from Resend webhook events)
   */
  async updateEmailStatus(
    messageId: string, 
    status: "delivered" | "bounced" | "failed" | "opened" | "clicked"
  ): Promise<void> {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("record_emails")
      .update({ status })
      .eq("message_id", messageId);

    if (error) {
      throw new Error(`Failed to update email status: ${error.message}`);
    }
  },

  /**
   * Delete an email
   */
  async deleteEmail(emailId: string): Promise<void> {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("record_emails")
      .delete()
      .eq("id", emailId);

    if (error) {
      throw new Error(`Failed to delete email: ${error.message}`);
    }
  },

  /**
   * Get emails grouped by thread
   */
  async getEmailThreads(recordId: string): Promise<Map<string, RecordEmail[]>> {
    const emails = await this.getRecordEmails(recordId);
    
    const threads = new Map<string, RecordEmail[]>();
    
    for (const email of emails) {
      const threadId = email.thread_id || email.id;
      if (!threads.has(threadId)) {
        threads.set(threadId, []);
      }
      threads.get(threadId)!.push(email);
    }

    // Sort emails within each thread by date
    threads.forEach((emailList) => {
      emailList.sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    });

    return threads;
  },

  /**
   * Generate HTML email template for outbound emails
   */
  generateEmailTemplate(data: {
    recipientName?: string;
    subject: string;
    body: string;
    senderName?: string;
  }): string {
    const { recipientName, subject, body, senderName } = data;
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px 20px; border-bottom: 1px solid #e5e7eb;">
              <h1 style="margin: 0; color: #111827; font-size: 20px; font-weight: 600;">${subject}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px 40px;">
              ${recipientName ? `<p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">Hello ${recipientName},</p>` : ''}
              
              <div style="color: #333333; font-size: 16px; line-height: 1.6;">
                ${body}
              </div>
              
              ${senderName ? `
              <p style="margin: 30px 0 0; color: #666666; font-size: 14px;">
                Best regards,<br>
                <strong>${senderName}</strong>
              </p>
              ` : ''}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                This email was sent from US Prime Realty. You can reply directly to this email.
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

  // ===========================================
  // EMAIL EVENT TRACKING METHODS
  // ===========================================

  /**
   * Record an email event (opened, clicked, delivered, bounced, etc.)
   */
  async recordEmailEvent(
    messageId: string,
    eventType: EmailEventType,
    eventData: Record<string, unknown> = {},
    metadata?: { ip_address?: string; user_agent?: string; location?: Record<string, string> }
  ): Promise<EmailEvent | null> {
    const supabase = getSupabaseAdmin();

    // Find the email by message_id
    const { data: email } = await supabase
      .from("record_emails")
      .select("id")
      .eq("message_id", messageId)
      .single();

    if (!email) {
      console.warn(`No email found for message_id: ${messageId}`);
      return null;
    }

    // Insert the event
    const { data: event, error: eventError } = await supabase
      .from("email_events")
      .insert({
        email_id: email.id,
        event_type: eventType,
        event_data: eventData,
        ip_address: metadata?.ip_address,
        user_agent: metadata?.user_agent,
        location: metadata?.location,
      })
      .select()
      .single();

    if (eventError) {
      console.error("Failed to record email event:", eventError);
      return null;
    }

    // Update tracking columns on the email based on event type
    const updateData: Record<string, unknown> = { status: eventType };

    if (eventType === "opened") {
      // Update opened_at only on first open
      await supabase
        .from("record_emails")
        .update({ 
          status: "opened",
          opened_at: new Date().toISOString(),
        })
        .eq("id", email.id)
        .is("opened_at", null);

      // Increment open_count
      await supabase.rpc("increment_email_open_count", { email_id: email.id });
    } else if (eventType === "clicked") {
      // Update clicked_at only on first click
      await supabase
        .from("record_emails")
        .update({ 
          status: "clicked",
          clicked_at: new Date().toISOString(),
        })
        .eq("id", email.id)
        .is("clicked_at", null);

      // Increment click_count
      await supabase.rpc("increment_email_click_count", { email_id: email.id });

      // Add link to link_clicks if URL provided
      if (eventData.url) {
        await supabase.rpc("add_email_link_click", { 
          email_id: email.id, 
          link_url: eventData.url as string 
        });
      }
    } else if (eventType === "delivered") {
      await supabase
        .from("record_emails")
        .update({ status: "delivered" })
        .eq("id", email.id);
    } else if (eventType === "bounced" || eventType === "complained") {
      await supabase
        .from("record_emails")
        .update({ status: eventType === "bounced" ? "bounced" : "failed" })
        .eq("id", email.id);
    }

    return event as EmailEvent;
  },

  /**
   * Get all events for an email
   */
  async getEmailEvents(emailId: string): Promise<EmailEvent[]> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("email_events")
      .select("*")
      .eq("email_id", emailId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to get email events:", error);
      return [];
    }

    return (data || []) as EmailEvent[];
  },

  /**
   * Get aggregate email stats for a record
   */
  async getEmailStats(recordId: string): Promise<EmailStats> {
    const supabase = getSupabaseAdmin();

    const { data: emails, error } = await supabase
      .from("record_emails")
      .select("id, direction, status, opened_at, clicked_at, open_count, click_count")
      .eq("record_id", recordId)
      .eq("direction", "outbound");

    if (error || !emails) {
      return {
        total_sent: 0,
        total_delivered: 0,
        total_opened: 0,
        total_clicked: 0,
        total_bounced: 0,
        open_rate: 0,
        click_rate: 0,
      };
    }

    const totalSent = emails.length;
    const totalDelivered = emails.filter(e => 
      ["delivered", "opened", "clicked"].includes(e.status)
    ).length;
    const totalOpened = emails.filter(e => e.opened_at !== null).length;
    const totalClicked = emails.filter(e => e.clicked_at !== null).length;
    const totalBounced = emails.filter(e => e.status === "bounced").length;

    return {
      total_sent: totalSent,
      total_delivered: totalDelivered,
      total_opened: totalOpened,
      total_clicked: totalClicked,
      total_bounced: totalBounced,
      open_rate: totalDelivered > 0 ? (totalOpened / totalDelivered) * 100 : 0,
      click_rate: totalOpened > 0 ? (totalClicked / totalOpened) * 100 : 0,
    };
  },

  // ===========================================
  // EMAIL TEMPLATE METHODS
  // ===========================================

  /**
   * Create a new email template
   */
  async createTemplate(
    workspaceId: string,
    data: {
      name: string;
      subject: string;
      body_html: string;
      body_text?: string;
      category?: string;
      placeholders?: string[];
      is_default?: boolean;
    },
    userId?: string
  ): Promise<EmailTemplate> {
    const supabase = getSupabaseAdmin();

    // If setting as default, unset other defaults in same category
    if (data.is_default) {
      await supabase
        .from("email_templates")
        .update({ is_default: false })
        .eq("workspace_id", workspaceId)
        .eq("category", data.category || "general");
    }

    const { data: template, error } = await supabase
      .from("email_templates")
      .insert({
        workspace_id: workspaceId,
        name: data.name,
        subject: data.subject,
        body_html: data.body_html,
        body_text: data.body_text,
        category: data.category || "general",
        placeholders: data.placeholders || [],
        is_default: data.is_default || false,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create template: ${error.message}`);
    }

    return template as EmailTemplate;
  },

  /**
   * Get all templates for a workspace
   */
  async getTemplates(
    workspaceId: string,
    options?: { category?: string; activeOnly?: boolean }
  ): Promise<EmailTemplate[]> {
    const supabase = getSupabaseAdmin();

    let query = supabase
      .from("email_templates")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("name", { ascending: true });

    if (options?.category) {
      query = query.eq("category", options.category);
    }

    if (options?.activeOnly !== false) {
      query = query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get templates: ${error.message}`);
    }

    return (data || []) as EmailTemplate[];
  },

  /**
   * Get a single template by ID
   */
  async getTemplate(templateId: string): Promise<EmailTemplate | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("id", templateId)
      .single();

    if (error && error.code !== "PGRST116") {
      throw new Error(`Failed to get template: ${error.message}`);
    }

    return data as EmailTemplate | null;
  },

  /**
   * Update an email template
   */
  async updateTemplate(
    templateId: string,
    data: Partial<{
      name: string;
      subject: string;
      body_html: string;
      body_text: string;
      category: string;
      placeholders: string[];
      is_default: boolean;
      is_active: boolean;
    }>
  ): Promise<EmailTemplate> {
    const supabase = getSupabaseAdmin();

    // If setting as default, need to unset others
    if (data.is_default) {
      const { data: currentTemplate } = await supabase
        .from("email_templates")
        .select("workspace_id, category")
        .eq("id", templateId)
        .single();

      if (currentTemplate) {
        await supabase
          .from("email_templates")
          .update({ is_default: false })
          .eq("workspace_id", currentTemplate.workspace_id)
          .eq("category", data.category || currentTemplate.category);
      }
    }

    const { data: template, error } = await supabase
      .from("email_templates")
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq("id", templateId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update template: ${error.message}`);
    }

    return template as EmailTemplate;
  },

  /**
   * Delete an email template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from("email_templates")
      .delete()
      .eq("id", templateId);

    if (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  },

  /**
   * Resolve template placeholders with actual values
   */
  resolveTemplatePlaceholders(
    template: { subject: string; body_html: string; body_text?: string },
    record: { id: string; name?: string; [key: string]: unknown },
    fields: Array<{ name: string; [key: string]: unknown }>,
    customValues?: Record<string, string>
  ): { subject: string; body_html: string; body_text?: string } {
    const replacePlaceholders = (text: string): string => {
      // System placeholders
      let result = text
        .replace(/\{\{record_name\}\}/g, record.name || "")
        .replace(/\{\{record_id\}\}/g, record.id)
        .replace(/\{\{record_email\}\}/g, String(record.email || ""))
        .replace(/\{\{date\}\}/g, new Date().toLocaleDateString())
        .replace(/\{\{time\}\}/g, new Date().toLocaleTimeString())
        .replace(/\{\{sender_name\}\}/g, customValues?.sender_name || EMAIL_FROM_NAME)
        .replace(/\{\{company_name\}\}/g, customValues?.company_name || "US Prime Realty");

      // Field placeholders: {{field:FieldName}}
      const fieldPattern = /\{\{field:([^}]+)\}\}/g;
      result = result.replace(fieldPattern, (match, fieldName) => {
        const field = fields.find(f => f.name === fieldName);
        if (field && record[fieldName] !== undefined) {
          return String(record[fieldName]);
        }
        return customValues?.[`field:${fieldName}`] || "";
      });

      // Custom placeholders
      if (customValues) {
        Object.entries(customValues).forEach(([key, value]) => {
          if (!key.startsWith("field:")) {
            result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
          }
        });
      }

      return result;
    };

    return {
      subject: replacePlaceholders(template.subject),
      body_html: replacePlaceholders(template.body_html),
      body_text: template.body_text ? replacePlaceholders(template.body_text) : undefined,
    };
  },

  /**
   * Extract placeholders from template content
   */
  extractPlaceholders(content: string): string[] {
    const placeholders = new Set<string>();
    const pattern = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = pattern.exec(content)) !== null) {
      placeholders.add(match[1]);
    }

    return Array.from(placeholders);
  },

  // ===========================================
  // EMAIL ATTACHMENT METHODS
  // ===========================================

  /**
   * Get record documents available for attachment
   */
  async getRecordDocumentsForAttachment(recordId: string): Promise<Array<{
    id: string;
    filename: string;
    content_type: string;
    size: number;
    storage_path: string;
  }>> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("record_documents")
      .select("id, filename, content_type, size, storage_path")
      .eq("record_id", recordId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to get record documents:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Prepare attachment content for sending via Resend
   */
  async prepareAttachment(storagePath: string): Promise<{
    content: string;
    filename: string;
    content_type: string;
  } | null> {
    const supabase = getSupabaseAdmin();

    // Download file from Supabase Storage
    const { data, error } = await supabase.storage
      .from("documents")
      .download(storagePath);

    if (error || !data) {
      console.error("Failed to download attachment:", error);
      return null;
    }

    // Convert to base64
    const buffer = await data.arrayBuffer();
    const base64Content = Buffer.from(buffer).toString("base64");

    // Extract filename from path
    const filename = storagePath.split("/").pop() || "attachment";

    return {
      content: base64Content,
      filename,
      content_type: data.type,
    };
  },

  /**
   * Send email with attachments
   */
  async sendEmailWithAttachments(
    payload: SendEmailPayload,
    attachmentDocIds: string[],
    userId?: string
  ): Promise<RecordEmail> {
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabase = getSupabaseAdmin();

    // Get or create the record's unique email address for Reply-To
    const recordEmailAddress = await this.generateRecordEmailAddress(payload.record_id);

    // Prepare attachments
    const preparedAttachments: Array<{
      filename: string;
      content: string;
      content_type: string;
    }> = [];

    if (attachmentDocIds.length > 0) {
      // Get document info
      const { data: docs } = await supabase
        .from("record_documents")
        .select("id, filename, content_type, storage_path")
        .in("id", attachmentDocIds);

      if (docs) {
        for (const doc of docs) {
          const prepared = await this.prepareAttachment(doc.storage_path);
          if (prepared) {
            preparedAttachments.push({
              filename: doc.filename,
              content: prepared.content,
              content_type: doc.content_type,
            });
          }
        }
      }
    }

    // Also handle inline attachments from payload
    if (payload.attachments) {
      for (const att of payload.attachments) {
        if (att.document_id) {
          const { data: doc } = await supabase
            .from("record_documents")
            .select("filename, content_type, storage_path")
            .eq("id", att.document_id)
            .single();

          if (doc) {
            const prepared = await this.prepareAttachment(doc.storage_path);
            if (prepared) {
              preparedAttachments.push({
                filename: doc.filename,
                content: prepared.content,
                content_type: doc.content_type,
              });
            }
          }
        }
      }
    }

    // Generate thread ID
    const threadId = payload.in_reply_to || `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Send via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${EMAIL_FROM_NAME} <${RESEND_FROM_EMAIL}>`,
        to: [payload.to],
        subject: payload.subject,
        html: payload.body_html,
        text: payload.body_text || payload.body_html.replace(/<[^>]*>/g, ""),
        reply_to: recordEmailAddress.email_address,
        cc: payload.cc?.map((r) => r.email),
        bcc: payload.bcc?.map((r) => r.email),
        attachments: preparedAttachments.map(att => ({
          filename: att.filename,
          content: att.content,
        })),
        headers: {
          "X-Record-ID": payload.record_id,
          "X-Thread-ID": threadId,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Failed to send email via Resend:", errorBody);
      throw new Error(`Failed to send email: ${response.status}`);
    }

    const result = await response.json();

    // Store the sent email in database
    const { data: emailRecord, error: emailError } = await supabase
      .from("record_emails")
      .insert({
        record_id: payload.record_id,
        direction: "outbound",
        from_email: RESEND_FROM_EMAIL,
        from_name: EMAIL_FROM_NAME,
        to_email: payload.to,
        to_name: payload.to_name,
        cc_emails: payload.cc || [],
        bcc_emails: payload.bcc || [],
        subject: payload.subject,
        body_text: payload.body_text || payload.body_html.replace(/<[^>]*>/g, ""),
        body_html: payload.body_html,
        message_id: result.id,
        in_reply_to: payload.in_reply_to,
        thread_id: threadId,
        status: "sent",
        sent_by: userId,
        attachment_count: preparedAttachments.length,
        template_id: payload.template_id,
      })
      .select()
      .single();

    if (emailError) {
      console.error("Failed to store sent email:", emailError);
      throw new Error(`Failed to store email: ${emailError.message}`);
    }

    // Store attachment records
    if (preparedAttachments.length > 0) {
      const attachmentRecords = preparedAttachments.map((att, idx) => ({
        email_id: emailRecord.id,
        filename: att.filename,
        content_type: att.content_type,
        size: Math.ceil((att.content.length * 3) / 4), // Approximate size from base64
        document_id: attachmentDocIds[idx] || null,
      }));

      await supabase.from("email_attachments").insert(attachmentRecords);
    }

    console.log(`Email sent successfully with ${preparedAttachments.length} attachments to ${payload.to}`, { id: result.id });

    return emailRecord as RecordEmail;
  },

  /**
   * Get attachments for an email
   */
  async getEmailAttachments(emailId: string): Promise<EmailAttachment[]> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("email_attachments")
      .select("*")
      .eq("email_id", emailId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to get email attachments:", error);
      return [];
    }

    return (data || []) as EmailAttachment[];
  },
};
