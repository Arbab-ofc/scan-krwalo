"use client";
import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, PlusCircle } from "lucide-react";
import { AppShell, Stat } from "../../../components/shell";
import { api } from "../../../lib/api";
import { useLiveRefresh } from "../../../lib/live";

export default function CreditsPage() {
  const [data, setData] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const loadCredits = useCallback(async () => {
    setData(await api("/client/credits"));
  }, []);

  useLiveRefresh(loadCredits, ["credits:updated", "task:expired", "task:confirmed"]);

  useEffect(() => {
    loadCredits().catch(console.error);
  }, [loadCredits]);

  async function redeem(formData: FormData) {
    if (redeeming) return;
    setRedeeming(true);
    setMessage("");
    try {
      await api("/activation/redeem", { method: "POST", body: JSON.stringify({ code: String(formData.get("code") ?? "") }) });
      setMessage("Client code redeemed. Credits added to your account.");
      await loadCredits();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not redeem code.");
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <AppShell role="client">
      <div className="app-page">
        <section className="app-card">
          <p className="app-eyebrow">Credits</p>
          <h1 className="app-title">Credits and redeem code</h1>
          <p className="app-copy">Redeem new CLI codes here. Posting a valid task reserves one credit; expired unclaimed tasks return that credit automatically.</p>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Available" value={data?.availableCredits ?? 0} />
          <Stat label="Reserved" value={data?.reservedCredits ?? 0} />
          <Stat label="Used" value={data?.usedCredits ?? 0} />
          <Stat label="Total added" value={data?.totalAddedCredits ?? 0} />
        </div>

        <section className="app-card">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-xl bg-emerald-50 p-3 text-accent"><CreditCard size={22} /></div>
            <div className="min-w-0">
              <h2 className="app-section-title">Redeem Client Code</h2>
              <p className="text-sm text-slate-500">Enter a 12-character CLI code from Admin.</p>
            </div>
          </div>
          <form action={redeem} className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
            <input name="code" required maxLength={12} className="app-input font-mono uppercase tracking-wider" placeholder="CLI123456789" />
            <button disabled={redeeming} className="app-button rounded-xl bg-accent px-5 py-3 text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-60">
              {redeeming ? <Loader2 className="animate-spin" size={18} /> : <PlusCircle size={18} />}
              {redeeming ? "Redeeming..." : "Add credits"}
            </button>
          </form>
          {message && <p className="mt-4 rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>}
        </section>
      </div>
    </AppShell>
  );
}
