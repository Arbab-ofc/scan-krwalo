"use client";

import { useEffect, useState } from "react";
import { RefreshCw, ScanLine, Users, WalletCards } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { api } from "../../../lib/api";
import { formatMoney } from "../../../lib/money";

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

type ScannerRow = {
  id: string;
  status: string;
  availableBalance: string;
  reservedForPayout: string;
  lifetimeEarnings: string;
  lifetimePaid: string;
  completedTaskCount: number;
  wallet?: { availableBalance: string; reservedForPayout: string; lifetimeEarnings: string; lifetimePaid: string; currency: string } | null;
  user: { username: string; email: string; accountStatus: string };
};

type ClientRow = {
  id: string;
  status: string;
  availableTaskCredits: number;
  reservedTaskCredits: number;
  usedTaskCredits: number;
  totalPurchasedCredits: number;
  totalPostedTasks: number;
  completedTasks: number;
  creditAccount?: { availableCredits: number; reservedCredits: number; usedCredits: number; totalAddedCredits: number } | null;
  user: { username: string; email: string; accountStatus: string };
};

export default function AdminUsersPage() {
  const [scanners, setScanners] = useState<Paginated<ScannerRow> | null>(null);
  const [clients, setClients] = useState<Paginated<ClientRow> | null>(null);
  const [scannerPage, setScannerPage] = useState(1);
  const [clientPage, setClientPage] = useState(1);
  const [message, setMessage] = useState("");

  async function load() {
    setMessage("");
    try {
      const [scannerData, clientData] = await Promise.all([
        api<Paginated<ScannerRow>>(`/admin/scanners?page=${scannerPage}&limit=10`),
        api<Paginated<ClientRow>>(`/admin/clients?page=${clientPage}&limit=10`)
      ]);
      setScanners(scannerData);
      setClients(clientData);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load users.");
    }
  }

  useEffect(() => {
    load();
  }, [scannerPage, clientPage]);

  return (
    <AppShell role="admin">
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">User accounts</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Clients and scanners</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Review client credit balances and scanner earnings from real database profiles.
              </p>
            </div>
            <button onClick={load} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
          {message && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
        </section>

        <UserTable
          title="Scanners"
          icon={<ScanLine size={19} />}
          rows={scanners}
          page={scannerPage}
          setPage={setScannerPage}
          columns={["User", "Status", "Available", "Reserved", "Lifetime", "Paid", "Completed"]}
          render={(scanner) => [
            <UserCell key="user" user={scanner.user} />,
            scanner.status,
            money(scanner.wallet?.availableBalance ?? scanner.availableBalance, scanner.wallet?.currency ?? "USDT"),
            money(scanner.wallet?.reservedForPayout ?? scanner.reservedForPayout, scanner.wallet?.currency ?? "USDT"),
            money(scanner.wallet?.lifetimeEarnings ?? scanner.lifetimeEarnings, scanner.wallet?.currency ?? "USDT"),
            money(scanner.wallet?.lifetimePaid ?? scanner.lifetimePaid, scanner.wallet?.currency ?? "USDT"),
            scanner.completedTaskCount
          ]}
        />

        <UserTable
          title="Clients"
          icon={<Users size={19} />}
          rows={clients}
          page={clientPage}
          setPage={setClientPage}
          columns={["User", "Status", "Available", "Reserved", "Used", "Purchased", "Posted"]}
          render={(client) => [
            <UserCell key="user" user={client.user} />,
            client.status,
            client.creditAccount?.availableCredits ?? client.availableTaskCredits,
            client.creditAccount?.reservedCredits ?? client.reservedTaskCredits,
            client.creditAccount?.usedCredits ?? client.usedTaskCredits,
            client.creditAccount?.totalAddedCredits ?? client.totalPurchasedCredits,
            client.totalPostedTasks
          ]}
        />
      </div>
    </AppShell>
  );
}

function UserTable<T>({
  title,
  icon,
  rows,
  page,
  setPage,
  columns,
  render
}: {
  title: string;
  icon: React.ReactNode;
  rows: Paginated<T> | null;
  page: number;
  setPage: (page: number) => void;
  columns: string[];
  render: (row: T) => React.ReactNode[];
}) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-accent">{icon}</span>
        <div>
          <h2 className="text-xl font-semibold text-ink">{title}</h2>
          <p className="text-sm text-slate-500">{rows?.pagination.total ?? 0} total</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[.14em] text-slate-500">
              {columns.map((column) => <th key={column} className="border-b border-line py-3 pr-4">{column}</th>)}
            </tr>
          </thead>
          <tbody>
            {(rows?.items ?? []).map((row, index) => (
              <tr key={index}>
                {render(row).map((cell, cellIndex) => <td key={cellIndex} className="border-b border-line py-4 pr-4">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(rows?.items.length ?? 0) === 0 && <p className="py-8 text-center text-sm text-slate-500">No {title.toLowerCase()} found.</p>}

      {rows && (
        <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">Page {rows.pagination.page} of {rows.pagination.totalPages}</p>
          <div className="flex gap-2">
            <button disabled={!rows.pagination.hasPreviousPage} onClick={() => setPage(Math.max(1, page - 1))} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">Previous</button>
            <button disabled={!rows.pagination.hasNextPage} onClick={() => setPage(page + 1)} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </section>
  );
}

function UserCell({ user }: { user: { username: string; email: string; accountStatus: string } }) {
  return (
    <div>
      <p className="font-semibold text-ink">{user.username}</p>
      <p className="text-xs text-slate-500">{user.email}</p>
      <p className="mt-1 inline-flex rounded-full border border-line px-2 py-0.5 text-xs text-slate-500">{user.accountStatus}</p>
    </div>
  );
}

function money(value: string | number | bigint, currency: string) {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-ink">
      <WalletCards size={14} className="text-accent" />
      {formatMoney(value, currency)}
    </span>
  );
}
