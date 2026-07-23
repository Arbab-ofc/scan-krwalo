"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { RefreshCw, Timer, Zap } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { api } from "../../../lib/api";
import { useLiveRefresh } from "../../../lib/live";
import { formatMoney } from "../../../lib/money";
import { enablePushNotifications, pushSupportStatus } from "../../../lib/push";

type LiveTask = {
  id: string;
  publicId: string;
  title: string | null;
  normalizedUrl: string;
  rewardAmount: string;
  rewardCurrency: string;
  publishedAt: string;
  claimExpiresAt: string | null;
};

export default function LiveTasksPage() {
  const [tasks, setTasks] = useState<LiveTask[]>([]);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [serverOffset, setServerOffset] = useState(0);
  const [claimingTaskId, setClaimingTaskId] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState("checking");
  const [isPending, startTransition] = useTransition();

  const loadTasks = useCallback(async () => {
    try {
      const data = await api<{ tasks: LiveTask[]; serverTime: string }>("/scanner/live-tasks?page=1&limit=20");
      setTasks(data.tasks);
      setLastUpdated(data.serverTime);
      setServerOffset(new Date(data.serverTime).getTime() - Date.now());
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load live tasks.");
    }
  }, []);

  useLiveRefresh(loadTasks, ["task:available", "task:claimed", "task:removed", "task:expired", "notification:new"]);

  useEffect(() => {
    loadTasks();
    const refreshTimer = window.setInterval(loadTasks, 5000);
    return () => window.clearInterval(refreshTimer);
  }, [loadTasks]);

  useEffect(() => setPushStatus(pushSupportStatus()), []);

  useEffect(() => {
    const clockTimer = window.setInterval(() => setNow(Date.now() + serverOffset), 1000);
    return () => window.clearInterval(clockTimer);
  }, [serverOffset]);

  async function claim(id: string) {
    if (claimingTaskId) return;
    setClaimingTaskId(id);
    try {
      await api(`/tasks/${id}/claim`, { method: "POST", body: "{}" });
      location.href = "/scanner/current-task";
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Claim failed");
      await loadTasks();
      setClaimingTaskId(null);
    }
  }

  const visibleTasks = useMemo(
    () => tasks.filter((task) => !task.claimExpiresAt || new Date(task.claimExpiresAt).getTime() > now),
    [tasks, now]
  );

  return (
    <AppShell role="scanner">
      <div className="app-page">
        <section className="app-card">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="app-eyebrow">Scanner feed</p>
              <h1 className="app-title">Live tasks</h1>
              <p className="app-copy">
                Only tasks still inside the grab window appear here. The feed refreshes automatically every 5 seconds.
              </p>
            </div>
            <div className="app-actions">
              <button
                onClick={() => startTransition(loadTasks)}
                disabled={isPending}
                className="app-button border border-line bg-white text-ink shadow-sm disabled:opacity-60"
              >
                <RefreshCw size={16} className={isPending ? "animate-spin" : ""} />
                Refresh
              </button>
              <button
                onClick={async () => {
                  try {
                    await enablePushNotifications();
                    setPushStatus(pushSupportStatus());
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "Could not enable notifications.");
                  }
                }}
                className="app-button border border-line bg-white text-ink shadow-sm"
              >
                {pushStatus === "granted" ? "Refresh push" : "Enable push"}
              </button>
            </div>
          </div>
          {lastUpdated && <p className="mt-4 text-xs text-slate-500">Last checked {formatTime(lastUpdated)}</p>}
          {message && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
        </section>

        <div className="grid gap-4">
          {visibleTasks.map((task) => (
            <article key={task.id} className="app-card-compact">
              <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-500">{task.publicId}</p>
                  <h2 className="break-safe mt-1 text-lg font-semibold text-ink sm:text-xl">{task.title || task.normalizedUrl}</h2>
                  <p className="break-safe mt-2 text-sm text-slate-500">{task.normalizedUrl}</p>
                </div>
                <div className="w-full rounded-xl bg-emerald-50 px-4 py-3 text-left md:w-auto md:text-right">
                  <p className="text-xs font-semibold uppercase tracking-[.14em] text-emerald-700">Reward</p>
                  <p className="mt-1 text-lg font-semibold text-accent">{formatMoney(task.rewardAmount, task.rewardCurrency)}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <Timer size={17} className="shrink-0 text-accent" />
                  <span>Grab window: {remainingTime(task.claimExpiresAt, now)}</span>
                </div>
                <button
                  disabled={claimingTaskId !== null}
                  onClick={() => claim(task.id)}
                  className="app-button min-h-12 bg-accent px-5 py-3 text-base text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <Zap size={18} />
                  {claimingTaskId === task.id ? "Grabbing..." : "Grab Task"}
                </button>
              </div>
            </article>
          ))}

          {visibleTasks.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-12 text-center shadow-sm">
              <h2 className="text-xl font-semibold text-ink">No live tasks available</h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Post a new client task and open this page immediately. Expired grab-window tasks are hidden from this feed.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function remainingTime(expiresAt: string | null, now: number) {
  if (!expiresAt) return "No expiry";
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  const seconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", { timeStyle: "medium" }).format(date);
}
