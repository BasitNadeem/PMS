import type { ReservationEmailJobData, ReservationEmailKind } from "../jobs/queues";

export type ReservationEmailData = Omit<ReservationEmailJobData, "guestEmail"> & {
  checkInDate:  string;
  checkOutDate: string;
};

const COPY: Record<ReservationEmailKind, {
  eyebrow: string;
  heading: string;
  intro: string;
  status: string;
  footer: string;
}> = {
  REQUEST_RECEIVED: {
    eyebrow: "Booking request received",
    heading: "Your stay is one step closer.",
    intro: "We have received your booking request. The hotel will review it and contact you shortly with confirmation.",
    status: "Awaiting hotel confirmation",
    footer: "A memorable stay starts with a warm welcome.",
  },
  CONFIRMED: {
    eyebrow: "Reservation confirmed",
    heading: "Your room is ready when you are.",
    intro: "Your reservation is confirmed. Keep this email handy—it has everything you need for your upcoming stay.",
    status: "Confirmed",
    footer: "Rest well. Explore more. We’ll see you soon.",
  },
  CANCELLED: {
    eyebrow: "Reservation cancelled",
    heading: "Your reservation has been cancelled.",
    intro: "This confirms that the reservation shown below has been cancelled. If this was unexpected, please contact the hotel directly.",
    status: "Cancelled",
    footer: "Plans change. Our welcome will still be here.",
  },
};

function escapeHtml(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function multiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function safeImageUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? escapeHtml(url.toString()) : null;
  } catch {
    return null;
  }
}

function safeLink(value: string | null): string | null {
  if (!value) return null;
  try {
    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? escapeHtml(url.toString()) : null;
  } catch {
    return null;
  }
}

function formatPKR(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString("en-PK")}`;
}

function guestsLine(adults: number, children: number): string {
  const adultsLabel = `${adults} adult${adults === 1 ? "" : "s"}`;
  if (children <= 0) return adultsLabel;
  return `${adultsLabel}, ${children} child${children === 1 ? "" : "ren"}`;
}

function hotelLocation(data: ReservationEmailData): string | null {
  const parts = [data.hotelAddress, data.hotelCity].filter(Boolean);
  return parts.length > 0 ? [...new Set(parts)].join(", ") : null;
}

function directionsCard(data: ReservationEmailData): string {
  const location = hotelLocation(data);
  if (!location) return "";
  const destination = `${data.hotelName}, ${location}`;
  const directionsUrl = escapeHtml(
    `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&dir_action=navigate`,
  );

  return `
    <div style="background:#f4f2ee; border:1px solid #e5e0d8; border-radius:14px; padding:18px 20px; text-align:left;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:middle; padding-right:14px;">
            <div style="color:${data.accentColor}; font-size:11px; font-weight:bold; letter-spacing:1.3px; text-transform:uppercase;">Hotel location</div>
            <div style="margin-top:5px; color:#293330; font-size:14px; line-height:21px;">${escapeHtml(location)}</div>
          </td>
          <td style="vertical-align:middle; text-align:right; white-space:nowrap;">
            <a href="${directionsUrl}" target="_blank" style="display:inline-block; background:${data.accentColor}; border-radius:999px; padding:11px 17px; color:#ffffff; text-decoration:none; font-size:12px; font-weight:bold;">Get directions&nbsp;&nbsp;→</a>
          </td>
        </tr>
      </table>
    </div>`;
}

function contactLink(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block; color:#ffffff; text-decoration:none; font-size:13px; line-height:20px; margin:3px 10px;">${escapeHtml(label)}</a>`;
}

