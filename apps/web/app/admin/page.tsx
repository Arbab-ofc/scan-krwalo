"use client";
import { useCallback, useEffect, useState } from "react";
import { AppShell, Stat } from "../../components/shell";
import { api } from "../../lib/api";
import { useLiveRefresh } from "../../lib/live";

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null);
  const loadDashboard = useCallback(async () => {
    setData(await api("/admin/dashboard"));
  }, []);
  useLiveRefresh(loadDashboard, ["task:available", "task:updated", "task:submitted", "task:confirmed", "task:expired", "payout:updated", "notification:new"]);
  useEffect(() => { loadDashboard().catch(console.error); }, [loadDashboard]);
  return <AppShell role="admin"><h1 className="text-3xl font-semibold">Admin dashboard</h1><div className="mt-6 grid gap-4 sm:grid-cols-3"><Stat label="Users" value={data?.users ?? 0} /><Stat label="Tasks" value={data?.tasks ?? 0} /><Stat label="Requested payouts" value={data?.requestedPayouts ?? 0} /></div></AppShell>;
}
