import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface UsePushNotificationsResult {
  permission: NotificationPermission;
  subscribed: boolean;
  syncing: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const array = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; i++) array[i] = rawData.charCodeAt(i);
  return array;
}

function applicationServerKeysMatch(
  current: ArrayBuffer | null,
  expected: Uint8Array<ArrayBuffer>,
): boolean {
  if (!current) return false;
  const currentBytes = new Uint8Array(current);
  if (currentBytes.length !== expected.length) return false;
  return currentBytes.every((value, index) => value === expected[index]);
}

async function getVapidPublicKey(): Promise<Uint8Array<ArrayBuffer>> {
  const { data } = await api.get<{ publicKey: string }>("/api/push/vapid-public-key");
  return urlBase64ToUint8Array(data.publicKey);
}

async function ensureBrowserSubscription(
  registration: ServiceWorkerRegistration,
  publicKey: Uint8Array<ArrayBuffer>,
): Promise<PushSubscription> {
  let subscription = await registration.pushManager.getSubscription();

  // A VAPID key rotation makes an existing endpoint unusable by the current
  // server. Replace it automatically instead of leaving the UI falsely "On".
  if (
    subscription &&
    !applicationServerKeysMatch(subscription.options.applicationServerKey, publicKey)
  ) {
    await subscription.unsubscribe();
    subscription = null;
  }

  return subscription ?? registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: publicKey,
  });
}

async function syncSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  const subscriptionJson = subscription.toJSON();
  if (!subscriptionJson.endpoint || !subscriptionJson.keys?.p256dh || !subscriptionJson.keys.auth) {
    throw new Error("Browser returned an incomplete push subscription");
  }
  await api.post("/api/push/subscribe", {
    endpoint: subscriptionJson.endpoint,
    p256dh:   subscriptionJson.keys.p256dh,
    auth:     subscriptionJson.keys.auth,
  });
}

export function usePushNotifications(): UsePushNotificationsResult {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [subscribed, setSubscribed] = useState(false);
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      typeof Notification === "undefined"
    ) {
      setSyncing(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        if (Notification.permission !== "granted") {
          if (!cancelled) setSubscribed(false);
          return;
        }

        // Workbox owns the single root-scoped registration. Waiting for it
        // avoids creating a competing service worker and also repairs devices
        // whose browser subscription survived while the server row did not.
        const registration = await navigator.serviceWorker.ready;
        const publicKey = await getVapidPublicKey();
        const subscription = await ensureBrowserSubscription(registration, publicKey);
        await syncSubscriptionToServer(subscription);
        if (!cancelled) setSubscribed(true);
      } catch (error) {
        console.error("Push subscription repair failed:", error);
        if (!cancelled) setSubscribed(false);
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  async function subscribe(): Promise<boolean> {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      typeof Notification === "undefined"
    ) return false;

    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return false;

    setSyncing(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const publicKey = await getVapidPublicKey();
      const subscription = await ensureBrowserSubscription(registration, publicKey);
      await syncSubscriptionToServer(subscription);
      setSubscribed(true);
      return true;
    } finally {
      setSyncing(false);
    }
  }

  async function unsubscribe(): Promise<void> {
    if (!("serviceWorker" in navigator)) return;
    setSyncing(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await api.delete("/api/push/subscribe", { data: { endpoint: subscription.endpoint } });
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } finally {
      setSyncing(false);
    }
  }

  return { permission, subscribed, syncing, subscribe, unsubscribe };
}