function amenityGrid(data: ReservationEmailData): string {
  const amenities = [
    ...data.hotelAmenities,
    ...data.rooms.flatMap((room) => room.amenities),
  ].filter((value, index, all) => value && all.indexOf(value) === index).slice(0, 10);

  if (amenities.length === 0) return "";

  const rows: string[] = [];
  for (let index = 0; index < amenities.length; index += 2) {
    const left = amenities[index];
    const right = amenities[index + 1];
    rows.push(`
      <tr>
        <td width="50%" style="padding:6px 8px 6px 0; vertical-align:top;">
          <div style="border:1px solid #e7e2da; border-radius:999px; padding:8px 12px; color:#374151; font-size:13px;">
            <span style="color:${data.accentColor}; font-weight:bold; margin-right:6px;">✓</span>${escapeHtml(left)}
          </div>
        </td>
        <td width="50%" style="padding:6px 0 6px 8px; vertical-align:top;">
          ${right ? `<div style="border:1px solid #e7e2da; border-radius:999px; padding:8px 12px; color:#374151; font-size:13px;"><span style="color:${data.accentColor}; font-weight:bold; margin-right:6px;">✓</span>${escapeHtml(right)}</div>` : ""}
        </td>
      </tr>`);
  }

  return `
    <tr>
      <td class="pad" style="padding:0 34px 30px;">
        <p style="margin:0 0 4px; color:${data.accentColor}; font-size:11px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase;">At your stay</p>
        <h2 style="margin:0 0 12px; color:#17211e; font-family:Georgia, 'Times New Roman', serif; font-size:24px; font-weight:normal;">A few things to look forward to</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>
      </td>
    </tr>`;
}

