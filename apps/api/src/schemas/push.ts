import { z } from "zod";

export const subscribePushSchema = z.object({
  endpoint: z.string().url(),
  p256dh:   z.string().min(1),
  auth:     z.string().min(1),
});
export type SubscribePushDto = z.infer<typeof subscribePushSchema>;

export const unsubscribePushSchema = z.object({
  endpoint: z.string().url(),
});
export type UnsubscribePushDto = z.infer<typeof unsubscribePushSchema>;
