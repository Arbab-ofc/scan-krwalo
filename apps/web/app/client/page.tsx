"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AppShell, Stat } from "../../components/shell";
import { api } from "../../lib/api";
import { useLiveRefresh } from "../../lib/live";

export default function ClientDashboard() {
  const [data, setData] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const loadDashboard = useCallback(async () => {
    const [dashboard, me] = await Promise.all([api("/client/dashboard"), api<{ user: any }>("/auth/me")]);
    setData(dashboard);
    setUser(me.user);
  }, []);

  useLiveRefresh(loadDashboard, ["credits:updated", "task:submitted", "task:confirmed", "task:expired", "notification:new"]);

  useEffect(() => {
    loadDashboard().catch(console.error);
  }, [loadDashboard]);

  return (
    <AppShell role="client">
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Client workspace</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Client dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">{user?.username} · {user?.email}</p>
        </section>
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat label="Available credits" value={data?.client?.availableTaskCredits ?? 0} />
          <Stat label="Reserved credits" value={data?.client?.reservedTaskCredits ?? 0} />
          <Stat label="Posted tasks" value={data?.client?.totalPostedTasks ?? 0} />
        </div>
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-ink">Recent tasks</h2>
          <div className="mt-4 grid gap-3">
            {(data?.tasks ?? []).slice(0, 5).map((task: any) => (
              <Link key={task.id} href="/client/tasks" className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm">
                <span className="font-mono font-semibold text-slate-600">{task.publicId}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{task.status.replaceAll("_", " ")}</span>
              </Link>
            ))}
            {!data?.tasks?.length && <p className="text-sm text-slate-500">No tasks posted yet.</p>}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
