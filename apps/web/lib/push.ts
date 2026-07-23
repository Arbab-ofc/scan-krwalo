"use client";

import { api } from "./api";

type PushConfig = {
  enabled: boolean;
  provider: "onesignal";
  appId: string | null;
};

type OneSignalSdk = {
  init(options: {
    appId: string;
    autoResubscribe?: boolean;
    notificationClickHandlerMatch?: string;
    notificationClickHandlerAction?: string;
  }): Promise<void>;
  login?: (externalId: string) => Promise<void>;
  Notifications?: {
    requestPermission(): Promise<boolean>;
    isPushSupported(): boolean;
    permission: boolean;
  };
  User?: {
    externalId: string | null;
    addTag(key: string, value: string): void;
    PushSubscription?: {
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
  try {
    if (typeof window === "undefined") throw new Error("Push notifications are not available during server rendering.");
    const config = await api<PushConfig>("/push-subscriptions/public-key");
    if (!config.enabled || !config.appId) {
      throw new Error("OneSignal push notifications are not configured on the API server. Set ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY on Render, then redeploy.");
    }
    const me = await api<{ user: { id: string; role: string } }>("/auth/me");
    await unregisterLegacyPushWorker();
    const oneSignal = await initOneSignal(config.appId);
    assertOneSignalReady(oneSignal);
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
  } catch (error) {
    initPromise = null;
    throw error;
  }
}

async function unregisterLegacyPushWorker() {
  if (!("serviceWorker" in navigator)) return;
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map(async (registration) => {
    if (registration.active?.scriptURL.endsWith("/push-sw.js") || registration.installing?.scriptURL.endsWith("/push-sw.js") || registration.waiting?.scriptURL.endsWith("/push-sw.js")) {
      await registration.unregister();
    }
  }));
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
        if (canReuseInitializedOneSignal(error, OneSignal)) {
          settled = true;
          resolve(OneSignal);
          return;
        }
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

function canReuseInitializedOneSignal(error: unknown, oneSignal: OneSignalSdk) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const repeatedInitError = /already initialized|reading 'Qe'|reading "Qe"|undefined.*Qe/i.test(message);
  return repeatedInitError || Boolean(oneSignal.Notifications || oneSignal.User || oneSignal.login);
}

function assertOneSignalReady(oneSignal: OneSignalSdk): asserts oneSignal is Required<OneSignalSdk> & { User: NonNullable<OneSignalSdk["User"]> & { PushSubscription: NonNullable<NonNullable<OneSignalSdk["User"]>["PushSubscription"]> } } {
  if (typeof oneSignal.login !== "function") {
    throw new Error("OneSignal SDK is not ready. Refresh the page and try Enable push notifications again.");
  }
  if (!oneSignal.Notifications || typeof oneSignal.Notifications.isPushSupported !== "function") {
    throw new Error("OneSignal Notifications API is unavailable. Check OneSignal Web SDK setup for this domain.");
  }
  if (!oneSignal.User || !oneSignal.User.PushSubscription) {
    throw new Error("OneSignal user subscription API is unavailable. Check that the OneSignal Web app is configured for this exact domain.");
  }
}

async function waitForSubscriptionId(oneSignal: OneSignalSdk) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (oneSignal.User?.PushSubscription?.id) return oneSignal.User.PushSubscription.id;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("OneSignal did not create a browser subscription yet. Check the OneSignal Web setup domain and service worker file.");
}
