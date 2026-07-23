"use client";

import { useEffect, useState } from "react";
import { RadioTower, Save } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { api } from "../../../lib/api";
import { minorUnitsToDisplay } from "../../../lib/money";

type Settings = {
  defaultScannerReward: string;
  rewardCurrency: string;
  minimumPayoutAmount: string;
  telegramUsername: string;
  telegramBotUsername: string;
  telegramBotToken: "";
  telegramBotTokenConfigured: boolean;
  telegramWebhookSecret: string;
};

type TelegramWebhookInfo = {
  configured: boolean;
  url: string;
  pendingUpdateCount: number;
  lastErrorDate: string | null;
  lastErrorMessage: string | null;
  allowedUpdates: string[];
  recentEvents: Array<{ action: string; createdAt: string; metadata: unknown }>;
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [reward, setReward] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [telegramBotUsername, setTelegramBotUsername] = useState("");
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramWebhookSecret, setTelegramWebhookSecret] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [installingWebhook, setInstallingWebhook] = useState(false);
  const [checkingWebhook, setCheckingWebhook] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<TelegramWebhookInfo | null>(null);

  function settingsPayload() {
    const payload: Record<string, string> = {
      defaultScannerReward: reward,
      rewardCurrency: "USDT",
      telegramUsername,
      telegramBotUsername,
      telegramWebhookSecret
    };
    if (telegramBotToken.trim()) payload.telegramBotToken = telegramBotToken.trim();
    return payload;
  }

  useEffect(() => {
    api<Settings>("/admin/settings")
      .then((data) => {
        setSettings(data);
        setReward(minorUnitsToDisplay(data.defaultScannerReward));
        setTelegramUsername(data.telegramUsername ?? "");
        setTelegramBotUsername(data.telegramBotUsername ?? "");
        setTelegramWebhookSecret(data.telegramWebhookSecret ?? "");
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
        body: JSON.stringify(settingsPayload())
      });
      setSettings(updated);
      setReward(minorUnitsToDisplay(updated.defaultScannerReward));
      setTelegramUsername(updated.telegramUsername ?? "");
      setTelegramBotUsername(updated.telegramBotUsername ?? "");
      setTelegramBotToken("");
      setTelegramWebhookSecret(updated.telegramWebhookSecret ?? "");
      setMessage("Settings updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  async function installWebhook() {
    setInstallingWebhook(true);
    setMessage("");
    try {
      const result = await api<{ webhookUrl: string }>("/admin/telegram/webhook", {
        method: "POST",
        body: JSON.stringify(settingsPayload())
      });
      const info = await api<TelegramWebhookInfo>("/admin/telegram/webhook");
      const updated = await api<Settings>("/admin/settings");
      setWebhookInfo(info);
      setSettings(updated);
      setReward(minorUnitsToDisplay(updated.defaultScannerReward));
      setTelegramUsername(updated.telegramUsername ?? "");
      setTelegramBotUsername(updated.telegramBotUsername ?? "");
      setTelegramBotToken("");
      setTelegramWebhookSecret(updated.telegramWebhookSecret ?? "");
      setMessage(`Telegram webhook installed: ${result.webhookUrl}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not install Telegram webhook.");
    } finally {
      setInstallingWebhook(false);
    }
  }

  async function checkWebhook() {
    setCheckingWebhook(true);
    setMessage("");
    try {
      setWebhookInfo(await api<TelegramWebhookInfo>("/admin/telegram/webhook"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not check Telegram webhook.");
    } finally {
      setCheckingWebhook(false);
    }
  }

  return (
    <AppShell role="admin">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Platform settings</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Rewards, contact, and Telegram bot</h1>
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
            Support Telegram username
            <input
              value={telegramUsername}
              onChange={(event) => setTelegramUsername(event.target.value)}
              className="rounded-md border border-line bg-white px-4 py-3 font-normal"
              placeholder="ScanKrwaloAdmin"
            />
          </label>
          <div className="mt-2 rounded-xl border border-line bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-white p-2 text-accent"><RadioTower size={19} /></span>
              <div>
                <h2 className="font-semibold text-ink">Scanner Telegram bot alerts</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">Save bot credentials here or provide them through environment variables. The token is never returned by the API.</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-ink">
                Bot username
                <input
                  value={telegramBotUsername}
                  onChange={(event) => setTelegramBotUsername(event.target.value)}
                  className="rounded-md border border-line bg-white px-4 py-3 font-normal"
                  placeholder="YourBotUsername"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                Bot token {settings?.telegramBotTokenConfigured ? "(configured)" : ""}
                <input
                  value={telegramBotToken}
                  onChange={(event) => setTelegramBotToken(event.target.value)}
                  className="rounded-md border border-line bg-white px-4 py-3 font-normal"
                  placeholder={settings?.telegramBotTokenConfigured ? "Enter only to replace existing token" : "123456789:AA..."}
                  type="password"
                  autoComplete="off"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-ink">
                Webhook secret
                <input
                  value={telegramWebhookSecret}
                  onChange={(event) => setTelegramWebhookSecret(event.target.value)}
                  className="rounded-md border border-line bg-white px-4 py-3 font-normal"
                  placeholder="optional-random-secret"
                  type="password"
                  autoComplete="off"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={installWebhook} disabled={installingWebhook} className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-white px-5 py-3 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-70">
                  <RadioTower size={18} />
                  {installingWebhook ? "Installing..." : "Install Telegram webhook"}
                </button>
                <button type="button" onClick={checkWebhook} disabled={checkingWebhook} className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-white px-5 py-3 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-70">
                  <RadioTower size={18} />
                  {checkingWebhook ? "Checking..." : "Check webhook"}
                </button>
              </div>
              {webhookInfo && (
                <div className="rounded-lg border border-line bg-white p-3 text-xs text-slate-600">
                  <p className="font-semibold text-ink">{webhookInfo.configured ? "Webhook configured" : "Webhook not configured"}</p>
                  <p className="mt-2 break-safe">URL: {webhookInfo.url || "none"}</p>
                  <p className="mt-1">Pending updates: {webhookInfo.pendingUpdateCount}</p>
                  <p className="mt-1 break-safe">Last error: {webhookInfo.lastErrorMessage || "none"}</p>
                  {webhookInfo.recentEvents.length > 0 && (
                    <div className="mt-3 grid gap-1">
                      <p className="font-semibold text-ink">Recent webhook events</p>
                      {webhookInfo.recentEvents.slice(0, 5).map((event) => (
                        <p key={`${event.action}-${event.createdAt}`} className="break-safe">
                          {new Date(event.createdAt).toLocaleString()} - {event.action.replace("TELEGRAM_WEBHOOK_", "").toLowerCase()}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
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
