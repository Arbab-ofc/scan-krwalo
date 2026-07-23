"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, Stat } from "../../components/shell";
import { api } from "../../lib/api";
import { getLiveSocket, useLiveRefresh } from "../../lib/live";
import { formatMoney } from "../../lib/money";
import { enablePushNotifications, pushSupportStatus, sendTestPushNotification } from "../../lib/push";

export default function ScannerDashboard() {
  const [data, setData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const loadDashboard = useCallback(async () => {
    const [dashboard, me] = await Promise.all([api("/scanner/dashboard"), api<{ user: any }>("/auth/me")]);
    setData(dashboard);
    setUser(me.user);
  }, []);

  useLiveRefresh(loadDashboard, ["wallet:updated", "task:updated", "task:confirmed", "payout:updated", "notification:new"]);

  useEffect(() => {
    loadDashboard().catch(console.error);
  }, [loadDashboard]);

  return (
    <AppShell role="scanner">
      <div className="app-page">
        <section className="app-card">
          <p className="app-eyebrow">Scanner workspace</p>
          <h1 className="app-title">Scanner dashboard</h1>
          <p className="mt-2 break-safe text-sm text-slate-600">{user?.username} · {user?.email}</p>
        </section>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Available" value={formatMoney(data?.scanner?.availableBalance ?? 0, "USDT")} />
          <Stat label="Lifetime" value={formatMoney(data?.scanner?.lifetimeEarnings ?? 0, "USDT")} />
          <Stat label="Completed" value={data?.scanner?.completedTaskCount ?? 0} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <OnlineToggle initialOnline={!!data?.scanner?.isOnline} onChanged={loadDashboard} />
          <PushNotificationsCard />
          <TelegramNotificationsCard />
        </div>
      </div>
    </AppShell>
  );
}

function TelegramNotificationsCard() {
  const [status, setStatus] = useState<{
    enabled: boolean;
    username: string | null;
    linked: boolean;
    telegramUsername?: string | null;
    linkedAt?: string | null;
  } | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setStatus(await api("/scanner/telegram"));
  }

  useEffect(() => {
    load().catch((error) => setMessage(error instanceof Error ? error.message : "Could not load Telegram status."));
  }, []);

  useEffect(() => {
    if (!deepLink || status?.linked) return undefined;
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      load().catch(() => undefined);
      if (attempts >= 20) window.clearInterval(timer);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [deepLink, status?.linked]);

  useEffect(() => {
    if (!status?.linked) return;
    setDeepLink(null);
    setMessage("Telegram alerts are linked. Check your bot for the welcome message.");
  }, [status?.linked]);

  async function linkTelegram() {
    setLoading(true);
    setMessage("");
    try {
      const result = await api<{ enabled: boolean; linked: boolean; username: string | null; deepLink: string | null }>("/scanner/telegram/link", { method: "POST", body: "{}" });
      setStatus((current) => ({ ...(current ?? result), enabled: result.enabled, username: result.username, linked: result.linked }));
      setDeepLink(result.deepLink);
      if (!result.enabled) setMessage("Telegram bot is not configured on the server.");
      else if (result.deepLink) setMessage("Open Telegram and press Start. This card will update after the bot links.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create Telegram link.");
    } finally {
      setLoading(false);
    }
  }

  async function unlinkTelegram() {
    setLoading(true);
    setMessage("");
    try {
      await api("/scanner/telegram", { method: "DELETE" });
      setDeepLink(null);
      await load();
      setMessage("Telegram alerts unlinked.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not unlink Telegram.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-card-compact lg:col-span-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">Telegram task alerts</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Link your Telegram account to receive every new client task in the bot with a live-task button.
          </p>
          {status?.linked && (
            <p className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              Linked{status.telegramUsername ? ` to @${status.telegramUsername}` : ""}{status.linkedAt ? ` on ${new Date(status.linkedAt).toLocaleString()}` : ""}
            </p>
          )}
        </div>
        <div className="app-actions sm:justify-end">
          <button onClick={linkTelegram} disabled={loading} className="app-button rounded-md bg-ink px-5 py-3 text-white disabled:cursor-not-allowed disabled:opacity-60">
            {loading ? "Working..." : status?.linked ? "Refresh link" : "Link Telegram"}
          </button>
          {status?.linked && (
            <button onClick={unlinkTelegram} disabled={loading} className="app-button rounded-md border border-line bg-white px-5 py-3 text-ink disabled:cursor-not-allowed disabled:opacity-60">
              Unlink
            </button>
          )}
        </div>
      </div>
      {deepLink && (
        <div className="mt-4 rounded-xl border border-line bg-slate-50 p-4">
          <p className="text-sm text-slate-600">Open this link, then press Start in Telegram.</p>
          <Link href={deepLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex max-w-full break-safe text-sm font-semibold text-accent hover:underline">
            {deepLink}
          </Link>
        </div>
      )}
      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
    </div>
  );
}

function OnlineToggle({ initialOnline, onChanged }: { initialOnline: boolean; onChanged: () => Promise<void> }) {
  const [online, setOnlineState] = useState(initialOnline);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setOnlineState(initialOnline);
  }, [initialOnline]);

  async function setOnline(online: boolean) {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      await api(`/scanner/presence/${online ? "online" : "offline"}`, { method: "POST", body: "{}" });
      const socket = getLiveSocket();
      socket?.emit(online ? "presence:heartbeat" : "presence:offline");
      setOnlineState(online);
      await onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Presence update failed.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="app-card-compact">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">Scanner presence</h2>
          <p className="mt-1 text-sm text-slate-500">{online ? "Online and eligible for live tasks." : "Offline. New tasks will not be sent to this account."}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={online}
          disabled={saving}
          onClick={() => void setOnline(!online)}
          className={`focus-ring relative h-8 w-14 shrink-0 rounded-full border transition ${online ? "border-accent bg-accent" : "border-line bg-slate-200"} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition ${online ? "left-7" : "left-1"}`} />
        </button>
      </div>
      <div className="mt-4 inline-flex rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
        {saving ? "Updating..." : online ? "Online mode enabled" : "Offline mode enabled"}
      </div>
      {message && <p className="mt-3 text-sm text-red-600">{message}</p>}
    </div>
  );
}

function PushNotificationsCard() {
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("");
  const [testing, setTesting] = useState(false);
  useEffect(() => setStatus(pushSupportStatus()), []);
  async function enable() {
    setMessage("");
    try {
      await enablePushNotifications();
      setStatus(pushSupportStatus());
      setMessage("Push notifications enabled for this device.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not enable push notifications.");
    }
  }
  async function test() {
    setTesting(true);
    setMessage("");
    try {
      await enablePushNotifications();
      setStatus(pushSupportStatus());
      const result = await sendTestPushNotification();
      if (!result.configured) {
        setMessage("Push notifications are not configured on the server.");
      } else if (result.sent > 0) {
        setMessage(`Test push sent to ${result.sent} device${result.sent === 1 ? "" : "s"}.`);
      } else if (result.attempted === 0) {
        setMessage("No push subscription is saved for this account. Refresh the subscription first.");
      } else if (result.errors?.length) {
        setMessage(result.errors[0] ?? "The server found a subscription but could not send a test push.");
      } else {
        setMessage("The server found a subscription but could not send a test push.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send a test push notification.");
    } finally {
      setTesting(false);
    }
  }
  return (
    <div className="app-card-compact">
      <h2 className="text-lg font-semibold text-ink">Device notifications</h2>
      <p className="mt-2 text-sm text-slate-500">Enable this once per phone, tablet, or computer to receive new task alerts.</p>
      <div className="app-actions mt-4">
        <button onClick={enable} className="app-button rounded-md bg-ink px-5 py-3 text-white">
          {status === "granted" ? "Refresh push subscription" : "Enable push notifications"}
        </button>
        <button onClick={test} disabled={testing} className="app-button rounded-md border border-line bg-white px-5 py-3 text-ink disabled:cursor-not-allowed disabled:opacity-60">
          {testing ? "Sending..." : "Send test push"}
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
    </div>
  );
}
