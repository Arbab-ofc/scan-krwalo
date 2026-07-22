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
      <div className="flex flex-col gap-6">
        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Credits</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Credits and redeem code</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">Redeem new CLI codes here. Posting a valid task reserves one credit; expired unclaimed tasks return that credit automatically.</p>
        </section>

        <div className="grid gap-4 sm:grid-cols-4">
          <Stat label="Available" value={data?.availableCredits ?? 0} />
          <Stat label="Reserved" value={data?.reservedCredits ?? 0} />
          <Stat label="Used" value={data?.usedCredits ?? 0} />
          <Stat label="Total added" value={data?.totalAddedCredits ?? 0} />
        </div>

        <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 p-3 text-accent"><CreditCard size={22} /></div>
            <div>
              <h2 className="text-xl font-semibold text-ink">Redeem Client Code</h2>
              <p className="text-sm text-slate-500">Enter a 12-character CLI code from Admin.</p>
            </div>
          </div>
          <form action={redeem} className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input name="code" required maxLength={12} className="h-12 flex-1 rounded-xl border border-line bg-white px-4 font-mono text-sm uppercase tracking-wider shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-emerald-100" placeholder="CLI123456789" />
            <button disabled={redeeming} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-semibold text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-60">
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
