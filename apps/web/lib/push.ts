"use client";

import { api } from "./api";

export async function enablePushNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    throw new Error("Push notifications are not supported on this browser.");
  }
  const config = await api<{ enabled: boolean; publicKey: string | null }>("/push-subscriptions/public-key");
  if (!config.enabled || !config.publicKey) {
    throw new Error("Push notifications are not configured on the server.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  await navigator.serviceWorker.register("/push-sw.js");
  const registration = await navigator.serviceWorker.ready;
  const applicationServerKey = urlBase64ToUint8Array(config.publicKey);
  const existing = await registration.pushManager.getSubscription();
  if (existing && !subscriptionUsesKey(existing, applicationServerKey)) {
    await existing.unsubscribe();
  }
  const current = await registration.pushManager.getSubscription();
  const subscription = current ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey
  });

  await api("/push-subscriptions", {
    method: "POST",
    body: JSON.stringify(subscription.toJSON())
  });
  return subscription;
}

export async function sendTestPushNotification() {
  return api<{ configured: boolean; attempted: number; sent: number; removed: number }>("/push-subscriptions/test", {
    method: "POST"
  });
}

export function pushSupportStatus() {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function subscriptionUsesKey(subscription: PushSubscription, applicationServerKey: Uint8Array) {
  const existingKey = subscription.options.applicationServerKey;
  if (!existingKey) return true;
  return arrayBuffersEqual(existingKey, applicationServerKey.buffer);
}

function arrayBuffersEqual(left: ArrayBuffer | null, right: ArrayBufferLike) {
  if (!left) return false;
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) return false;
  return leftBytes.every((byte, index) => byte === rightBytes[index]);
}
