"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { api, getToken } from "../../../lib/api";
import { minorUnitsToDisplay } from "../../../lib/money";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

const reports = [
  { key: "daily-completed", label: "Daily completed tasks" },
  { key: "scanner-earnings", label: "Scanner earnings" },
  { key: "client-credit-usage", label: "Client credit usage" },
  { key: "failed-expired", label: "Failed and expired tasks" },
  { key: "users", label: "Users export" },
  { key: "payouts", label: "Payouts export" },
  { key: "wallets", label: "Wallet ledger export" },
  { key: "credits", label: "Credit ledger export" }
] as const;

type ReportKey = typeof reports[number]["key"];

type ReportResponse = {
  items: Array<Record<string, any>>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export default function AdminReportsPage() {
  const [report, setReport] = useState<ReportKey>("daily-completed");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReportResponse | null>(null);
  const [message, setMessage] = useState("");
  const [exporting, setExporting] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params.toString();
  }, [page, startDate, endDate]);

  const exportQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params.toString();
  }, [startDate, endDate]);

  const load = useCallback(async () => {
    setMessage("");
    try {
      setData(await api<ReportResponse>(`/admin/reports/${report}?${query}`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load report.");
    }
  }, [query, report]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  async function exportCsv() {
    setExporting(true);
    setMessage("");
    try {
      const token = getToken();
      const response = await fetch(`${API_URL}/admin/reports/${report}/export.csv${exportQuery ? `?${exportQuery}` : ""}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error(`CSV export failed (${response.status})`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `scan-krwalo-${report}-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "CSV export failed.");
    } finally {
      setExporting(false);
    }
  }

  const columns = inferColumns(data?.items ?? []);

  return (
    <AppShell role="admin">
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Advanced reports</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Operational and financial exports</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Filter by date range, inspect report rows, and export CSV files for users, payouts, wallet ledgers, credit ledgers, and task performance.
              </p>
            </div>
            <button disabled={exporting} onClick={exportCsv} className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white shadow-glow disabled:opacity-60">
              <Download size={16} />
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-[1fr_170px_170px_auto]">
            <select value={report} onChange={(event) => { setPage(1); setReport(event.target.value as ReportKey); }} className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-emerald-100">
              {reports.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
            <input type="date" value={startDate} onChange={(event) => { setPage(1); setStartDate(event.target.value); }} className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-emerald-100" />
            <input type="date" value={endDate} onChange={(event) => { setPage(1); setEndDate(event.target.value); }} className="h-11 rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-accent focus:ring-4 focus:ring-emerald-100" />
            <button onClick={load} className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 text-sm font-semibold text-ink shadow-sm">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
          {message && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
        </section>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-ink">{reports.find((item) => item.key === report)?.label}</h2>
            <p className="text-sm text-slate-500">{data?.pagination.total ?? 0} records</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-[.14em] text-slate-500">
                  {columns.map((column) => <th key={column} className="border-b border-line py-3 pr-4">{humanize(column)}</th>)}
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((row, index) => (
                  <tr key={index}>
                    {columns.map((column) => <td key={column} className="border-b border-line py-3 pr-4">{formatCell(column, row[column])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(data?.items.length ?? 0) === 0 && <p className="py-10 text-center text-sm text-slate-500">No rows found for this report.</p>}
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

function inferColumns(rows: Array<Record<string, any>>) {
  if (rows.length === 0) return ["report", "status"];
  const first = rows[0];
  if (!first) return ["report", "status"];
  return Object.keys(first).filter((key) => !["id", "passwordHash"].includes(key)).slice(0, 14);
}

function humanize(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function formatCell(column: string, value: any) {
  if (value == null || value === "") return "-";
  const lowerColumn = column.toLowerCase();
  if (lowerColumn.includes("amount") || lowerColumn.includes("balance") || lowerColumn.includes("earnings") || lowerColumn.includes("reward") || lowerColumn.includes("paid")) {
    return minorUnitsToDisplay(value);
  }
  if (lowerColumn.includes("at") || lowerColumn.includes("date")) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }
  return String(value);
}
