import { env } from "../lib/env";

export interface SendResult {
  success:    boolean;
  messageId?: string;
  error?:     string;
}

export interface EmailOptions {
  to:       string;
  toName:   string;
  subject:  string;
  htmlBody: string;
}

const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

export async function sendEmail(options: EmailOptions): Promise<SendResult> {
  try {
    const res = await fetch(BREVO_SEND_URL, {
      method:  "POST",
      headers: {
        "api-key":      env.BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name:  env.BREVO_FROM_NAME,
          email: env.BREVO_FROM_EMAIL,
        },
        to:      [{ email: options.to, name: options.toName }],
        subject: options.subject,
        htmlContent: options.htmlBody,
      }),
    });

    const body = await res.json().catch(() => null) as { messageId?: string; message?: string } | null;

    if (!res.ok) {
      const error = body?.message ?? `Brevo API returned ${res.status}`;
      console.error(`❌ Email send failed to ${options.to}: ${error}`);
      return { success: false, error };
    }

    console.log(`✅ Email sent to ${options.to} (messageId: ${body?.messageId ?? "unknown"})`);
    return { success: true, messageId: body?.messageId };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Unknown error sending email";
    console.error(`❌ Email send failed to ${options.to}:`, error);
    return { success: false, error };
  }
}
