"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Download, Filter, RefreshCw, Search } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { api, getToken } from "../../../lib/api";
import { useLiveRefresh } from "../../../lib/live";
import { formatMoney } from "../../../lib/money";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const taskStatuses = [
  "ALL",
  "AVAILABLE",
  "CLAIMED",
  "SCANNER_SUBMITTED",
  "COMPLETED",
  "AUTO_COMPLETED",
  "CLAIM_EXPIRED",
  "COMPLETION_EXPIRED",
  "DISPUTED",
  "REFUNDED",
  "CANCELLED"
];

type Paginated<T> = {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

type TaskReportRow = {
  id: string;
  publicId: string;
  status: string;
  postedByRole: string;
  title: string | null;
  url: string;
  clientUsername: string;
  clientEmail: string;
  clientAvailableCredits: number | string;
  clientReservedCredits: number | string;
  clientUsedCredits: number | string;
  scannerUsername: string;
  scannerEmail: string;
  scannerAvailableBalance: string;
  scannerLifetimeEarnings: string;
  rewardAmount: string;
  rewardCurrency: string;
  proofCount: number;
  disputeStatus: string;
  publishedAt: string | null;
  claimedAt: string | null;
  scannerSubmittedAt: string | null;
  completedAt: string | null;
  expiredAt: string | null;
  createdAt: string;
};

export default function AdminTasksPage() {
  const [data, setData] = useState<Paginated<TaskReportRow> | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("ALL");
  const [postedByRole, setPostedByRole] = useState("ALL");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (status !== "ALL") params.set("status", status);
    if (postedByRole !== "ALL") params.set("postedByRole", postedByRole);
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [page, status, postedByRole, search]);

  const exportQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (postedByRole !== "ALL") params.set("postedByRole", postedByRole);
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  }, [status, postedByRole, search]);

  const loadTasks = useCallback(async () => {
    setMessage("");
    try {
      setData(await api<Paginated<TaskReportRow>>(`/admin/tasks?${query}`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load task report.");
    }
  }, [query]);

  useLiveRefresh(loadTasks, ["task:available", "task:claimed", "task:updated", "task:submitted", "task:confirmed", "task:expired"]);

  useEffect(() => {
    loadTasks().catch(console.error);
  }, [loadTasks]);

  function applyFilters() {
    setPage(1);
    setSearch(searchInput);
  }

  async function exportCsv() {
    if (exporting) return;
    setExporting(true);
    setMessage("");
    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/admin/tasks/export.csv${exportQuery ? `?${exportQuery}` : ""}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error(`CSV export failed (${response.status})`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `scan-krwalo-task-report-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSV export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <AppShell role="admin">
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Task reports</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Client posts and scanner tasks</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Track every posted task with its client, assigned scanner, proof count, dispute state, credits, and scanner earnings.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button onClick={() => startTransition(loadTasks)} disabled={isPending} className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm disabled:opacity-60">
                <RefreshCw size={16} className={isPending ? "animate-spin" : ""} />
                Refresh
              </button>
              <button onClick={exportCsv} disabled={exporting} className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
                <Download size={16} />
                {exporting ? "Exporting..." : "Export CSV"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyFilters(); }} className="h-11 w-full rounded-lg border border-line bg-white pl-10 pr-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-emerald-100" placeholder="Search task, URL, client, scanner" />
            </label>
            <select value={status} onChange={(event) => { setPage(1); setStatus(event.target.value); }} className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-emerald-100">
              {taskStatuses.map((item) => <option key={item} value={item}>{item === "ALL" ? "All statuses" : item}</option>)}
            </select>
            <select value={postedByRole} onChange={(event) => { setPage(1); setPostedByRole(event.target.value); }} className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-emerald-100">
              <option value="ALL">All posters</option>
              <option value="CLIENT">Client posts</option>
              <option value="ADMIN">Admin posts</option>
            </select>
            <button onClick={applyFilters} className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm">
              <Filter size={16} />
              Apply
            </button>
          </div>
          {message && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
        </section>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">All tasks</h2>
              <p className="text-sm text-slate-500">{data?.pagination.total ?? 0} records</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1250px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[.14em] text-slate-500">
                  {["Task", "Status", "Client", "Scanner", "Credits", "Scanner wallet", "Reward", "Proofs", "Timeline"].map((column) => (
                    <th key={column} className="border-b border-line py-3 pr-4">{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((task) => (
                  <tr key={task.id} className="align-top">
                    <td className="border-b border-line py-4 pr-4">
                      <Link href={`/admin/tasks/${task.id}`} className="font-mono text-xs font-semibold text-accent hover:underline">{task.publicId}</Link>
                      <p className="mt-1 max-w-[260px] truncate font-semibold text-ink">{task.title || task.url}</p>
                      <p className="mt-1 max-w-[260px] truncate text-xs text-slate-500">{task.url}</p>
                      <p className="mt-1 text-xs text-slate-500">Posted by {task.postedByRole}</p>
                    </td>
                    <td className="border-b border-line py-4 pr-4"><StatusBadge status={task.status} dispute={task.disputeStatus} /></td>
                    <td className="border-b border-line py-4 pr-4"><Person username={task.clientUsername} email={task.clientEmail} empty="No client" /></td>
                    <td className="border-b border-line py-4 pr-4"><Person username={task.scannerUsername} email={task.scannerEmail} empty="Unassigned" /></td>
                    <td className="border-b border-line py-4 pr-4">
                      <Metric label="Available" value={task.clientAvailableCredits} />
                      <Metric label="Reserved" value={task.clientReservedCredits} />
                      <Metric label="Used" value={task.clientUsedCredits} />
                    </td>
                    <td className="border-b border-line py-4 pr-4">
                      <Metric label="Available" value={task.scannerAvailableBalance ? formatMoney(task.scannerAvailableBalance, "USDT") : "-"} />
                      <Metric label="Lifetime" value={task.scannerLifetimeEarnings ? formatMoney(task.scannerLifetimeEarnings, "USDT") : "-"} />
                    </td>
                    <td className="border-b border-line py-4 pr-4 font-semibold text-ink">{formatMoney(task.rewardAmount, task.rewardCurrency)}</td>
                    <td className="border-b border-line py-4 pr-4">{task.proofCount}</td>
                    <td className="border-b border-line py-4 pr-4">
                      <Metric label="Published" value={formatDate(task.publishedAt)} />
                      <Metric label="Claimed" value={formatDate(task.claimedAt)} />
                      <Metric label="Submitted" value={formatDate(task.scannerSubmittedAt)} />
                      <Metric label="Completed" value={formatDate(task.completedAt)} />
                      <Metric label="Expired" value={formatDate(task.expiredAt)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(data?.items.length ?? 0) === 0 && <p className="py-10 text-center text-sm text-slate-500">No task records found.</p>}

          {data && (
            <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">Page {data.pagination.page} of {data.pagination.totalPages}</p>
              <div className="flex gap-2">
                <button disabled={!data.pagination.hasPreviousPage} onClick={() => setPage(Math.max(1, page - 1))} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">Previous</button>
                <button disabled={!data.pagination.hasNextPage} onClick={() => setPage(page + 1)} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Person({ username, email, empty }: { username: string; email: string; empty: string }) {
  if (!username && !email) return <span className="text-slate-400">{empty}</span>;
  return (
    <div>
      <p className="font-semibold text-ink">{username}</p>
      <p className="text-xs text-slate-500">{email}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <p className="mb-1 text-xs text-slate-500"><span className="font-semibold text-slate-700">{label}:</span> {value || "-"}</p>;
}

function StatusBadge({ status, dispute }: { status: string; dispute: string }) {
  const active = ["AVAILABLE", "CLAIMED", "SCANNER_SUBMITTED"].includes(status);
  return (
    <div className="grid gap-2">
      <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{status}</span>
      {dispute && <span className="inline-flex w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">{dispute}</span>}
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
