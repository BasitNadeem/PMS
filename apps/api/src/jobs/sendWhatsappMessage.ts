import { env } from "../lib/env";

export interface SendResult {
  success:    boolean;
  messageId?: string;
  error?:     string;
  /** True when nothing was actually sent — dev logging or missing credentials. */
  stubbed?:   boolean;
}

/**
 * Normalises whatever an owner typed into the settings field into the digits-only
 * E.164 form the Cloud API expects ("923247635611" — no +, no spaces).
 *
 * Owners enter Pakistani numbers in every shape there is: "+92 334 9857079",
 * "0334-9857079", "03349857079". Meta silently accepts a malformed `to` and
 * reports the send as "accepted" while never delivering it, so this normalises
 * up front and returns null rather than letting a bad number through.
 */
export function toE164Digits(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  let national = digits;
  if (national.startsWith("00")) national = national.slice(2);
  if (national.startsWith("92")) national = national.slice(2);
  else if (national.startsWith("0")) national = national.slice(1);

  // Pakistani mobiles are 3XXXXXXXXX — 10 digits starting with 3. WhatsApp does
  // not exist on landlines, so anything else is a configuration mistake.
  if (!/^3\d{9}$/.test(national)) return null;

  return `92${national}`;
}

const GRAPH_BASE = "https://graph.facebook.com";

interface CloudApiResponse {
  messages?: { id: string; message_status?: string }[];
  error?:    { message?: string; code?: number };
}

/**
 * Sends the nightly briefing as an approved WhatsApp template.
 *
 * It must be a template, not free-form text: briefings are business-initiated,
 * and free-form text only delivers inside a 24-hour window opened by the
 * recipient messaging us first. A text send outside that window returns HTTP 200
 * and is then dropped — which is why the whole message lives in a pre-approved
 * template and only the numbers travel as parameters.
 *
 * `previewText` is the rendered human-readable briefing. It is never transmitted;
 * it is what gets written to whatsapp_briefing_logs so the log stays readable.
 */
export async function sendBriefingTemplate(
  toNumber:       string,
  templateParams: string[],
  previewText:    string,
): Promise<SendResult> {
  const to = toE164Digits(toNumber);
  if (!to) {
    return { success: false, error: `Not a valid Pakistani mobile number: ${toNumber}` };
  }

  const credentialsMissing = !env.WHATSAPP_ACCESS_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID;

  if (env.LOG_WHATSAPP_INSTEAD_OF_SENDING || credentialsMissing) {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`📱 WhatsApp briefing (NOT SENT — ${credentialsMissing ? "no credentials" : "dev logging"})`);
    console.log(`To: +${to}`);
    console.log(`Template: ${env.WHATSAPP_BRIEFING_TEMPLATE} [${templateParams.length} params]`);
    console.log(previewText);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    return { success: true, stubbed: true, messageId: `stub_${Date.now()}` };
  }

  const url = `${GRAPH_BASE}/${env.WHATSAPP_API_VERSION}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: {
        Authorization:  `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type:              "template",
        template: {
          name:     env.WHATSAPP_BRIEFING_TEMPLATE,
          language: { code: env.WHATSAPP_TEMPLATE_LANG },
          components: [
            {
              type:       "body",
              parameters: templateParams.map((text) => ({ type: "text", text })),
            },
          ],
        },
      }),
    });

    const body = (await res.json()) as CloudApiResponse;

    if (!res.ok || body.error) {
      const detail = body.error?.message ?? `HTTP ${res.status}`;
      return { success: false, error: `WhatsApp API: ${detail}` };
    }

    return { success: true, messageId: body.messages?.[0]?.id };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "WhatsApp request failed" };
  }
}
