import { z } from "zod";

/**
 * Public marketing forms — no auth, no tenant, no session. Every field here is
 * attacker-controlled, so lengths are capped at the schema boundary and nothing
 * reaches an email body without escaping (see lib/marketingLeadEmail.ts).
 */

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");

export const walkthroughLeadSchema = z.object({
  name:          z.string().trim().min(1, "Name is required").max(120),
  email:         z.string().trim().max(200).email("A valid email is required"),
  property:      optionalText(160),
  city:          optionalText(120),
  rooms:         optionalText(40),
  phone:         optionalText(40),
  currentSystem: optionalText(200),
  message:       optionalText(2000),
  // Honeypot. Rendered off-screen and aria-hidden on the site, so a human never
  // fills it in and a naive bot almost always does. Kept in the schema rather
  // than stripped so the route can see it and silently drop the submission.
  website:       optionalText(200),
});

export type WalkthroughLeadDto = z.infer<typeof walkthroughLeadSchema>;
