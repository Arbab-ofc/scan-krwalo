"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { ArrowRight, Clock3, Landmark, RefreshCw, WalletCards } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { api } from "../../../lib/api";
import { formatMoney } from "../../../lib/money";

type Payout = {
  id: string;
  amount: string;
  currency: string;
  method: string;
  status: string;
  requestedAt: string;
  paidAt?: string | null;
  rejectedAt?: string | null;
  transactionReference?: string | null;
  rejectionReason?: string | null;
};

type Paginated<T> = {
  items: T[];
  pagination: { page: number; total: number; totalPages: number; hasNextPage: boolean; hasPreviousPage: boolean };
};

type Wallet = {
  availableBalance: string;
  reservedForPayout: string;
  lifetimeEarnings: string;
  lifetimePaid: string;
  currency: string;
};

export default function ScannerPayoutsPage() {
  const [payouts, setPayouts] = useState<Paginated<Payout> | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const load = useCallback(async () => {
    setMessage("");
    try {
      const [walletData, payoutData] = await Promise.all([
        api<Wallet | null>("/scanner/wallet"),
        api<Paginated<Payout>>(`/scanner/payouts?page=${page}&limit=20`)
      ]);
      setWallet(walletData);
      setPayouts(payoutData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load payouts.");
    }
  }, [page]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  function request(formData: FormData) {
    if (isPending) return;
    setMessage("");
    startTransition(async () => {
      try {
        await api("/scanner/payouts", {
          method: "POST",
          body: JSON.stringify({ amount: formData.get("amount"), method: formData.get("method") })
        });
        setMessage("Payout requested.");
        await load();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Request failed.");
      }
    });
  }

  return (
    <AppShell role="scanner">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="app-card">
            <p className="app-eyebrow">Scanner wallet</p>
            <h1 className="app-title">Payouts</h1>
            <p className="app-copy">Request USDT payouts and track every processing state.</p>
            <div className="mt-6 grid gap-3">
              <BalanceRow label="Available" value={formatMoney(wallet?.availableBalance ?? 0, wallet?.currency ?? "USDT")} strong />
              <BalanceRow label="Reserved" value={formatMoney(wallet?.reservedForPayout ?? 0, wallet?.currency ?? "USDT")} />
              <BalanceRow label="Lifetime paid" value={formatMoney(wallet?.lifetimePaid ?? 0, wallet?.currency ?? "USDT")} />
            </div>
          </section>

          <section className="app-card-compact">
            <h2 className="text-lg font-semibold text-ink">New request</h2>
            <p className="mt-2 text-sm text-slate-500">Minimum payout amount is USDT 0.50.</p>
            <form action={request} className="mt-5 grid gap-3">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Amount
                <input name="amount" required className="app-input" placeholder="0.50" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Method
                <select name="method" className="app-input">
                  <option value="BINANCE_ID">Binance ID</option>
                  <option value="USDT_BEP20">USDT BEP20</option>
                </select>
              </label>
              <button disabled={isPending} className="app-button mt-2 min-h-12 rounded-xl bg-accent px-5 text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-70">
                <WalletCards size={18} />
                {isPending ? "Requesting..." : "Request payout"}
              </button>
            </form>
            <Link href="/scanner/payout-settings" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent">
              Update payout destination
              <ArrowRight size={15} />
            </Link>
          </section>
        </aside>

        <section className="app-card">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h2 className="app-section-title">Payout history</h2>
              <p className="text-sm text-slate-500">{payouts?.pagination.total ?? 0} requests</p>
            </div>
            <button onClick={load} className="app-button border border-line bg-white text-ink shadow-sm">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          {message && <p className="mt-4 rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>}

          <div className="mt-5 grid gap-3">
            {(payouts?.items ?? []).map((payout) => (
              <article key={payout.id} className="rounded-2xl border border-line p-4 transition hover:border-slate-300 hover:bg-slate-50/70">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <StatusBadge status={payout.status} />
                    <p className="break-safe mt-3 text-xl font-semibold text-ink sm:text-2xl">{formatMoney(payout.amount, payout.currency ?? "USDT")}</p>
                    <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><Landmark size={15} className="shrink-0" /> <span className="break-safe">{payout.method.replace("_", " ")}</span></p>
                  </div>
                  <div className="text-sm text-slate-500 sm:text-right">
                    <p className="flex items-center gap-2 sm:justify-end"><Clock3 size={15} className="shrink-0" /> <span>Requested {formatDate(payout.requestedAt)}</span></p>
                    {payout.paidAt && <p className="mt-1">Paid {formatDate(payout.paidAt)}</p>}
                    {payout.rejectedAt && <p className="mt-1">Rejected {formatDate(payout.rejectedAt)}</p>}
                  </div>
                </div>
                {payout.transactionReference && <p className="break-safe mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">Reference: {payout.transactionReference}</p>}
                {payout.rejectionReason && <p className="break-safe mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">Reason: {payout.rejectionReason}</p>}
              </article>
            ))}
          </div>

          {(payouts?.items.length ?? 0) === 0 && <p className="py-12 text-center text-sm text-slate-500">No payout requests yet.</p>}

          {payouts && (
            <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">Page {payouts.pagination.page} of {payouts.pagination.totalPages}</p>
              <div className="app-pagination-actions">
                <button disabled={!payouts.pagination.hasPreviousPage} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">Previous</button>
                <button disabled={!payouts.pagination.hasNextPage} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function BalanceRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <span className="text-sm text-slate-500">{label}</span>
      <strong className={`break-safe text-right ${strong ? "text-lg text-ink sm:text-xl" : "text-ink"}`}>{value}</strong>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "PAID"
      ? "bg-emerald-50 text-emerald-700"
      : status === "REJECTED" || status === "CANCELLED"
        ? "bg-rose-50 text-rose-700"
        : status === "PROCESSING"
          ? "bg-cyan-50 text-cyan-700"
          : "bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{status.replace("_", " ")}</span>;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
