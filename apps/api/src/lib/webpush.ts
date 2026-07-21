import webpush from "web-push";
import { adminPrisma } from "@pms/db";
import { env } from "./env";

webpush.setVapidDetails(env.VAPID_EMAIL, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function sendPushNotification(
  subscription: PushSubscriptionKeys,
  payload: PushPayload,
  userId?: string,
): Promise<void> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
    // Permanent — the only other outcomes (failure, or never attempted) are
    // both logged too, so log-reading can always tell which of the three
    // actually happened instead of treating silence as success.
    console.log("Push notification sent:", { endpoint: subscription.endpoint, userId });
  } catch (err) {
    // Subscription expired or invalid — log and continue. A dead subscription
    // (404/410) is cleaned up lazily here rather than blocking the caller.
    // Full detail (not just the error object) because web-push's thrown
    // errors often carry the real reason in .body/.statusCode rather than
    // .message.
    console.error("Push notification failed:", {
      endpoint: subscription.endpoint,
      message: (err as Error)?.message,
      statusCode: (err as { statusCode?: number }).statusCode,
      body: (err as { body?: unknown }).body,
      headers: (err as { headers?: unknown }).headers,
    });
    const statusCode = (err as { statusCode?: number }).statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await adminPrisma.pushSubscription
        .deleteMany({ where: { endpoint: subscription.endpoint } })
        .catch(() => { /* best-effort cleanup */ });
    }
  }
}

// Fire-and-forget: never throws, so callers can call this without try/catch.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  try {
    const subs = await adminPrisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length === 0) {
      console.log("sendPushToUser: 0 subscriptions found", { userId });
      return;
    }
    await Promise.allSettled(subs.map((sub) => sendPushNotification(sub, payload, userId)));
  } catch (err) {
    console.error("sendPushToUser failed:", { userId, err });
  }
}
