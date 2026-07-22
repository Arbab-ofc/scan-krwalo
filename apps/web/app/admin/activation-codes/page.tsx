"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarClock, CheckCircle2, Copy, KeyRound, Search, ShieldX, Ticket, Trash2 } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { api } from "../../../lib/api";

type ActivationCode = {
  id: string;
  fullCode: string | null;
  codePreview: string;
  codeType: "SCANNER" | "CLIENT";
  initialTaskCredits: number | null;
  recordedPrice: string | null;
  status: string;
  effectiveStatus: string;
  isExpired: boolean;
  isUseful: boolean;
  expiresAt: string | null;
  createdAt: string;
  redeemedAt: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  redeemedByUser: { id: string; username: string; email: string } | null;
};

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

const filters = ["ALL", "SCANNER", "CLIENT", "ACTIVE", "REDEEMED", "EXPIRED", "REVOKED"] as const;

export default function AdminCodesPage() {
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [created, setCreated] = useState<ActivationCode | null>(null);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("ALL");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Paginated<ActivationCode>["pagination"] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadCodes(page);
  }, [page]);

  function loadCodes(nextPage = page) {
    api<Paginated<ActivationCode>>(`/admin/activation-codes?page=${nextPage}&limit=20`).then((data) => {
      setCodes(data.items);
      setPagination(data.pagination);
    }).catch((error) => {
      setMessage(error instanceof Error ? error.message : "Could not load activation codes.");
    });
  }

  function generate(type: "scanner" | "client", formData?: FormData) {
    setMessage("");
    startTransition(async () => {
      try {
        const body = type === "client"
          ? {
              initialTaskCredits: Number(formData?.get("initialTaskCredits") ?? 25),
              recordedPrice: String(formData?.get("recordedPrice") || "0.00"),
              expiresAt: formatExpiry(formData?.get("expiresAt"))
            }
          : {
              expiresAt: formatExpiry(formData?.get("expiresAt"))
            };
        const data = await api<ActivationCode>(`/admin/activation-codes/${type}`, {
          method: "POST",
          body: JSON.stringify(body)
        });
        setCreated(data);
        setPage(1);
        loadCodes(1);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not generate code.");
      }
    });
  }

  async function revoke(code: ActivationCode) {
    setMessage("");
    try {
      const updated = await api<ActivationCode>(`/admin/activation-codes/${code.id}/revoke`, {
        method: "POST",
        body: JSON.stringify({ reason: "Revoked by Admin" })
      });
      setCodes((items) => items.map((item) => item.id === updated.id ? updated : item));
      setMessage(`${code.fullCode ?? code.codePreview} revoked.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not revoke code.");
    }
  }

  async function deleteRevoked(code: ActivationCode) {
    setMessage("");
    try {
      await api(`/admin/activation-codes/${code.id}`, { method: "DELETE" });
      setCodes((items) => items.filter((item) => item.id !== code.id));
      setMessage(`${code.fullCode ?? code.codePreview} deleted.`);
      loadCodes(page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete code.");
    }
  }

  const visibleCodes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return codes.filter((code) => {
      const matchesFilter =
        filter === "ALL" ||
        code.codeType === filter ||
        code.effectiveStatus === filter;
      const matchesQuery =
        !needle ||
        code.fullCode?.toLowerCase().includes(needle) ||
        code.codePreview.toLowerCase().includes(needle) ||
        code.redeemedByUser?.email.toLowerCase().includes(needle) ||
        code.redeemedByUser?.username.toLowerCase().includes(needle);
      return matchesFilter && matchesQuery;
    });
  }, [codes, filter, query]);

  return (
    <AppShell role="admin">
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Admin codes</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Activation codes</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Generate and track Scanner and Client codes. New codes are stored and shown here with expiry, redemption, and revocation status.
              </p>
            </div>
            <button onClick={() => loadCodes(page)} className="focus-ring rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm">
              Refresh
            </button>
          </div>

          {created && (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Generated code</p>
                  <p className="mt-1 font-mono text-2xl font-semibold tracking-wide">{created.fullCode ?? created.codePreview}</p>
                </div>
                <CopyButton value={created.fullCode ?? created.codePreview} />
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <form action={(formData) => generate("scanner", formData)} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-accent"><KeyRound size={21} /></span>
              <div>
                <h2 className="font-semibold text-ink">Scanner code</h2>
                <p className="text-sm text-slate-500">Creates a stored SCN code for Scanner access.</p>
              </div>
            </div>
            <input name="expiresAt" type="datetime-local" className="mt-5 h-12 w-full rounded-lg border border-line bg-white px-4 text-sm shadow-sm" />
            <button disabled={isPending} className="mt-4 w-full rounded-lg bg-accent px-5 py-3 font-semibold text-white shadow-glow disabled:opacity-70">
              Generate SCN Code
            </button>
          </form>

          <form action={(formData) => generate("client", formData)} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700"><Ticket size={21} /></span>
              <div>
                <h2 className="font-semibold text-ink">Client code</h2>
                <p className="text-sm text-slate-500">Creates a stored CLI code with task credits.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <input name="initialTaskCredits" type="number" min="1" defaultValue="25" className="h-12 rounded-lg border border-line bg-white px-4 text-sm shadow-sm" placeholder="Credits" required />
              <input name="recordedPrice" defaultValue="0.00" className="h-12 rounded-lg border border-line bg-white px-4 text-sm shadow-sm" placeholder="Price" />
              <input name="expiresAt" type="datetime-local" className="h-12 rounded-lg border border-line bg-white px-4 text-sm shadow-sm" />
            </div>
            <button disabled={isPending} className="mt-4 w-full rounded-lg bg-ink px-5 py-3 font-semibold text-white disabled:opacity-70">
              Generate CLI Code
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 w-full rounded-lg border border-line bg-white pl-10 pr-4 text-sm shadow-sm"
                placeholder="Search code, preview, or user"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item}
                  onClick={() => setFilter(item)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${filter === item ? "bg-accent text-white shadow-glow" : "border border-line bg-white text-slate-600"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {message && <p className="mt-4 rounded-lg border border-line bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>}

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[980px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[.14em] text-slate-500">
                  <th className="border-b border-line py-3 pr-4">Code</th>
                  <th className="border-b border-line py-3 pr-4">Type</th>
                  <th className="border-b border-line py-3 pr-4">Status</th>
                  <th className="border-b border-line py-3 pr-4">Credits</th>
                  <th className="border-b border-line py-3 pr-4">Expiry</th>
                  <th className="border-b border-line py-3 pr-4">Redeemed by</th>
                  <th className="border-b border-line py-3 pr-4">Created</th>
                  <th className="border-b border-line py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleCodes.map((code) => (
                  <tr key={code.id} className="border-b border-line">
                    <td className="border-b border-line py-4 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-ink">{code.fullCode ?? code.codePreview}</span>
                        <CopyButton value={code.fullCode ?? code.codePreview} compact />
                      </div>
                      {!code.fullCode && <p className="mt-1 text-xs text-slate-500">Old code was not stored before this update.</p>}
                    </td>
                    <td className="border-b border-line py-4 pr-4">{code.codeType}</td>
                    <td className="border-b border-line py-4 pr-4"><StatusBadge code={code} /></td>
                    <td className="border-b border-line py-4 pr-4">{code.codeType === "CLIENT" ? code.initialTaskCredits ?? 0 : "No limit"}</td>
                    <td className="border-b border-line py-4 pr-4">
                      <div className="flex items-center gap-2 text-slate-700">
                        <CalendarClock size={15} className="text-slate-400" />
                        {code.expiresAt ? formatDate(code.expiresAt) : "Never"}
                      </div>
                    </td>
                    <td className="border-b border-line py-4 pr-4">
                      {code.redeemedByUser ? (
                        <div>
                          <p className="font-medium text-ink">{code.redeemedByUser.username}</p>
                          <p className="text-xs text-slate-500">{code.redeemedByUser.email}</p>
                        </div>
                      ) : "Not redeemed"}
                    </td>
                    <td className="border-b border-line py-4 pr-4">{formatDate(code.createdAt)}</td>
                    <td className="border-b border-line py-4">
                      {code.isUseful ? (
                        <button onClick={() => revoke(code)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                          Revoke
                        </button>
                      ) : code.effectiveStatus === "REVOKED" ? (
                        <button onClick={() => deleteRevoked(code)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">
                          <Trash2 size={13} />
                          Delete
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Locked</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {visibleCodes.length === 0 && (
            <div className="grid place-items-center rounded-xl border border-dashed border-line py-12 text-center text-slate-500">
              No activation codes found.
            </div>
          )}

          {pagination && (
            <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} codes
              </p>
              <div className="flex gap-2">
                <button
                  disabled={!pagination.hasPreviousPage}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={!pagination.hasNextPage}
                  onClick={() => setPage((value) => value + 1)}
                  className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function formatExpiry(value: FormDataEntryValue | null | undefined) {
  if (!value) return undefined;
  const text = String(value);
  return text ? new Date(text).toISOString() : undefined;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function StatusBadge({ code }: { code: ActivationCode }) {
  const className =
    code.effectiveStatus === "ACTIVE"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : code.effectiveStatus === "EXPIRED"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : code.effectiveStatus === "REDEEMED"
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-red-200 bg-red-50 text-red-700";
  const Icon = code.isUseful ? CheckCircle2 : ShieldX;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>
      <Icon size={13} />
      {code.isUseful ? "Useful" : code.effectiveStatus}
    </span>
  );
}

function CopyButton({ value, compact = false }: { value: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className={`focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white font-semibold text-slate-700 shadow-sm hover:text-ink ${compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"}`}
    >
      <Copy size={compact ? 13 : 16} />
      {copied ? "Copied" : compact ? "Copy" : "Copy code"}
    </button>
  );
}