function photoGallery(data: ReservationEmailData): string {
  const photos = data.rooms
    .flatMap((room) => room.photoUrls)
    .map(safeImageUrl)
    .filter((url): url is string => Boolean(url))
    .filter((url, index, all) => all.indexOf(url) === index)
    .slice(0, 5);

  if (photos.length === 0) return "";

  const hero = photos[0];
  const thumbnails = photos.slice(1);
  const thumbWidth = thumbnails.length > 0 ? Math.floor(100 / thumbnails.length) : 100;

  return `
    <tr>
      <td class="pad" style="padding:0 34px 26px;">
        <img src="${hero}" alt="Your room at ${escapeHtml(data.hotelName)}" width="572" style="width:100%; max-width:572px; height:auto; max-height:380px; object-fit:cover; border-radius:16px; display:block;">
        ${thumbnails.length > 0 ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
            <tr>
              ${thumbnails.map((url, index) => `
                <td width="${thumbWidth}%" style="padding:${index === 0 ? "0 4px 0 0" : index === thumbnails.length - 1 ? "0 0 0 4px" : "0 4px"};">
                  <img src="${url}" alt="" width="140" style="width:100%; height:88px; object-fit:cover; border-radius:10px; display:block;">
                </td>`).join("")}
            </tr>
          </table>` : ""}
      </td>
    </tr>`;
}

function roomRows(data: ReservationEmailData): string {
  return data.rooms.map((room) => `
    <tr>
      <td style="padding:13px 0; border-bottom:1px solid #ebe7e1; vertical-align:top;">
        <div style="color:#17211e; font-size:14px; font-weight:bold;">${room.quantity > 1 ? `${room.quantity} × ` : ""}${escapeHtml(room.name)}</div>
        ${room.description ? `<div style="color:#7b817e; font-size:12px; line-height:18px; margin-top:3px;">${escapeHtml(room.description)}</div>` : ""}
      </td>
      <td style="padding:13px 0 13px 16px; border-bottom:1px solid #ebe7e1; color:#17211e; font-size:14px; font-weight:bold; text-align:right; white-space:nowrap; vertical-align:top;">${formatPKR(room.amount)}</td>
    </tr>`).join("");
}

function policySection(data: ReservationEmailData): string {
  const cancellation = data.cancellationPolicy;
  const payment = data.kind !== "CANCELLED" ? data.bookingPaymentTerms : null;
  if (!cancellation && !payment) return "";

  return `
    <tr>
      <td class="pad" style="padding:0 34px 30px;">
        <div style="background:#f4f2ee; border-radius:14px; padding:20px 22px;">
          ${cancellation ? `
            <p style="margin:0 0 5px; color:#17211e; font-size:13px; font-weight:bold;">Cancellation policy</p>
            <p style="margin:0; color:#626967; font-size:12px; line-height:19px;">${multiline(cancellation)}</p>` : ""}
          ${payment ? `
            <p style="margin:${cancellation ? "16px" : "0"} 0 5px; padding:${cancellation ? "16px" : "0"} 0 0; border-top:${cancellation ? "1px solid #ded9d1" : "0"}; color:#17211e; font-size:13px; font-weight:bold;">Booking &amp; payment terms</p>
            <p style="margin:0; color:#626967; font-size:12px; line-height:19px;">${multiline(payment)}</p>` : ""}
        </div>
      </td>
    </tr>`;
}

function cancellationEmail(data: ReservationEmailData): string {
  const year = new Date().getFullYear();
  const logoUrl = safeImageUrl(data.hotelLogoUrl);
  const location = hotelLocation(data);
  const website = safeLink(data.hotelWebsite);
  const supportNumber = data.hotelPhone ?? data.hotelWhatsapp;
  const supportDigits = supportNumber?.replace(/[^\d+]/g, "") ?? "";
  const phoneHref = supportDigits ? `tel:${escapeHtml(supportDigits)}` : null;
  const whatsappDigits = data.hotelWhatsapp?.replace(/\D/g, "") ?? "";
  const whatsappHref = whatsappDigits ? `https://wa.me/${escapeHtml(whatsappDigits)}` : null;
  const preheader = `Reservation cancelled · ${data.confirmationNumber} · ${data.hotelName}`;

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <style>
    @media only screen and (max-width: 640px) {
      .shell { width:100% !important; }
      .pad { padding-left:22px !important; padding-right:22px !important; }
      .cancel-title { font-size:38px !important; line-height:43px !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:#efede9; -webkit-font-smoothing:antialiased;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efede9;">
    <tr>
      <td align="center" style="padding:24px 10px;">
        <table role="presentation" class="shell" width="640" cellpadding="0" cellspacing="0" style="width:640px; max-width:640px; background:#ffffff; border-radius:22px; overflow:hidden; font-family:Arial, Helvetica, sans-serif; box-shadow:0 10px 35px rgba(27,34,31,0.08);">
          <tr>
            <td class="pad" style="padding:28px 38px 22px; border-bottom:1px solid #e6e3dd; text-align:center;">
              ${logoUrl
                ? `<img src="${logoUrl}" alt="${escapeHtml(data.hotelName)}" style="display:inline-block; max-height:58px; max-width:190px; width:auto;">`
                : `<div style="font-family:Georgia, 'Times New Roman', serif; color:#17211e; font-size:25px; font-weight:bold;">${escapeHtml(data.hotelName)}</div>`}
            </td>
          </tr>

          <tr>
            <td class="pad" style="padding:46px 38px 34px;">
              <p style="margin:0 0 14px; color:${data.accentColor}; font-size:11px; font-weight:bold; letter-spacing:1.8px; text-transform:uppercase;">Reservation cancelled</p>
              <h1 class="cancel-title" style="margin:0; max-width:500px; color:#183b38; font-family:Georgia, 'Times New Roman', serif; font-size:48px; line-height:54px; font-weight:normal;">Your reservation has been cancelled.</h1>
              <p style="margin:28px 0 0; color:#293330; font-size:16px; line-height:26px;">Hello ${escapeHtml(data.guestName)},</p>
              <p style="margin:12px 0 0; color:#59615e; font-size:15px; line-height:24px;">
                This email confirms that your reservation at ${escapeHtml(data.hotelName)} has been cancelled.
                If this was unexpected, please contact the hotel and we’ll be happy to help.
              </p>
              <div style="margin-top:28px; border-top:1px solid #d9d5ce; border-bottom:1px solid #d9d5ce; padding:17px 0; color:#626967; font-size:13px;">
                Cancellation reference
                <strong style="display:block; color:${data.accentColor}; font-size:21px; margin-top:5px;">${escapeHtml(data.confirmationNumber)}</strong>
              </div>
              ${data.cancellationPolicy ? `
                <div style="margin-top:24px; background:#f4f2ee; border-radius:14px; padding:20px 22px;">
                  <p style="margin:0 0 6px; color:#17211e; font-size:13px; font-weight:bold;">Cancellation policy</p>
                  <p style="margin:0; color:#626967; font-size:12px; line-height:19px;">${multiline(data.cancellationPolicy)}</p>
                </div>` : ""}
            </td>
          </tr>

          <tr>
            <td class="pad" style="padding:0 38px 46px; text-align:center;">
              <div style="border-top:1px solid #d9d5ce; padding-top:36px;">
                <h2 style="margin:0; color:#183b38; font-family:Georgia, 'Times New Roman', serif; font-size:30px; font-weight:normal;">We’re always ready to help.</h2>
                <p style="margin:14px auto 20px; max-width:480px; color:#626967; font-size:14px; line-height:22px;">
                  If you have any questions, reply to this email or contact the hotel directly.
                </p>
                ${phoneHref ? `
                  <a href="${phoneHref}" style="display:inline-block; border:1px solid #183b38; border-radius:999px; padding:12px 22px; color:#183b38; text-decoration:none; font-size:15px; font-weight:bold;">
                    &#9742;&nbsp;&nbsp;${escapeHtml(supportNumber ?? "Call hotel")}
                  </a>` : data.hotelEmail ? `
                  <a href="mailto:${escapeHtml(data.hotelEmail)}" style="display:inline-block; border:1px solid #183b38; border-radius:999px; padding:12px 22px; color:#183b38; text-decoration:none; font-size:14px; font-weight:bold;">
                    ${escapeHtml(data.hotelEmail)}
                  </a>` : ""}
                <p style="margin:28px 0 0; color:#59615e; font-family:Georgia, 'Times New Roman', serif; font-size:18px; font-style:italic;">We hope to welcome you in the future.</p>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background:#183b38; padding:34px 28px; text-align:center;">
              <p style="margin:0; color:#ffffff; font-family:Georgia, 'Times New Roman', serif; font-size:22px; font-style:italic;">Plans change. Our welcome will still be here.</p>
              <p style="margin:12px auto 18px; max-width:430px; color:#b8cbc7; font-size:12px; line-height:19px;">
                ${location ? escapeHtml(location) : escapeHtml(data.hotelName)}
              </p>
              <div>
                ${phoneHref ? contactLink(supportNumber ?? "Call hotel", phoneHref) : ""}
                ${whatsappHref ? contactLink("WhatsApp", whatsappHref) : ""}
                ${data.hotelEmail ? contactLink(data.hotelEmail, `mailto:${escapeHtml(data.hotelEmail)}`) : ""}
                ${website ? contactLink("Visit website", website) : ""}
              </div>
              <div style="height:1px; background:#31524f; margin:24px auto 18px; max-width:450px;"></div>
              <p style="margin:0; color:#8fb4ae; font-size:11px;">© ${year} ${escapeHtml(data.hotelName)} &nbsp;·&nbsp; <a href="https://innflo.co" style="color:#b8cbc7; text-decoration:none;">Powered by InnFlo</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function reservationLifecycleEmail(data: ReservationEmailData): string {
  if (data.kind === "CANCELLED") return cancellationEmail(data);

  const copy = COPY[data.kind];
  const year = new Date().getFullYear();
  const logoUrl = safeImageUrl(data.hotelLogoUrl);
  const location = hotelLocation(data);
  const website = safeLink(data.hotelWebsite);
  const phoneHref = data.hotelPhone ? `tel:${escapeHtml(data.hotelPhone.replace(/[^\d+]/g, ""))}` : null;
  const whatsappDigits = data.hotelWhatsapp?.replace(/\D/g, "") ?? "";
  const whatsappHref = whatsappDigits ? `https://wa.me/${escapeHtml(whatsappDigits)}` : null;
  const preheader = `${copy.eyebrow} · ${data.confirmationNumber} · ${data.hotelName}`;

  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <style>
    @media only screen and (max-width: 640px) {
      .shell { width:100% !important; }
      .pad { padding-left:20px !important; padding-right:20px !important; }
      .hero-title { font-size:34px !important; line-height:38px !important; }
      .date-cell { display:block !important; width:100% !important; text-align:left !important; padding:10px 0 !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background:#efede9; -webkit-font-smoothing:antialiased;">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efede9;">
    <tr>
      <td align="center" style="padding:24px 10px;">
        <table role="presentation" class="shell" width="640" cellpadding="0" cellspacing="0" style="width:640px; max-width:640px; background:#ffffff; border-radius:22px; overflow:hidden; font-family:Arial, Helvetica, sans-serif; box-shadow:0 10px 35px rgba(27,34,31,0.08);">
          <tr>
            <td class="pad" style="padding:26px 34px 20px; border-bottom:1px solid #ece8e2;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;">
                    ${logoUrl
                      ? `<img src="${logoUrl}" alt="${escapeHtml(data.hotelName)}" style="display:block; max-height:54px; max-width:180px; width:auto;">`
                      : `<div style="font-family:Georgia, 'Times New Roman', serif; color:#17211e; font-size:23px; font-weight:bold;">${escapeHtml(data.hotelName)}</div>`}
                  </td>
                  <td style="text-align:right; vertical-align:middle;">
                    <span style="display:inline-block; background:#edf4ef; color:#2f7256; border-radius:999px; padding:7px 11px; font-size:11px; font-weight:bold;">${escapeHtml(copy.status)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="pad" style="padding:34px 34px 24px;">
              <p style="margin:0 0 14px; color:${data.accentColor}; font-size:11px; font-weight:bold; letter-spacing:1.8px; text-transform:uppercase;">${escapeHtml(copy.eyebrow)}</p>
              <h1 class="hero-title" style="margin:0; max-width:520px; color:#17211e; font-family:Georgia, 'Times New Roman', serif; font-size:42px; line-height:46px; font-weight:normal;">${escapeHtml(copy.heading)}</h1>
              <p style="margin:18px 0 0; color:#59615e; font-size:15px; line-height:24px;">Hello ${escapeHtml(data.guestName)},<br>${escapeHtml(copy.intro)}</p>
              <div style="margin-top:22px; border-top:1px solid #d9d5ce; padding-top:15px; color:#59615e; font-size:13px;">
                Reference <strong style="color:${data.accentColor}; font-size:18px; margin-left:6px;">${escapeHtml(data.confirmationNumber)}</strong>
              </div>
            </td>
          </tr>

          ${photoGallery(data)}

          <tr>
            <td class="pad" style="padding:0 34px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#172b29; border-radius:14px;">
                <tr>
                  <td class="date-cell" width="50%" style="padding:20px 22px; vertical-align:top;">
                    <div style="color:#91aaa5; font-size:10px; font-weight:bold; letter-spacing:1.4px; text-transform:uppercase;">Check-in</div>
                    <div style="color:#ffffff; font-family:Georgia, 'Times New Roman', serif; font-size:20px; margin-top:6px;">${escapeHtml(data.checkInDate)}</div>
                  </td>
                  <td class="date-cell" width="50%" style="padding:20px 22px; text-align:right; vertical-align:top;">
                    <div style="color:#91aaa5; font-size:10px; font-weight:bold; letter-spacing:1.4px; text-transform:uppercase;">Check-out</div>
                    <div style="color:#ffffff; font-family:Georgia, 'Times New Roman', serif; font-size:20px; margin-top:6px;">${escapeHtml(data.checkOutDate)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="pad" style="padding:0 34px 30px;">
              <p style="margin:0 0 4px; color:${data.accentColor}; font-size:11px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase;">Stay details</p>
              <h2 style="margin:0 0 8px; color:#17211e; font-family:Georgia, 'Times New Roman', serif; font-size:25px; font-weight:normal;">${data.rooms.reduce((sum, room) => sum + room.quantity, 0)} room${data.rooms.reduce((sum, room) => sum + room.quantity, 0) === 1 ? "" : "s"} · ${data.nights} night${data.nights === 1 ? "" : "s"}</h2>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${roomRows(data)}
                <tr>
                  <td style="padding:13px 0; color:#6b716f; font-size:13px;">Guests</td>
                  <td style="padding:13px 0; color:#17211e; font-size:14px; font-weight:bold; text-align:right;">${escapeHtml(guestsLine(data.adults, data.children))}</td>
                </tr>
                ${data.promoCode ? `<tr><td style="padding:6px 0; color:#6b716f; font-size:13px;">Promo / corporate code</td><td style="padding:6px 0; color:${data.accentColor}; font-size:13px; font-weight:bold; text-align:right;">${escapeHtml(data.promoCode)}</td></tr>` : ""}
                <tr>
                  <td style="padding:18px 0 0; border-top:1px solid #d8d3cb; color:#17211e; font-size:14px; font-weight:bold;">Estimated total</td>
                  <td style="padding:18px 0 0; border-top:1px solid #d8d3cb; color:#17211e; font-family:Georgia, 'Times New Roman', serif; font-size:24px; text-align:right;">${formatPKR(data.totalAmount)}</td>
                </tr>
              </table>
              ${data.specialRequests ? `<div style="margin-top:22px; border-left:3px solid ${data.accentColor}; padding:2px 0 2px 14px;"><p style="margin:0 0 4px; color:#17211e; font-size:12px; font-weight:bold;">Special requests</p><p style="margin:0; color:#69706d; font-size:13px; line-height:20px;">${multiline(data.specialRequests)}</p></div>` : ""}
            </td>
          </tr>

          ${amenityGrid(data)}
          ${hotelLocation(data) ? `
            <tr>
              <td class="pad" style="padding:0 34px 30px;">
                ${directionsCard(data)}
              </td>
            </tr>` : ""}
          ${policySection(data)}

          <tr>
            <td style="background:#183b38; padding:34px 28px; text-align:center;">
              <div style="color:#8fb4ae; font-size:12px; letter-spacing:4px; margin-bottom:12px;">◆&nbsp;&nbsp;▲&nbsp;&nbsp;◆</div>
              <p style="margin:0; color:#ffffff; font-family:Georgia, 'Times New Roman', serif; font-size:25px; font-style:italic;">${escapeHtml(copy.footer)}</p>
              <p style="margin:12px auto 18px; max-width:430px; color:#b8cbc7; font-size:12px; line-height:19px;">
                ${location ? escapeHtml(location) : escapeHtml(data.hotelName)}
              </p>
              <div>
                ${phoneHref ? contactLink(data.hotelPhone ?? "Call hotel", phoneHref) : ""}
                ${whatsappHref ? contactLink("WhatsApp", whatsappHref) : ""}
                ${data.hotelEmail ? contactLink(data.hotelEmail, `mailto:${escapeHtml(data.hotelEmail)}`) : ""}
                ${website ? contactLink("Visit website", website) : ""}
              </div>
              <div style="height:1px; background:#31524f; margin:24px auto 18px; max-width:450px;"></div>
              <p style="margin:0; color:#8fb4ae; font-size:11px;">© ${year} ${escapeHtml(data.hotelName)} &nbsp;·&nbsp; <a href="https://innflo.co" style="color:#b8cbc7; text-decoration:none;">Powered by InnFlo</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
