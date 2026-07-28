export const CONTACT_EMAIL = "hello@innflo.co";
export const SUPPORT_EMAIL = "support@innflo.co";

export const CONTACT_PHONE_DISPLAY = "+92 320 0 INNFLO";
export const CONTACT_PHONE_NUMERIC = "+92 320 0466356";
export const CONTACT_PHONE_HREF = "tel:+923200466356";
export const CONTACT_WHATSAPP = "923200466356";

export const INSTAGRAM_URL = "https://www.instagram.com/innflo.co/";
export const FACEBOOK_URL = "https://www.facebook.com/profile.php?id=61592481567754";

export function getWhatsAppUrl(message?: string) {
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${CONTACT_WHATSAPP}${query}`;
}
