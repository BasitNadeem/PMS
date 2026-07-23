export interface BookingConfirmationData {
  hotelName:           string;
  hotelLogoUrl:        string | null;
  hotelAddress:        string | null;
  hotelPhone:          string | null;
  guestName:           string;
  confirmationNumber:  string;
  checkInDate:         string; // pre-formatted, e.g. "Monday, 21 July 2025"
  checkOutDate:        string; // pre-formatted, e.g. "Tuesday, 22 July 2025"
  nights:              number;
  roomTypeName:        string;
  roomPhotoUrl:        string | null;
  adults:              number;
  children:            number;
  totalAmount:          number; // PKR
  specialRequests:      string | null;
}

function formatPKR(amount: number): string {
  return `Rs. ${Math.round(amount).toLocaleString("en-US")}`;
}

function guestsLine(adults: number, children: number): string {
  const adultsLabel = `${adults} Adult${adults === 1 ? "" : "s"}`;
  if (children <= 0) return adultsLabel;
  return `${adultsLabel}, ${children} Child${children === 1 ? "" : "ren"}`;
}

function detailRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 0; color:#6b7280; font-size:14px; vertical-align:top;">${label}</td>
      <td style="padding:8px 0; color:#111827; font-size:14px; font-weight:bold; text-align:right; vertical-align:top;">${value}</td>
    </tr>`;
}

export function bookingConfirmationEmail(data: BookingConfirmationData): string {
  const year = new Date().getFullYear();

  const headerHtml = data.hotelLogoUrl
    ? `<img src="${data.hotelLogoUrl}" alt="${data.hotelName}" style="max-height:60px; max-width:200px; display:block; margin:0 auto;">`
    : `<div style="text-align:center; font-size:20px; font-weight:bold; color:#111827;">${data.hotelName}</div>`;

  const roomPhotoHtml = data.roomPhotoUrl
    ? `<img src="${data.roomPhotoUrl}" width="100%" style="max-width:560px; border-radius:8px; display:block; margin:16px auto;">`
    : "";

  const specialRequestsRow = data.specialRequests
    ? detailRow("Special Requests", data.specialRequests)
    : "";

  const nextStepsPhone = data.hotelPhone
    ? `<p style="margin:8px 0 0; color:#374151; font-size:14px;">For assistance: ${data.hotelPhone}</p>`
    : "";
  const nextStepsAddress = data.hotelAddress
    ? `<p style="margin:8px 0 0; color:#6b7280; font-size:13px;">${data.hotelAddress}</p>`
    : "";

  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; font-family:Arial, Helvetica, sans-serif;">
        <tr>
          <td style="padding:24px; border-bottom:1px solid #e5e7eb;">
            ${headerHtml}
          </td>
        </tr>

        <tr>
          <td style="padding:24px 24px 0;">
            <p style="margin:0 0 4px; font-size:16px; color:#374151;">Hey, ${data.guestName}</p>
            <p style="margin:0 0 8px; font-size:28px; font-weight:bold; color:#111827;">Your reservation is confirmed!</p>
            <hr style="border:none; border-top:1px solid #e5e7eb; margin:16px 0;">
            <p style="margin:0; font-size:14px; color:#374151;">
              Confirmation Number:
              <span style="color:#B45309; font-weight:bold; font-size:18px;">${data.confirmationNumber}</span>
            </p>
          </td>
        </tr>

        ${roomPhotoHtml ? `<tr><td style="padding:0 24px;">${roomPhotoHtml}</td></tr>` : ""}

        <tr>
          <td style="padding:24px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="50%" style="vertical-align:top;">
                  <div style="color:#6b7280; font-size:12px; text-transform:uppercase; letter-spacing:0.05em;">Check-in</div>
                  <div style="color:#6b7280; font-size:13px; margin-top:4px;">${data.checkInDate.split(",")[0] ?? ""}</div>
                  <div style="color:#111827; font-size:16px; font-weight:bold;">${data.checkInDate.split(",").slice(1).join(",").trim() || data.checkInDate}</div>
                </td>
                <td width="50%" style="vertical-align:top; text-align:right;">
                  <div style="color:#6b7280; font-size:12px; text-transform:uppercase; letter-spacing:0.05em;">Check-out</div>
                  <div style="color:#6b7280; font-size:13px; margin-top:4px;">${data.checkOutDate.split(",")[0] ?? ""}</div>
                  <div style="color:#111827; font-size:16px; font-weight:bold;">${data.checkOutDate.split(",").slice(1).join(",").trim() || data.checkOutDate}</div>
                </td>
              </tr>
            </table>

            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px; border-top:1px solid #e5e7eb;">
              ${detailRow("Guest Name", data.guestName)}
              ${detailRow("Room Type", data.roomTypeName)}
              ${detailRow("Guests", guestsLine(data.adults, data.children))}
              ${detailRow("Nights", String(data.nights))}
              ${detailRow("Estimated Total", formatPKR(data.totalAmount))}
              ${specialRequestsRow}
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 24px 24px;">
            <div style="background-color:#f9fafb; border-radius:8px; padding:16px;">
              <p style="margin:0; color:#374151; font-size:14px;">The hotel will contact you shortly to confirm your booking.</p>
              ${nextStepsPhone}
              ${nextStepsAddress}
            </div>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 24px; border-top:1px solid #e5e7eb; text-align:center;">
            <p style="margin:0; color:#6b7280; font-size:12px;">${data.hotelName}</p>
            <p style="margin:4px 0 0; color:#6b7280; font-size:12px;">© ${year} ${data.hotelName}</p>
            <p style="margin:8px 0 0; font-size:12px;">
              <a href="https://innflo.co" style="color:#6b7280; text-decoration:underline;">Powered by InnFlo</a>
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}
