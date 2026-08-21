/**
 * Public marketing routes — no authentication, no tenant context.
 * Mounted at /api/public/marketing in index.ts.
 *
 * This exists so a walkthrough request is captured the moment it is submitted.
 * The contact form used to hand off straight to wa.me, which meant any visitor
 * who did not complete the WhatsApp step — anyone on desktop without WhatsApp
 * Web paired, anyone in an in-app browser, anyone with a popup blocker — was
 * lost silently, with no record that they had ever filled the form in.
 */

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { env } from "../lib/env";
import { sendEmail } from "../services/EmailService";
import { walkthroughLeadSchema } from "../schemas/marketing";
import { walkthroughAckEmail, walkthroughLeadEmail } from "../lib/marketingLeadEmail";
import { AppError } from "../utils/AppError";

const router: Router = Router();

// Unauthenticated and it sends mail, so it is a spam target. Tighter than the
// global /api limiter, and keyed on IP because there is no session to key on.
const leadLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip ?? "unknown",
  message: { error: "Too many requests from this IP. Please email us directly instead." },
});

// POST /api/public/marketing/walkthrough — walkthrough request from the site's contact form
router.post("/walkthrough", leadLimit, async (req, res) => {
  const lead = walkthroughLeadSchema.parse(req.body);

  // Honeypot tripped. Answer exactly as we would on success: a 4xx here would
  // teach a bot which field is the filter, and it would simply stop sending it.
  if (lead.website !== "") {
    res.status(201).json({ data: { received: true } });
    return;
  }

  const notified = await sendEmail({
    to:       env.SALES_LEAD_EMAIL,
    toName:   "Innflo Sales",
    subject:  `Walkthrough request — ${lead.name}${lead.property === "" ? "" : ` (${lead.property})`}`,
    htmlBody: walkthroughLeadEmail(lead),
  });

  if (!notified.success) {
    // Last resort so the lead survives even a total mail-provider outage: the
    // details land in the server log, where they can be recovered by hand.
    console.error("❌ Walkthrough lead could not be emailed — recording it here:", JSON.stringify(lead));
    throw new AppError(502, "We could not record your request just now. Please email us directly and we will pick it up.");
  }

  // Best-effort: the lead is already captured, so a bounce on a mistyped
  // address must never turn a successful submission into a failed one.
  sendEmail({
    to:       lead.email,
    toName:   lead.name,
    subject:  "We have your Innflo walkthrough request",
    htmlBody: walkthroughAckEmail(lead),
  }).catch((err: unknown) => console.error("Walkthrough acknowledgement failed:", err));

  res.status(201).json({ data: { received: true } });
});

export default router;
