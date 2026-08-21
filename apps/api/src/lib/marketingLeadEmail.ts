import type { WalkthroughLeadDto } from "../schemas/marketing";

/**
 * Emails for the public walkthrough-request form.
 *
 * Both bodies are built from visitor-supplied strings, so every interpolation
 * goes through escapeHtml — this is the one place in the codebase where an
 * unauthenticated stranger controls the contents of an email we send.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * wa.me only accepts digits. Anything outside a plausible international length
 * is dropped rather than linked, so a junk phone field cannot produce a link
 * that silently opens the wrong conversation.
 */
function whatsAppHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15 ? `https://wa.me/${digits}` : null;
}

const ROW = 'padding:9px 0;border-bottom:1px solid #EFE9E1;font-size:14px;';
const LABEL = `${ROW}color:#8A8079;width:150px;vertical-align:top;`;
const VALUE = `${ROW}color:#211E1A;font-weight:600;`;

function field(label: string, value: string): string {
  const shown = value.trim() === "" ? "—" : escapeHtml(value);
  return `<tr><td style="${LABEL}">${escapeHtml(label)}</td><td style="${VALUE}">${shown}</td></tr>`;
}

/** Internal notification to the sales inbox. */
export function walkthroughLeadEmail(lead: WalkthroughLeadDto): string {
  const wa = whatsAppHref(lead.phone);
  const headline = lead.property.trim() === "" ? lead.name : `${lead.name} · ${lead.property}`;

  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FAF8F4;padding:28px;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #EFE9E1;border-radius:16px;overflow:hidden;">
    <div style="background:#211E1A;padding:20px 24px;">
      <p style="margin:0;color:rgba(255,255,255,.45);font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">
        New walkthrough request
      </p>
      <p style="margin:6px 0 0;color:#FFFFFF;font-size:19px;font-weight:800;">${escapeHtml(headline)}</p>
    </div>
    <div style="padding:8px 24px 20px;">
      <table style="width:100%;border-collapse:collapse;">
        ${field("Name", lead.name)}
        ${field("Email", lead.email)}
        ${field("Phone", lead.phone)}
        ${field("Property", lead.property)}
        ${field("City", lead.city)}
        ${field("Rooms", lead.rooms)}
        ${field("Uses today", lead.currentSystem)}
      </table>
      <p style="margin:18px 0 6px;color:#8A8079;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">
        What would make this useful
      </p>
      <p style="margin:0;padding:12px 14px;background:#FCF3EE;border-radius:10px;color:#211E1A;font-size:14px;line-height:1.6;white-space:pre-wrap;">${
        lead.message.trim() === "" ? "No specifics given." : escapeHtml(lead.message)
      }</p>
      <div style="margin-top:20px;">
        <a href="mailto:${encodeURIComponent(lead.email)}" style="display:inline-block;background:#E0532B;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:700;padding:11px 20px;border-radius:999px;">Reply by email</a>
        ${wa ? `<a href="${wa}" style="display:inline-block;margin-left:8px;border:1px solid #211E1A;color:#211E1A;text-decoration:none;font-size:13px;font-weight:700;padding:10px 20px;border-radius:999px;">Message on WhatsApp</a>` : ""}
      </div>
    </div>
  </div>
</div>`.trim();
}

/**
 * Acknowledgement to the visitor. Deliberately says nothing about what the
 * product does — it exists to confirm the form worked, not to sell.
 */
export function walkthroughAckEmail(lead: WalkthroughLeadDto): string {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#FAF8F4;padding:28px;">
  <div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #EFE9E1;border-radius:16px;padding:32px;">
    <p style="margin:0;color:#E0532B;font-size:10px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">Innflo</p>
    <h1 style="margin:14px 0 0;color:#211E1A;font-size:24px;font-weight:800;line-height:1.25;">Thanks, ${escapeHtml(lead.name)} — we have your request.</h1>
    <p style="margin:16px 0 0;color:#5C544D;font-size:15px;line-height:1.65;">
      Your details are with our team and someone will get back to you to arrange a time.
      We will use what you told us about your property to keep the walkthrough focused
      rather than generic.
    </p>
    <p style="margin:16px 0 0;color:#5C544D;font-size:15px;line-height:1.65;">
      If anything changes in the meantime, just reply to this email.
    </p>
    <p style="margin:26px 0 0;padding-top:18px;border-top:1px solid #EFE9E1;color:#8A8079;font-size:12px;line-height:1.6;">
      You are receiving this because a walkthrough was requested from innflo.co using this
      address. If that was not you, you can ignore this message — we will not email again.
    </p>
  </div>
</div>`.trim();
}
