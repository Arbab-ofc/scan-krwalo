"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { api } from "../../../lib/api";
import { formatMoney } from "../../../lib/money";

type PayoutStatus = "REQUESTED" | "PROCESSING" | "PAID" | "REJECTED" | "CANCELLED";

type Payout = {
  id: string;
  amount: string;
  currency: string;
  method: string;
  destinationSnapshot: Record<string, string | null>;
  status: PayoutStatus;
  requestedAt: string;
  transactionReference?: string | null;
  rejectionReason?: string | null;
  scanner: {
    user: {
      username: string;
      email: string;
    };
  };
};

type PaginatedPayouts = {
  items: Payout[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export default function AdminPayoutsPage() {
  const [data, setData] = useState<PaginatedPayouts | null>(null);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const [busyAction, setBusyAction] = useState<{ id: string; label: string } | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);

  async function load(nextPage = page) {
    const result = await api<PaginatedPayouts>(`/admin/payouts?page=${nextPage}&limit=20`);
    setData(result);
  }

  useEffect(() => {
    load(page).catch((error) => setMessage(error instanceof Error ? error.message : "Could not load payouts."));
  }, [page]);

  async function act(payout: Payout, action: "processing" | "paid" | "reject") {
    setMessage("");
    const body: Record<string, string> = {};
    if (action === "paid") {
      const reference = window.prompt("Payment reference or transaction hash (optional)")?.trim();
      if (reference) body.transactionReference = reference;
    }
    if (action === "reject") {
      const reason = window.prompt("Rejection reason (optional)")?.trim();
      if (reason) body.rejectionReason = reason;
    }

    setBusyAction({ id: payout.id, label: actionLabel(action) });
    try {
      await api(`/admin/payouts/${payout.id}/${action}`, { method: "POST", body: JSON.stringify(body) });
      await load(page);
      setMessage(`Payout ${actionLabel(action).toLowerCase()} successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payout action failed.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <AppShell role="admin">
      <div className="relative">
        {busyAction && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-white/70 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-2xl border border-line bg-white px-5 py-4 text-sm font-semibold text-ink shadow-xl">
              <RefreshCw size={18} className="animate-spin text-accent" />
              {busyAction.label} payout...
            </div>
          </div>
        )}

        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Admin payouts</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Payout requests</h1>
              <p className="mt-2 text-sm text-slate-600">Process scanner payout requests and keep wallet ledger history accurate.</p>
            </div>
            <button
              onClick={() => load(page).catch((error) => setMessage(error instanceof Error ? error.message : "Refresh failed."))}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
          {message && <p className="mt-4 rounded-lg border border-line bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>}
        </section>

        <div className="mt-6 grid gap-4">
          {items.map((payout) => (
            <article key={payout.id} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={payout.status} />
                    <span className="font-mono text-xs text-slate-500">{payout.id}</span>
                  </div>
                  <h2 className="mt-3 text-2xl font-semibold text-ink">{formatMoney(payout.amount, payout.currency)}</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {payout.scanner.user.username} - {payout.scanner.user.email}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {payout.method}: {destinationText(payout.destinationSnapshot)}
                  </p>
                  {payout.transactionReference && <p className="mt-2 text-sm text-slate-500">Reference: {payout.transactionReference}</p>}
                  {payout.rejectionReason && <p className="mt-2 text-sm text-slate-500">Reason: {payout.rejectionReason}</p>}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <ActionButton
                    disabled={busyAction !== null || payout.status !== "REQUESTED"}
                    onClick={() => act(payout, "processing")}
                    icon={<Clock3 size={17} />}
                    label="Processing"
                  />
                  <ActionButton
                    disabled={busyAction !== null || !["REQUESTED", "PROCESSING"].includes(payout.status)}
                    onClick={() => act(payout, "paid")}
                    icon={<CheckCircle2 size={17} />}
                    label="Paid"
                    primary
                  />
                  <ActionButton
                    disabled={busyAction !== null || !["REQUESTED", "PROCESSING"].includes(payout.status)}
                    onClick={() => act(payout, "reject")}
                    icon={<XCircle size={17} />}
                    label="Reject"
                  />
                </div>
              </div>
            </article>
          ))}
        </div>

        {items.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-line bg-white px-5 py-12 text-center shadow-sm">
            <h2 className="text-xl font-semibold text-ink">No payout requests</h2>
            <p className="mt-2 text-sm text-slate-500">Scanner payout requests will appear here.</p>
          </div>
        )}

        {data && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Page {data.pagination.page} of {data.pagination.totalPages} - {data.pagination.total} payouts
            </p>
            <div className="flex gap-2">
              <button disabled={!data.pagination.hasPreviousPage || busyAction !== null} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">
                Previous
              </button>
              <button disabled={!data.pagination.hasNextPage || busyAction !== null} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function actionLabel(action: "processing" | "paid" | "reject") {
  if (action === "processing") return "Processing";
  if (action === "paid") return "Paying";
  return "Rejecting";
}

function destinationText(value: Record<string, string | null>) {
  return Object.values(value).find(Boolean) ?? "Not provided";
}

function StatusBadge({ status }: { status: PayoutStatus }) {
  const className =
    status === "PAID"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "REJECTED" || status === "CANCELLED"
        ? "border-rose-200 bg-rose-50 text-rose-800"
        : status === "PROCESSING"
          ? "border-blue-200 bg-blue-50 text-blue-800"
          : "border-amber-200 bg-amber-50 text-amber-800";
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{status.replaceAll("_", " ")}</span>;
}

function ActionButton({ disabled, icon, label, onClick, primary = false }: { disabled: boolean; icon: ReactNode; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45 ${
        primary ? "bg-accent text-white shadow-glow" : "border border-line bg-white text-ink shadow-sm"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
