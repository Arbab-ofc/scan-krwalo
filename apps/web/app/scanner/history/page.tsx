"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { api } from "../../../lib/api";
import { useLiveRefresh } from "../../../lib/live";
import { formatMoney } from "../../../lib/money";

type ScannerTask = {
  id: string;
  publicId: string;
  title: string | null;
  normalizedUrl: string;
  url: string;
  status: string;
  rewardAmount: string;
  rewardCurrency: string;
  claimedAt: string | null;
  scannerSubmittedAt: string | null;
  completedAt: string | null;
  expiredAt: string | null;
};

type PaginatedTasks = {
  items: ScannerTask[];
  pagination: {
    page: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export default function ScannerHistoryPage() {
  const [data, setData] = useState<PaginatedTasks | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");

  const loadTasks = useCallback(async (nextPage = page) => {
    try {
      setData(await api<PaginatedTasks>(`/scanner/history?page=${nextPage}&limit=12`));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load history.");
    }
  }, [page]);

  useLiveRefresh(() => loadTasks(page), ["task:updated", "task:submitted", "task:confirmed", "task:expired", "wallet:updated"]);

  useEffect(() => {
    loadTasks(page);
  }, [page, loadTasks]);

  const tasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.items ?? []).filter((task) => {
      if (!needle) return true;
      return task.publicId.toLowerCase().includes(needle) || task.status.toLowerCase().includes(needle) || task.normalizedUrl.toLowerCase().includes(needle);
    });
  }, [data, query]);

  return (
    <AppShell role="scanner">
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Task archive</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Scanner history</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">Review grabbed, submitted, completed, expired, and disputed tasks from your scanner account.</p>
            </div>
            <button onClick={() => loadTasks(page)} className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
          <div className="relative mt-5 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-lg border border-line bg-white pl-10 pr-4 text-sm shadow-sm" placeholder="Search by task ID, URL, or status" />
          </div>
          {message && <p className="mt-4 rounded-lg border border-line bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>}
        </section>

        <div className="grid gap-4">
          {tasks.map((task) => (
            <article key={task.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-semibold text-slate-500">{task.publicId}</p>
                    <StatusBadge status={task.status} />
                  </div>
                  <h2 className="mt-2 text-xl font-semibold text-ink">{task.title || task.normalizedUrl}</h2>
                  <a href={task.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-2 truncate text-sm font-medium text-accent hover:underline">
                    <span className="truncate">{task.normalizedUrl}</span>
                    <ExternalLink size={15} />
                  </a>
                </div>
                <div className="grid min-w-[220px] gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  <Metric label="Reward" value={formatMoney(task.rewardAmount, task.rewardCurrency)} />
                  <Metric label="Claimed" value={formatDate(task.claimedAt)} />
                  <Metric label="Submitted" value={formatDate(task.scannerSubmittedAt)} />
                  <Metric label="Closed" value={formatDate(task.completedAt ?? task.expiredAt)} />
                </div>
              </div>
            </article>
          ))}
        </div>

        {tasks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-12 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-ink">No scanner history yet</h2>
            <p className="mt-2 text-sm text-slate-500">Grab a task first, then its lifecycle will appear here.</p>
          </div>
        )}

        {data && (
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} tasks</p>
            <div className="flex gap-2">
              <button disabled={!data.pagination.hasPreviousPage} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">Previous</button>
              <button disabled={!data.pagination.hasNextPage} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "COMPLETED" || status === "AUTO_COMPLETED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "SCANNER_SUBMITTED" || status === "CLAIMED"
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : status.includes("EXPIRED") || status === "DISPUTED"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{status.replaceAll("_", " ")}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><span>{label}</span><span className="font-semibold text-ink">{value}</span></div>;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
