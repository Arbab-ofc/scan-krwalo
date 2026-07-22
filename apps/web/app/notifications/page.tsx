"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, Clock3, RefreshCw } from "lucide-react";
import { AppShell } from "../../components/shell";
import { api } from "../../lib/api";
import { useLiveRefresh } from "../../lib/live";

type Role = "scanner" | "client" | "admin" | "user";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: number;
  readAt: string | null;
  createdAt: string;
};

type Paginated<T> = {
  items: T[];
  pagination: { page: number; total: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
};

export default function NotificationsPage() {
  const [role, setRole] = useState<Role>("user");
  const [data, setData] = useState<Paginated<NotificationItem> | null>(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<"ALL" | "UNREAD">("ALL");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setMessage("");
    try {
      const [me, notifications] = await Promise.all([
        api<{ user: { role: string } }>("/auth/me"),
        api<Paginated<NotificationItem>>(`/notifications?page=${page}&limit=20`)
      ]);
      setRole(me.user.role.toLowerCase() as Role);
      setData(notifications);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load notifications.");
    }
  }, [page]);

  useLiveRefresh(load, ["notification:new", "notification:read", "task:available", "task:updated", "wallet:updated", "credits:updated", "payout:updated"]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const visibleItems = useMemo(() => {
    const items = data?.items ?? [];
    return filter === "UNREAD" ? items.filter((item) => !item.readAt) : items;
  }, [data, filter]);

  const unreadCount = (data?.items ?? []).filter((item) => !item.readAt).length;

  async function markRead(id: string) {
    try {
      await api(`/notifications/${id}/read`, { method: "POST", body: "{}" });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not mark notification read.");
    }
  }

  async function markAllRead() {
    try {
      await api("/notifications/read-all", { method: "POST", body: "{}" });
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not mark notifications read.");
    }
  }

  return (
    <AppShell role={role}>
      <div className="flex flex-col gap-6">
        <section className="rounded-3xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-accent">
                <Bell size={23} />
              </span>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Notification center</p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Updates that need attention</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Task alerts, payout updates, wallet events, credit activity, and system messages stay here after realtime delivery.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={load} className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm">
                <RefreshCw size={16} />
                Refresh
              </button>
              <button onClick={markAllRead} disabled={unreadCount === 0} className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-60">
                <CheckCheck size={16} />
                Mark all read
              </button>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={() => setFilter("ALL")} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === "ALL" ? "bg-ink text-white" : "bg-slate-100 text-slate-600"}`}>All</button>
            <button onClick={() => setFilter("UNREAD")} className={`rounded-full px-4 py-2 text-sm font-semibold ${filter === "UNREAD" ? "bg-ink text-white" : "bg-slate-100 text-slate-600"}`}>Unread {unreadCount}</button>
          </div>
          {message && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
        </section>

        <section className="rounded-3xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-3">
            {visibleItems.map((item) => (
              <article key={item.id} className={`rounded-2xl border p-4 transition hover:border-slate-300 ${item.readAt ? "border-line bg-white" : "border-emerald-200 bg-emerald-50/50"}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">{item.type.replaceAll("_", " ")}</span>
                      {!item.readAt && <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-white">Unread</span>}
                    </div>
                    <h2 className="mt-3 text-lg font-semibold text-ink">{item.title}</h2>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{item.message}</p>
                    <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500"><Clock3 size={14} /> {formatDate(item.createdAt)}</p>
                  </div>
                  {!item.readAt && (
                    <button onClick={() => markRead(item.id)} className="focus-ring inline-flex min-h-10 items-center justify-center rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm">
                      Mark read
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          {visibleItems.length === 0 && (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <Bell size={22} />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-ink">No notifications</h2>
              <p className="mt-2 text-sm text-slate-500">New platform updates will appear here.</p>
            </div>
          )}

          {data && (
            <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">Page {data.pagination.page} of {data.pagination.totalPages}</p>
              <div className="flex gap-2">
                <button disabled={!data.pagination.hasPreviousPage} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">Previous</button>
                <button disabled={!data.pagination.hasNextPage} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
