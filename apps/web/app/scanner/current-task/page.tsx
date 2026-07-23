"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileImage, Timer } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { api } from "../../../lib/api";
import { useLiveRefresh } from "../../../lib/live";

export default function CurrentTaskPage() {
  const [task, setTask] = useState<any>(null);
  const [proof, setProof] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [serverOffset, setServerOffset] = useState(0);

  const loadTask = useCallback(async () => {
    const data = await api<{ task: any; serverTime: string }>("/scanner/current-task");
    setTask(data.task);
    setServerOffset(new Date(data.serverTime).getTime() - Date.now());
  }, []);

  useLiveRefresh(loadTask, ["task:updated", "task:submitted", "task:confirmed", "task:expired", "wallet:updated"]);

  useEffect(() => {
    loadTask().catch(console.error);
  }, [loadTask]);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now() + serverOffset), 1000);
    return () => window.clearInterval(clock);
  }, [serverOffset]);

  async function submit() {
    if (!task || submitting || task.status !== "CLAIMED" || !proof) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("proof", proof);
      const updated = await api(`/tasks/${task.id}/submit`, { method: "POST", body: formData });
      setTask(updated);
      setMessage("Submitted for client review.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Submit failed");
      setSubmitting(false);
    }
  }
  const canSubmit = task?.status === "CLAIMED" && !submitting && Boolean(proof);
  return (
    <AppShell role="scanner">
      <div className="app-page">
        <section>
          <p className="app-eyebrow">Active work</p>
          <h1 className="app-title">Current task</h1>
        </section>
        {task ? (
          <div className="app-card">
            <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
              <div className="min-w-0">
                <h2 className="font-mono text-sm font-semibold text-slate-500">{task.publicId}</h2>
                <p className="break-safe mt-2 text-lg font-semibold text-ink sm:text-xl">{task.title || task.normalizedUrl}</p>
              </div>
              {task.status === "CLAIMED" && (
                <div className="flex w-full items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 md:w-auto">
                  <Timer className="shrink-0" size={17} />
                  <span>Completion: {remainingTime(task.completionExpiresAt, now)}</span>
                </div>
              )}
            </div>
            <a className="app-button mt-5 bg-ink px-5 py-3 text-white" href={task.normalizedUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={18} />
              Open task URL
            </a>
            {task.instructions && <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">{task.instructions}</p>}
            <label className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-line bg-slate-50 px-5 py-6 text-center">
              <FileImage className="text-accent" size={28} />
              <span className="break-safe mt-3 max-w-full text-sm font-semibold text-ink">{proof ? proof.name : "Upload proof image or PDF"}</span>
              <span className="mt-1 text-xs text-slate-500">JPG, PNG, WEBP, or PDF up to 5 MB</span>
              <input disabled={task.status !== "CLAIMED" || submitting} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(event) => setProof(event.target.files?.[0] ?? null)} />
            </label>
            <button disabled={!canSubmit} onClick={submit} className="focus-ring mt-4 w-full rounded-lg bg-accent px-5 py-4 font-semibold text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-60">
              {submitting ? "Submitting..." : task.status === "CLAIMED" ? "Submit Proof and Mark Done" : "Already Submitted"}
            </button>
          </div>
        ) : (
          <p className="rounded-2xl border border-line bg-white p-6 text-slate-500 shadow-sm">No active claimed task.</p>
        )}
        {message && <p className="rounded-lg border border-line bg-slate-50 px-4 py-3 text-sm text-slate-600">{message}</p>}
      </div>
    </AppShell>
  );
}

function remainingTime(expiresAt: string | null, now: number) {
  if (!expiresAt) return "No expiry";
  const remaining = Math.max(0, new Date(expiresAt).getTime() - now);
  const seconds = Math.ceil(remaining / 1000);
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`;
}
