"use client";

import { api } from "./api";

type PushConfig = {
  enabled: boolean;
  provider: "onesignal";
  appId: string | null;
};

type OneSignalSdk = {
  init(options: { appId: string; autoResubscribe?: boolean; notificationClickHandlerMatch?: string; notificationClickHandlerAction?: string }): Promise<void>;
  login(externalId: string): Promise<void>;
  Notifications: {
    requestPermission(): Promise<boolean>;
    isPushSupported(): boolean;
    permission: boolean;
  };
  User: {
    externalId: string | null;
    addTag(key: string, value: string): void;
    PushSubscription: {
      id: string | null;
      optedIn: boolean;
      optIn(): Promise<void>;
    };
  };
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalSdk) => void | Promise<void>>;
  }
}

let initPromise: Promise<OneSignalSdk> | null = null;

export async function enablePushNotifications() {
  if (typeof window === "undefined") throw new Error("Push notifications are not available during server rendering.");
  const config = await api<PushConfig>("/push-subscriptions/public-key");
  if (!config.enabled || !config.appId) {
    throw new Error("OneSignal push notifications are not configured on the server.");
  }
  const me = await api<{ user: { id: string; role: string } }>("/auth/me");
  const oneSignal = await initOneSignal(config.appId);
  if (!oneSignal.Notifications.isPushSupported()) {
    throw new Error("Push notifications are not supported on this browser.");
  }
  await oneSignal.login(me.user.id);
  oneSignal.User.addTag("role", me.user.role);
  const permission = oneSignal.Notifications.permission || await oneSignal.Notifications.requestPermission();
  if (!permission) throw new Error("Notification permission was not granted.");
  await oneSignal.User.PushSubscription.optIn();
  const subscriptionId = await waitForSubscriptionId(oneSignal);
  if (!oneSignal.User.PushSubscription.optedIn) {
    throw new Error("OneSignal subscription is not opted in. Check browser notification settings for this site.");
  }
  await api("/push-subscriptions", {
    method: "POST",
    body: JSON.stringify({ provider: "onesignal" })
  });
  return {
    provider: "onesignal",
    externalId: me.user.id,
    subscriptionId,
    optedIn: oneSignal.User.PushSubscription.optedIn
  };
}

export async function sendTestPushNotification() {
  return api<{ configured: boolean; attempted: number; sent: number; removed: number; failed: number; errors: string[]; provider?: string; messageId?: string | null; warnings?: unknown }>("/push-subscriptions/test", {
    method: "POST"
  });
}

export function pushSupportStatus() {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function initOneSignal(appId: string) {
  if (initPromise) return initPromise;
  initPromise = new Promise<OneSignalSdk>((resolve, reject) => {
    let settled = false;
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId,
          autoResubscribe: true,
          notificationClickHandlerMatch: "origin",
          notificationClickHandlerAction: "navigate"
        });
        settled = true;
        resolve(OneSignal);
      } catch (error) {
        settled = true;
        initPromise = null;
        reject(error);
      }
    });
    setTimeout(() => {
      if (!settled) {
        initPromise = null;
        reject(new Error("OneSignal SDK did not load. Check ad blockers, network access, and that OneSignal is allowed on this domain."));
      }
    }, 10_000);
  });
  return initPromise;
}

async function waitForSubscriptionId(oneSignal: OneSignalSdk) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (oneSignal.User.PushSubscription.id) return oneSignal.User.PushSubscription.id;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("OneSignal did not create a browser subscription yet. Check the OneSignal Web setup domain and service worker file.");
}
