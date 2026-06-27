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
): Promise<void> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    );
  } catch (err) {
    // Subscription expired or invalid — log and continue. A dead subscription
    // (404/410) is cleaned up lazily here rather than blocking the caller.
    console.error("Push notification failed:", err);
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
    await Promise.allSettled(subs.map((sub) => sendPushNotification(sub, payload)));
  } catch (err) {
    console.error("sendPushToUser failed:", err);
  }
}
