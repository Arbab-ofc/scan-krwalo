"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, ClipboardList, Layers3, Link2, Loader2 } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { api } from "../../../lib/api";
import { useLiveRefresh } from "../../../lib/live";

export default function PostTaskPage() {
  const [message, setMessage] = useState("");
  const [credits, setCredits] = useState<any>(null);
  const [presence, setPresence] = useState<{ onlineScanners: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"single" | "multiple">("single");
  const [bulkUrls, setBulkUrls] = useState("");

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
      if (mode === "multiple") {
        const urls = splitBulkUrls(String(formData.get("urls") ?? ""));
        await api<{ count: number }>("/tasks/bulk", { method: "POST", body: JSON.stringify({ urls }) });
        setBulkUrls("");
        setMessage(`${urls.length} tasks published. Each task was sent to scanners separately.`);
      } else {
        const payload = {
          url: String(formData.get("url") ?? ""),
          title: String(formData.get("title") ?? ""),
          instructions: String(formData.get("instructions") ?? "")
        };
        await api("/tasks", { method: "POST", body: JSON.stringify(payload) });
        setMessage("Task published. One credit is reserved until the task is completed or expires.");
      }
      await loadPageData();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Post failed");
    } finally {
      setSubmitting(false);
    }
  }
  const availableCredits = credits?.availableCredits ?? 0;
  const bulkCount = splitBulkUrls(bulkUrls).length;
  const requiredCredits = mode === "multiple" ? bulkCount : 1;
  const canSubmit = submitting || availableCredits < requiredCredits || (mode === "multiple" && bulkCount === 0);
  return (
    <AppShell role="client">
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="app-card">
          <p className="app-eyebrow">New task</p>
          <h1 className="app-title">Post URL tasks</h1>
          <p className="app-copy">
            Add the exact URL and the scanner instructions. The backend reserves one credit only after validation succeeds.
          </p>
          <div className="mt-5 inline-flex max-w-full items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-accent" />
            {presence?.onlineScanners ?? 0} scanners online now
          </div>

          <div className="mt-6 grid gap-2 rounded-xl border border-line bg-slate-50 p-1 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`focus-ring flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${mode === "single" ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink"}`}
              aria-pressed={mode === "single"}
            >
              <Link2 size={16} />
              Single task
            </button>
            <button
              type="button"
              onClick={() => setMode("multiple")}
              className={`focus-ring flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition ${mode === "multiple" ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink"}`}
              aria-pressed={mode === "multiple"}
            >
              <Layers3 size={16} />
              Multiple tasks
            </button>
          </div>

          <form action={submit} className="mt-7 grid gap-5">
            {mode === "single" ? (
              <>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-ink">Task URL</span>
                  <div className="relative">
                    <Link2 className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input required name="url" className="app-input pl-12" placeholder="https://example.com/task" />
                  </div>
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-ink">Title</span>
                  <input name="title" className="app-input" placeholder="Short title for your tracking list" />
                </label>
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-ink">Scanner instructions</span>
                  <textarea name="instructions" className="min-h-40 w-full rounded-xl border border-line bg-white p-4 text-sm leading-6 shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-emerald-100" placeholder="Write exactly what the scanner should complete and what proof is expected." />
                </label>
              </>
            ) : (
              <label className="grid gap-2">
                <span className="text-sm font-semibold text-ink">Task URLs</span>
                <textarea
                  required
                  name="urls"
                  value={bulkUrls}
                  onChange={(event) => setBulkUrls(event.target.value)}
                  className="min-h-44 w-full rounded-xl border border-line bg-white p-4 font-mono text-sm leading-7 shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-emerald-100"
                  placeholder="https://example.com/task-one https://example.com/task-two https://example.com/task-three"
                />
                <span className="text-xs leading-5 text-slate-500">
                  Separate each task link with one space. Title and scanner instructions are not used for multiple tasks.
                </span>
              </label>
            )}
            <button disabled={canSubmit} className="app-button min-h-12 rounded-xl bg-accent px-5 py-3 text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <ClipboardList size={18} />}
              {submitting ? "Publishing..." : mode === "multiple" ? `Publish ${bulkCount || ""} tasks` : "Publish task"}
            </button>
          </form>
          {message && <p className="mt-5 rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>}
        </section>

        <aside className="app-card-compact xl:sticky xl:top-8 xl:self-start">
          <p className="text-sm font-semibold text-slate-500">Live availability</p>
          <p className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">{presence?.onlineScanners ?? 0}</p>
          <p className="mt-1 text-sm text-slate-500">online scanners eligible for tasks</p>
          <div className="my-5 h-px bg-line" />
          <p className="text-sm font-semibold text-slate-500">Credit status</p>
          <p className="mt-3 text-3xl font-semibold text-ink sm:text-4xl">{availableCredits}</p>
          <p className="mt-1 text-sm text-slate-500">available task credits</p>
          <div className="mt-5 grid gap-3 text-sm text-slate-600">
            <div className="flex justify-between rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800"><span>This post needs</span><strong>{requiredCredits}</strong></div>
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

function splitBulkUrls(value: string) {
  return value.trim().split(/\s+/).filter(Boolean);
}
