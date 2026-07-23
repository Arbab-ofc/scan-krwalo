"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { CheckCircle2, ExternalLink, FileText, ImageIcon, RefreshCw, Search, Timer } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { api, getToken } from "../../../lib/api";
import { useLiveRefresh } from "../../../lib/live";

type ClientTask = {
  id: string;
  publicId: string;
  title: string | null;
  normalizedUrl: string;
  url: string;
  instructions: string | null;
  status: string;
  publishedAt: string | null;
  claimedAt: string | null;
  scannerSubmittedAt: string | null;
  clientConfirmedAt: string | null;
  completedAt: string | null;
  claimExpiresAt: string | null;
  proofs: Array<{
    id: string;
    storageKey: string;
    originalFilename: string | null;
    mimeType: string;
    size: number;
    createdAt: string;
  }>;
};

type PaginatedTasks = {
  items: ClientTask[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

const confirmableStatuses = new Set(["SCANNER_SUBMITTED"]);

export default function ClientTasksPage() {
  const [data, setData] = useState<PaginatedTasks | null>(null);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [confirmingTaskId, setConfirmingTaskId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadTasks = useCallback(async (nextPage = page) => {
    try {
      const result = await api<PaginatedTasks>(`/client/tasks?page=${nextPage}&limit=12`);
      setData(result);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load tasks.");
    }
  }, [page]);

  useLiveRefresh(() => loadTasks(page), ["task:submitted", "task:confirmed", "task:expired", "credits:updated", "notification:new"]);

  useEffect(() => {
    loadTasks(page);
  }, [page]);

  async function markDone(task: ClientTask) {
    if (confirmingTaskId) return;
    setMessage("");
    setConfirmingTaskId(task.id);
    startTransition(async () => {
      try {
        await api(`/tasks/${task.id}/confirm`, { method: "POST", body: "{}" });
        setMessage(`${task.publicId} marked as done.`);
        await loadTasks(page);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not mark task done.");
      } finally {
        setConfirmingTaskId(null);
      }
    });
  }

  const tasks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.items ?? []).filter((task) => {
      if (!needle) return true;
      return (
        task.publicId.toLowerCase().includes(needle) ||
        task.status.toLowerCase().includes(needle) ||
        task.normalizedUrl.toLowerCase().includes(needle) ||
        task.title?.toLowerCase().includes(needle)
      );
    });
  }, [data, query]);

  return (
    <AppShell role="client">
      <div className="app-page">
        <section className="app-card">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="min-w-0">
              <p className="app-eyebrow">Task tracking</p>
              <h1 className="app-title">My posted tasks</h1>
              <p className="app-copy">
                Track every posted task, review scanner submissions, and mark completed work as done.
              </p>
            </div>
            <button
              onClick={() => loadTasks(page)}
              className="app-button border border-line bg-white text-ink shadow-sm"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="relative mt-5 w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-lg border border-line bg-white pl-10 pr-4 text-sm shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-emerald-100"
              placeholder="Search by ID, URL, title, or status"
            />
          </div>

          {message && <p className="mt-4 rounded-lg border border-line bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>}
        </section>

        <div className="grid gap-4">
          {tasks.map((task) => (
            <article key={task.id} className="app-card-compact">
              <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(180px,220px)] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-semibold text-slate-500">{task.publicId}</p>
                    <StatusBadge status={task.status} />
                  </div>
                  <h2 className="break-safe mt-2 text-lg font-semibold text-ink sm:text-xl">{task.title || task.normalizedUrl}</h2>
                  <a href={task.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-2 text-sm font-medium text-accent hover:underline">
                    <span className="break-safe min-w-0">{task.normalizedUrl}</span>
                    <ExternalLink size={15} className="shrink-0" />
                  </a>
                  {task.instructions && <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{task.instructions}</p>}
                  {task.proofs?.length > 0 && (
                    <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
                      {task.proofs.map((proof) => <ProofPreview key={proof.id} proof={proof} />)}
                    </div>
                  )}
                </div>

                <div className="app-meta-panel">
                  <Metric label="Posted" value={formatDate(task.publishedAt)} />
                  <Metric label="Submitted" value={formatDate(task.scannerSubmittedAt)} />
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-2 text-sm text-slate-500 sm:items-center">
                  <Timer size={16} className="mt-0.5 shrink-0 text-accent sm:mt-0" />
                  <span className="break-safe">{timelineText(task)}</span>
                </div>
                {confirmableStatuses.has(task.status) ? (
                  <button
                    disabled={isPending || confirmingTaskId !== null}
                    onClick={() => markDone(task)}
                    className="app-button bg-accent px-5 py-3 text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <CheckCircle2 size={18} />
                    {confirmingTaskId === task.id ? "Marking..." : "Mark as Done"}
                  </button>
                ) : (
                  <span className="text-sm text-slate-400">{actionText(task.status)}</span>
                )}
              </div>
            </article>
          ))}
        </div>

        {tasks.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line bg-white px-5 py-12 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-ink">No tasks found</h2>
            <p className="mt-2 text-sm text-slate-500">Post a task first, then track its status here.</p>
          </div>
        )}

        {data && (
          <div className="app-pagination">
            <p className="text-sm text-slate-500">
              Page {data.pagination.page} of {data.pagination.totalPages} · {data.pagination.total} tasks
            </p>
            <div className="app-pagination-actions">
              <button disabled={!data.pagination.hasPreviousPage} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">
                Previous
              </button>
              <button disabled={!data.pagination.hasNextPage} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function ProofPreview({ proof }: { proof: ClientTask["proofs"][number] }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let objectUrl: string | null = null;
    async function load() {
      const token = getToken();
      if (!token) return;
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1"}/tasks/proofs/${proof.storageKey}`, {
        headers: { authorization: `Bearer ${token}` }
      });
      if (!response.ok) return;
      objectUrl = URL.createObjectURL(await response.blob());
      setUrl(objectUrl);
    }
    load().catch(console.error);
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [proof.storageKey]);

  if (proof.mimeType.startsWith("image/") && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block min-w-0 overflow-hidden rounded-xl border border-line bg-slate-50">
        <img src={url} alt={proof.originalFilename ?? "Task proof"} className="h-36 w-full object-cover" />
      </a>
    );
  }

  return (
    <a href={url ?? "#"} target={url ? "_blank" : undefined} rel="noreferrer" className="flex min-h-24 min-w-0 items-center gap-3 rounded-xl border border-line bg-slate-50 p-4 text-sm text-slate-600">
      {proof.mimeType.startsWith("image/") ? <ImageIcon className="text-accent" size={22} /> : <FileText className="text-accent" size={22} />}
      <span className="break-safe min-w-0">{proof.originalFilename ?? "Uploaded proof"}</span>
    </a>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "COMPLETED" || status === "AUTO_COMPLETED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "SCANNER_SUBMITTED"
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : status.includes("EXPIRED") || status === "DISPUTED"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-700";
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{status.replaceAll("_", " ")}</span>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4"><span>{label}</span><span className="break-safe text-right font-semibold text-ink">{value}</span></div>;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function timelineText(task: ClientTask) {
  if (task.status === "AVAILABLE") return `Waiting for scanner. Grab window ends ${formatDate(task.claimExpiresAt)}.`;
  if (task.status === "CLAIMED") return `Scanner claimed this task ${formatDate(task.claimedAt)}.`;
  if (task.status === "SCANNER_SUBMITTED") return "Scanner submitted proof. Review and mark as done.";
  if (task.status === "COMPLETED" || task.status === "AUTO_COMPLETED") return `Completed ${formatDate(task.completedAt)}.`;
  return "Track this task status here.";
}

function actionText(status: string) {
  if (status === "AVAILABLE") return "Waiting for scanner";
  if (status === "CLAIMED") return "Waiting for scanner submission";
  if (status === "COMPLETED" || status === "AUTO_COMPLETED") return "Completed";
  if (status === "DISPUTED") return "In dispute";
  return "No action available";
}
