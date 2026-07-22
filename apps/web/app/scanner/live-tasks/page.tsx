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
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Scanner feed</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Live tasks</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Only tasks still inside the grab window appear here. The feed refreshes automatically every 5 seconds.
              </p>
            </div>
            <button
              onClick={() => startTransition(loadTasks)}
              disabled={isPending}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm disabled:opacity-60"
            >
              <RefreshCw size={16} className={isPending ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              disabled={pushStatus === "granted"}
              onClick={async () => {
                try {
                  await enablePushNotifications();
                  setPushStatus(pushSupportStatus());
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "Could not enable notifications.");
                }
              }}
              className="focus-ring inline-flex items-center justify-center rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm disabled:opacity-60"
            >
              {pushStatus === "granted" ? "Push enabled" : "Enable push"}
            </button>
          </div>
          {lastUpdated && <p className="mt-4 text-xs text-slate-500">Last checked {formatTime(lastUpdated)}</p>}
          {message && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
        </section>

        <div className="grid gap-4">
          {visibleTasks.map((task) => (
            <article key={task.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">{task.publicId}</p>
                  <h2 className="mt-1 text-xl font-semibold text-ink">{task.title || task.normalizedUrl}</h2>
                  <p className="mt-2 max-w-2xl truncate text-sm text-slate-500">{task.normalizedUrl}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 px-4 py-3 text-right">
                  <p className="text-xs font-semibold uppercase tracking-[.14em] text-emerald-700">Reward</p>
                  <p className="mt-1 text-lg font-semibold text-accent">{formatMoney(task.rewardAmount, task.rewardCurrency)}</p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                  <Timer size={17} className="text-accent" />
                  Grab window: {remainingTime(task.claimExpiresAt, now)}
                </div>
                <button
                  disabled={claimingTaskId !== null}
                  onClick={() => claim(task.id)}
                  className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-base font-semibold text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-70"
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
