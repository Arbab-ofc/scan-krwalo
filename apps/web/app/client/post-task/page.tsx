"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ClipboardList, Link2, Loader2 } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { api } from "../../../lib/api";
import { useLiveRefresh } from "../../../lib/live";

export default function PostTaskPage() {
  const [message, setMessage] = useState("");
  const [credits, setCredits] = useState<any>(null);
  const [presence, setPresence] = useState<{ onlineScanners: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadPageData = useCallback(async () => {
    const [creditData, presenceData] = await Promise.all([
      api("/client/credits"),
      api<{ onlineScanners: number }>("/client/scanner-presence")
    ]);
    setCredits(creditData);
    setPresence(presenceData);
  }, []);

  useLiveRefresh(loadPageData, ["credits:updated", "presence:updated"]);

  useEffect(() => {
    loadPageData().catch(console.error);
  }, [loadPageData]);

  async function submit(formData: FormData) {
    if (submitting) return;
    setSubmitting(true);
    setMessage("");
    try {
      const payload = {
        url: String(formData.get("url") ?? ""),
        title: String(formData.get("title") ?? ""),
        instructions: String(formData.get("instructions") ?? "")
      };
      await api("/tasks", { method: "POST", body: JSON.stringify(payload) });
      setMessage("Task published. One credit is reserved until the task is completed or expires.");
      await loadPageData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Post failed");
    } finally {
      setSubmitting(false);
    }
  }
  const availableCredits = credits?.availableCredits ?? 0;
  return (
    <AppShell role="client">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-7">
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">New task</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Post a URL task</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Add the exact URL and the scanner instructions. The backend reserves one credit only after validation succeeds.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-accent" />
            {presence?.onlineScanners ?? 0} scanners online now
          </div>

          <form action={submit} className="mt-7 grid gap-5">
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-ink">Task URL</span>
              <div className="relative">
                <Link2 className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input required name="url" className="h-12 w-full rounded-xl border border-line bg-white pl-12 pr-4 text-sm shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-emerald-100" placeholder="https://example.com/task" />
              </div>
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-ink">Title</span>
              <input name="title" className="h-12 rounded-xl border border-line bg-white px-4 text-sm shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-emerald-100" placeholder="Short title for your tracking list" />
            </label>
            <label className="grid gap-2">
              <span className="text-sm font-semibold text-ink">Scanner instructions</span>
              <textarea name="instructions" className="min-h-40 rounded-xl border border-line bg-white p-4 text-sm leading-6 shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-emerald-100" placeholder="Write exactly what the scanner should complete and what proof is expected." />
            </label>
            <button disabled={submitting || availableCredits < 1} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-semibold text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <ClipboardList size={18} />}
              {submitting ? "Publishing..." : "Publish task"}
            </button>
          </form>
          {message && <p className="mt-5 rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>}
        </section>

        <aside className="rounded-2xl border border-line bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Live availability</p>
          <p className="mt-3 text-4xl font-semibold text-ink">{presence?.onlineScanners ?? 0}</p>
          <p className="mt-1 text-sm text-slate-500">online scanners eligible for tasks</p>
          <div className="my-5 h-px bg-line" />
          <p className="text-sm font-semibold text-slate-500">Credit status</p>
          <p className="mt-3 text-4xl font-semibold text-ink">{availableCredits}</p>
          <p className="mt-1 text-sm text-slate-500">available task credits</p>
          <div className="mt-5 grid gap-3 text-sm text-slate-600">
            <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3"><span>Reserved</span><strong>{credits?.reservedCredits ?? 0}</strong></div>
            <div className="flex justify-between rounded-xl bg-slate-50 px-4 py-3"><span>Used</span><strong>{credits?.usedCredits ?? 0}</strong></div>
          </div>
          <Link href="/client/credits" className="focus-ring mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink">
            Manage credits
            <ArrowRight size={16} />
          </Link>
        </aside>
      </div>
    </AppShell>
  );
}
