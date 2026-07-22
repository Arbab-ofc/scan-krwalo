"use client";

import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { api } from "../../../lib/api";
import { minorUnitsToDisplay } from "../../../lib/money";

type Settings = {
  defaultScannerReward: string;
  rewardCurrency: string;
  minimumPayoutAmount: string;
  telegramUsername: string;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [reward, setReward] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Settings>("/admin/settings")
      .then((data) => {
        setSettings(data);
        setReward(minorUnitsToDisplay(data.defaultScannerReward));
        setTelegramUsername(data.telegramUsername ?? "");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load settings."));
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const updated = await api<Settings>("/admin/settings", {
        method: "PATCH",
        body: JSON.stringify({
          defaultScannerReward: reward,
          rewardCurrency: "USDT",
          telegramUsername
        })
      });
      setSettings(updated);
      setReward(minorUnitsToDisplay(updated.defaultScannerReward));
      setTelegramUsername(updated.telegramUsername ?? "");
      setMessage("Settings updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell role="admin">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Platform settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Rewards and contact</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Scanner reward is stored in minor units and snapshotted onto every new task. Existing task rewards do not change.
        </p>

        <form onSubmit={submit} className="mt-6 grid max-w-xl gap-4">
          <label className="grid gap-2 text-sm font-semibold text-ink">
            Default scanner reward ({settings?.rewardCurrency ?? "USDT"})
            <input
              value={reward}
              onChange={(event) => setReward(event.target.value)}
              className="rounded-md border border-line bg-white px-4 py-3 font-normal"
              placeholder="0.20"
              inputMode="decimal"
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-ink">
            Telegram username
            <input
              value={telegramUsername}
              onChange={(event) => setTelegramUsername(event.target.value)}
              className="rounded-md border border-line bg-white px-4 py-3 font-normal"
              placeholder="ScanKrwaloAdmin"
            />
          </label>
          <button disabled={saving} className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70">
            <Save size={18} />
            {saving ? "Saving..." : "Save settings"}
          </button>
        </form>
        {message && <p className="mt-4 rounded-lg border border-line bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>}
      </section>
    </AppShell>
  );
}
