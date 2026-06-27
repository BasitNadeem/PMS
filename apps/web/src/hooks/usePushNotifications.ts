import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface UsePushNotificationsResult {
  permission: NotificationPermission;
  subscribed: boolean;
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

export function usePushNotifications(): UsePushNotificationsResult {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.getRegistration("/sw-push.js").then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, []);

  async function subscribe(): Promise<boolean> {
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") return false;

    const reg = await navigator.serviceWorker.register("/sw-push.js");

    const { data } = await api.get<{ publicKey: string }>("/api/push/vapid-public-key");

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey),
    });

    const subJson = sub.toJSON();
    await api.post("/api/push/subscribe", {
      endpoint: subJson.endpoint,
      p256dh:   subJson.keys?.p256dh,
      auth:     subJson.keys?.auth,
    });

    setSubscribed(true);
    return true;
  }

  async function unsubscribe(): Promise<void> {
    const reg = await navigator.serviceWorker.getRegistration("/sw-push.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await api.delete("/api/push/subscribe", { data: { endpoint: sub.endpoint } });
    }
    setSubscribed(false);
  }

  return { permission, subscribed, subscribe, unsubscribe };
}
