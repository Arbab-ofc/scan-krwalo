"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { ArrowLeft, CreditCard, ExternalLink, FileImage, RefreshCw, ShieldAlert, WalletCards } from "lucide-react";
import { AppShell } from "../../../../components/shell";
import { api, getToken } from "../../../../lib/api";
import { formatMoney } from "../../../../lib/money";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

type Proof = {
  id: string;
  viewUrl: string;
  originalFilename: string | null;
  mimeType: string;
  size: number;
  createdAt: string;
};

export default function AdminTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [resolving, setResolving] = useState(false);

  const load = useCallback(async () => {
    setMessage("");
    try {
      setData(await api(`/admin/tasks/${id}`));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load task.");
    }
  }, [id]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  async function resolveDispute(resolution: "FREEZE" | "REFUND_CLIENT" | "PAY_SCANNER") {
    if (!task?.dispute || resolving) return;
    setResolving(true);
    setMessage("");
    try {
      await api(`/admin/disputes/${task.dispute.id}/resolve`, { method: "POST", body: JSON.stringify({ resolution }) });
      setMessage(resolution === "FREEZE" ? "Dispute frozen for review." : resolution === "REFUND_CLIENT" ? "Credit returned to the client." : "Reward paid to the scanner.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not resolve dispute.");
    } finally {
      setResolving(false);
    }
  }

  const task = data?.task;

  return (
    <AppShell role="admin">
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <div>
              <Link href="/admin/tasks" className="inline-flex items-center gap-2 text-sm font-semibold text-accent"><ArrowLeft size={16} /> Back to tasks</Link>
              <p className="mt-5 text-sm font-semibold uppercase tracking-[.18em] text-accent">Task detail</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{task?.publicId ?? "Loading task"}</h1>
              {task?.url && <a href={task.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-2 truncate text-sm text-slate-600 hover:text-ink"><ExternalLink size={15} /> {task.url}</a>}
            </div>
            <button onClick={load} className="focus-ring inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm">
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
          {message && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</p>}
        </section>

        {task && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <StatBox label="Status" value={task.status} />
              <StatBox label="Posted By" value={task.postedByRole} />
              <StatBox label="Reward" value={formatMoney(task.rewardAmount, task.rewardCurrency)} />
              <StatBox label="Proofs" value={task.proofs.length} />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title="Client Details">
                <PersonCard person={task.client?.user} empty="No client attached" />
                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  <Row label="Available credits" value={task.client?.creditAccount?.availableCredits ?? task.client?.availableTaskCredits ?? "-"} />
                  <Row label="Reserved credits" value={task.client?.creditAccount?.reservedCredits ?? task.client?.reservedTaskCredits ?? "-"} />
                  <Row label="Used credits" value={task.client?.creditAccount?.usedCredits ?? task.client?.usedTaskCredits ?? "-"} />
                </div>
              </Panel>
              <Panel title="Scanner Details">
                <PersonCard person={task.scanner?.user} empty="No scanner assigned" />
                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  <Row label="Available balance" value={task.scanner?.wallet ? formatMoney(task.scanner.wallet.availableBalance, task.scanner.wallet.currency) : "-"} />
                  <Row label="Lifetime earnings" value={task.scanner?.wallet ? formatMoney(task.scanner.wallet.lifetimeEarnings, task.scanner.wallet.currency) : "-"} />
                  <Row label="Lifetime paid" value={task.scanner?.wallet ? formatMoney(task.scanner.wallet.lifetimePaid, task.scanner.wallet.currency) : "-"} />
                </div>
              </Panel>
            </div>

            <Panel title="Instructions">
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600">{task.instructions || "No instructions provided."}</p>
            </Panel>

            <Panel title="Proof Files">
              <div className="grid gap-4 md:grid-cols-2">
                {task.proofs.map((proof: Proof) => <ProofPreview key={proof.id} proof={proof} />)}
                {task.proofs.length === 0 && <p className="text-sm text-slate-500">No proof uploaded.</p>}
              </div>
            </Panel>

            <div className="grid gap-6 lg:grid-cols-2">
              <Timeline events={task.events} />
              <Panel title="Dispute">
                {task.dispute ? (
                  <div className="grid gap-2 text-sm text-slate-600">
                    <Row label="Status" value={task.dispute.status} />
                    <Row label="Reason" value={task.dispute.reasonCode} />
                    <Row label="Description" value={task.dispute.description} />
                    <Row label="Resolution" value={task.dispute.adminResolution ?? "-"} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button disabled={resolving || task.dispute.status === "UNDER_REVIEW"} onClick={() => resolveDispute("FREEZE")} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50"><ShieldAlert size={16} /> Freeze</button>
                      <button disabled={resolving || task.dispute.status.startsWith("RESOLVED")} onClick={() => resolveDispute("REFUND_CLIENT")} className="inline-flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold text-ink disabled:opacity-50"><CreditCard size={16} /> Return credit</button>
                      <button disabled={resolving || task.dispute.status.startsWith("RESOLVED")} onClick={() => resolveDispute("PAY_SCANNER")} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><WalletCards size={16} /> Pay scanner</button>
                    </div>
                  </div>
                ) : <p className="text-sm text-slate-500">No dispute opened.</p>}
              </Panel>
            </div>

            <Ledger title="Client Credit Ledger" rows={data.creditLedger} amountSuffix="credits" />
            <Ledger title="Scanner Wallet Ledger" rows={data.walletLedger} money />
          </>
        )}
      </div>
    </AppShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6"><h2 className="text-xl font-semibold text-ink">{title}</h2><div className="mt-4">{children}</div></section>;
}

function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-2xl border border-line bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-ink">{value}</p></div>;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="flex justify-between gap-4 rounded-lg bg-slate-50 px-3 py-2"><span>{label}</span><strong className="text-right text-ink">{value}</strong></div>;
}

function PersonCard({ person, empty }: { person?: { username: string; email: string; accountStatus?: string } | null; empty: string }) {
  if (!person) return <p className="text-sm text-slate-500">{empty}</p>;
  return <div><p className="font-semibold text-ink">{person.username}</p><p className="text-sm text-slate-500">{person.email}</p>{person.accountStatus && <p className="mt-2 inline-flex rounded-full border border-line px-2 py-1 text-xs text-slate-500">{person.accountStatus}</p>}</div>;
}

function ProofPreview({ proof }: { proof: Proof }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let revokedUrl: string | null = null;
    const token = getToken();
    fetch(`${API_URL}${proof.viewUrl}`, { headers: token ? { authorization: `Bearer ${token}` } : {} })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load proof.");
        return response.blob();
      })
      .then((blob) => {
        revokedUrl = window.URL.createObjectURL(blob);
        setUrl(revokedUrl);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load proof."));
    return () => {
      if (revokedUrl) window.URL.revokeObjectURL(revokedUrl);
    };
  }, [proof.viewUrl]);

  return (
    <div className="rounded-xl border border-line bg-slate-50 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink"><FileImage size={17} className="text-accent" /> {proof.originalFilename ?? proof.id}</div>
      {url && proof.mimeType.startsWith("image/") && <img src={url} alt={proof.originalFilename ?? "Task proof"} className="max-h-72 w-full rounded-lg object-contain" />}
      {url && proof.mimeType === "application/pdf" && <a href={url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-accent">Open PDF proof</a>}
      {!url && <p className="text-sm text-slate-500">{error || "Loading proof..."}</p>}
      <p className="mt-3 text-xs text-slate-500">{proof.mimeType} - {Math.ceil(proof.size / 1024)} KB - {formatDate(proof.createdAt)}</p>
    </div>
  );
}

function Timeline({ events }: { events: Array<{ id: string; eventType: string; previousStatus: string | null; newStatus: string; actorRole: string | null; createdAt: string }> }) {
  return (
    <Panel title="Task Timeline">
      <div className="grid gap-3">
        {events.map((event) => (
          <div key={event.id} className="border-l-2 border-accent pl-4">
            <p className="font-semibold text-ink">{event.eventType}</p>
            <p className="text-sm text-slate-500">{event.previousStatus ?? "START"} {"->"} {event.newStatus} {event.actorRole ? `by ${event.actorRole}` : ""}</p>
            <p className="text-xs text-slate-400">{formatDate(event.createdAt)}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function Ledger({ title, rows, money = false, amountSuffix = "" }: { title: string; rows: any[]; money?: boolean; amountSuffix?: string }) {
  return (
    <Panel title={title}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead><tr className="text-xs uppercase tracking-[.14em] text-slate-500">{["Type", "Direction", "Amount", "Before", "After", "Reference", "Created"].map((h) => <th key={h} className="border-b border-line py-3 pr-4">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="border-b border-line py-3 pr-4">{row.type}</td>
                <td className="border-b border-line py-3 pr-4">{row.direction}</td>
                <td className="border-b border-line py-3 pr-4 font-semibold text-ink">{money ? formatMoney(row.amount, row.currency) : `${row.amount} ${amountSuffix}`}</td>
                <td className="border-b border-line py-3 pr-4">{money ? formatMoney(row.availableBefore, row.currency) : row.availableBefore}</td>
                <td className="border-b border-line py-3 pr-4">{money ? formatMoney(row.availableAfter, row.currency) : row.availableAfter}</td>
                <td className="border-b border-line py-3 pr-4">{row.referenceType ?? "-"} {row.referenceId ?? ""}</td>
                <td className="border-b border-line py-3 pr-4">{formatDate(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="py-6 text-center text-sm text-slate-500">No ledger entries found.</p>}
    </Panel>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
