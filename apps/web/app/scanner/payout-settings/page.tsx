"use client";

import { useEffect, useState, useTransition } from "react";
import { BadgeCheck, Landmark, ShieldCheck, Wallet } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { api } from "../../../lib/api";

type ScannerDashboard = {
  scanner: {
    binanceId: string | null;
    usdtBep20Address: string | null;
    preferredPayoutMethod: "BINANCE_ID" | "USDT_BEP20" | null;
  } | null;
};

export default function ScannerPayoutSettingsPage() {
  const [data, setData] = useState<ScannerDashboard | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    api<ScannerDashboard>("/scanner/dashboard").then(setData).catch((error) => {
      setMessage(error instanceof Error ? error.message : "Could not load payout settings.");
    });
  }, []);

  function submit(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      try {
        const updated = await api<ScannerDashboard["scanner"]>("/scanner/profile", {
          method: "PATCH",
          body: JSON.stringify({
            binanceId: formData.get("binanceId"),
            usdtBep20Address: formData.get("usdtBep20Address"),
            preferredPayoutMethod: formData.get("preferredPayoutMethod")
          })
        });
        setData((current) => ({ scanner: updated ?? current?.scanner ?? null }));
        setMessage("Payout settings saved.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not save payout settings.");
      }
    });
  }

  const method = data?.scanner?.preferredPayoutMethod ?? "BINANCE_ID";

  return (
    <AppShell role="scanner">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-3xl border border-line bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-accent">
              <Wallet size={23} />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Payout profile</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Payment destination</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Save the destination admin should use when processing your payout request. New payout requests keep a snapshot of these details.
              </p>
            </div>
          </div>

          <form action={submit} className="mt-8 grid gap-5">
            <div className="grid gap-5 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Binance ID
                <span className="relative">
                  <Landmark className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    name="binanceId"
                    defaultValue={data?.scanner?.binanceId ?? ""}
                    className="h-12 w-full rounded-xl border border-line bg-white px-4 pl-11 shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-emerald-100"
                    placeholder="your_binance_id"
                  />
                </span>
              </label>

              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Preferred method
                <select
                  name="preferredPayoutMethod"
                  defaultValue={method}
                  className="h-12 rounded-xl border border-line bg-white px-4 shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-emerald-100"
                >
                  <option value="BINANCE_ID">Binance ID</option>
                  <option value="USDT_BEP20">USDT BEP20</option>
                </select>
              </label>
            </div>

            <label className="grid gap-2 text-sm font-medium text-slate-700">
              USDT BEP20 address
              <span className="relative">
                <Wallet className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  name="usdtBep20Address"
                  defaultValue={data?.scanner?.usdtBep20Address ?? ""}
                  className="h-12 w-full rounded-xl border border-line bg-white px-4 pl-11 font-mono text-sm shadow-sm outline-none transition focus:border-accent focus:ring-4 focus:ring-emerald-100"
                  placeholder="0x0000000000000000000000000000000000000000"
                />
              </span>
            </label>

            <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">Confirm the address carefully before saving.</p>
              <button disabled={isPending} className="focus-ring inline-flex min-h-12 items-center justify-center rounded-xl bg-accent px-6 font-semibold text-white shadow-glow disabled:cursor-not-allowed disabled:opacity-70">
                {isPending ? "Saving..." : "Save settings"}
              </button>
            </div>
          </form>

          {message && <p className="mt-5 rounded-xl border border-line bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>}
        </section>

        <aside className="rounded-3xl border border-line bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-ink">Current setup</h2>
          <div className="mt-5 grid gap-3">
            <StatusRow icon={<BadgeCheck size={17} />} label="Method" value={method.replace("_", " ")} />
            <StatusRow icon={<Landmark size={17} />} label="Binance ID" value={data?.scanner?.binanceId || "Not set"} />
            <StatusRow icon={<ShieldCheck size={17} />} label="BEP20" value={data?.scanner?.usdtBep20Address ? shortAddress(data.scanner.usdtBep20Address) : "Not set"} />
          </div>
          <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            Payout requests use this information at the time of request. Updating it later will not change older payout history.
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function StatusRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
        <span className="text-accent">{icon}</span>
        {label}
      </div>
      <span className="max-w-[170px] truncate text-right text-sm font-semibold text-ink">{value}</span>
    </div>
  );
}

function shortAddress(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}
