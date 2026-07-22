"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell, Stat } from "../../components/shell";
import { api } from "../../lib/api";
import { getLiveSocket, useLiveRefresh } from "../../lib/live";
import { formatMoney } from "../../lib/money";
import { enablePushNotifications, pushSupportStatus } from "../../lib/push";

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
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Scanner workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Scanner dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">{user?.username} · {user?.email}</p>
        </section>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Available" value={formatMoney(data?.scanner?.availableBalance ?? 0, "USDT")} />
          <Stat label="Lifetime" value={formatMoney(data?.scanner?.lifetimeEarnings ?? 0, "USDT")} />
          <Stat label="Completed" value={data?.scanner?.completedTaskCount ?? 0} />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <OnlineToggle initialOnline={!!data?.scanner?.isOnline} onChanged={loadDashboard} />
          <PushNotificationsCard />
        </div>
      </div>
    </AppShell>
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
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
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
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Device notifications</h2>
      <p className="mt-2 text-sm text-slate-500">Enable this once per phone, tablet, or computer to receive new task alerts.</p>
      <button disabled={status === "granted"} onClick={enable} className="focus-ring mt-4 rounded-md bg-ink px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
        {status === "granted" ? "Enabled on this device" : "Enable push notifications"}
      </button>
      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
    </div>
  );
}
