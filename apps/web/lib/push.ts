"use client";

import { getApps, initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging";
import { api } from "./api";

type PushConfig = { enabled: boolean; provider: "firebase"; vapidKey: string | null };

const firebaseConfig = {
  apiKey: "AIzaSyDnqO4c2vnixg6Ro-uSweUPApuqHwCkock",
  authDomain: "scan-krwalo.firebaseapp.com",
  projectId: "scan-krwalo",
  storageBucket: "scan-krwalo.firebasestorage.app",
  messagingSenderId: "1065867821388",
  appId: "1:1065867821388:web:4e42216c8d56844a36cfe9"
};

const vapidKey = "BP0seRVF_qwHXSXBuAR5486OYAajdGb0xJtkjYlboTqob6YB54D3iaQ7jKanmKicbqVRYTReBjonE_bOwC9kbVs";
let messagingPromise: Promise<Messaging> | null = null;

export async function enablePushNotifications() {
  if (typeof window === "undefined" || !(await isSupported())) throw new Error("Firebase web push is not supported in this browser.");
  const config = await api<PushConfig>("/push-subscriptions/public-key");
  if (!config.enabled || !config.vapidKey) throw new Error("Firebase push notifications are not configured on the API server.");
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");
  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const token = await getToken(await getMessagingClient(), { vapidKey: config.vapidKey || vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Firebase did not create a browser subscription token.");
  const saved = await api<{ subscriptionId: string }>("/push-subscriptions", { method: "POST", body: JSON.stringify({ token }) });
  return { provider: "firebase", subscriptionId: saved.subscriptionId, token, optedIn: true };
}

export async function sendTestPushNotification() {
  return api<{ configured: boolean; attempted: number; sent: number; removed: number; failed: number; errors: string[]; provider?: string; messageId?: string | null }>("/push-subscriptions/test", { method: "POST" });
}

export function pushSupportStatus() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

async function getMessagingClient() {
  if (!messagingPromise) {
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    messagingPromise = Promise.resolve(getMessaging(app));
  }
  return messagingPromise;
}
