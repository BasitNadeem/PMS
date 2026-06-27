export interface SendResult {
  success:    boolean;
  messageId?: string;
  error?:     string;
}

export async function sendWhatsappMessage(
  toNumber: string,
  message:  string,
): Promise<SendResult> {
  // TODO: Replace this stub with Meta Cloud API call
  // when WhatsApp Business credentials are available.
  //
  // Meta Cloud API endpoint:
  // POST https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages
  // Headers: Authorization: Bearer {WHATSAPP_TOKEN}
  // Body: {
  //   messaging_product: "whatsapp",
  //   to: toNumber,
  //   type: "text",
  //   text: { body: message }
  // }
  //
  // Required env vars (add to .env when ready):
  // WHATSAPP_TOKEN=your_meta_access_token
  // WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id

  // STUB BEHAVIOR: log the message and return success
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("📱 WhatsApp Briefing (STUB MODE)");
  console.log(`To: ${toNumber}`);
  console.log(`Message:\n${message}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await new Promise<void>((resolve) => setTimeout(resolve, 100));

  return { success: true, messageId: `stub_${Date.now()}` };
}
