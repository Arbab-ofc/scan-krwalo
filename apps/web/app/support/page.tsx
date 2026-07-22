"use client";

import { useEffect, useState } from "react";
import { Headphones, MessageCircle, WalletCards } from "lucide-react";
import { PublicFrame } from "../../components/shell";

type PublicSettings = {
  telegramContactEnabled: boolean;
  telegramUsername: string;
  telegramContactUrl: string | null;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function SupportPage() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/settings/public`, { cache: "no-store" })
      .then((response) => response.json())
      .then((payload) => setSettings(payload.data))
      .catch(() => setSettings(null));
  }, []);

  return (
    <PublicFrame className="min-h-screen px-5 py-24">
      <section className="mx-auto max-w-4xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Support</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-ink">Get help with codes, credits, and payouts.</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Contact the platform admin for activation codes, client credits, scanner payout details, and payment questions.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <SupportItem icon={<MessageCircle size={21} />} title="Activation codes" text="Ask for SCN or CLI codes and account activation help." />
          <SupportItem icon={<WalletCards size={21} />} title="Payments" text="Get scanner payout and client credit payment support." />
          <SupportItem icon={<Headphones size={21} />} title="Account help" text="Resolve access, role, or dashboard issues." />
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-white p-6 shadow-glow">
          <h2 className="text-xl font-semibold text-ink">Admin contact</h2>
          {settings?.telegramContactEnabled && settings.telegramContactUrl ? (
            <>
              <p className="mt-2 text-slate-600">Telegram: @{settings.telegramUsername}</p>
              <a href={settings.telegramContactUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex rounded-lg bg-accent px-5 py-3 font-semibold text-white">
                Contact Admin on Telegram
              </a>
            </>
          ) : (
            <p className="mt-2 text-slate-600">Telegram contact is not configured yet. Ask an admin to enable it in settings.</p>
          )}
        </div>
      </section>
    </PublicFrame>
  );
}

function SupportItem({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-accent">{icon}</div>
      <h2 className="font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}
