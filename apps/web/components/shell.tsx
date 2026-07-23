"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell, Menu, Radar, WalletCards, X } from "lucide-react";
import { AuthNav, SidebarLogoutButton } from "./auth-nav";
import { api } from "../lib/api";
import { getLiveSocket } from "../lib/live";
import { LanguageSwitcher, useLocale } from "../lib/i18n";

export function PublicNav() {
  const [open, setOpen] = useState(false);
  const { t } = useLocale();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="text-lg font-semibold tracking-wide text-ink">Scan Krwalo</Link>
        <div className="hidden items-center gap-2 text-sm text-slate-600 md:flex">
          <Link className="hidden rounded px-3 py-2 hover:text-ink sm:block" href="/how-it-works">{t("nav.howItWorks")}</Link>
          <Link className="hidden rounded px-3 py-2 hover:text-ink sm:block" href="/api-docs">{t("nav.apiDocs")}</Link>
          <LanguageSwitcher />
          <AuthNav />
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-ink md:hidden"
          aria-label="Open menu"
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>
      {open && (
        <div className="border-t border-line bg-white px-5 py-4 shadow-sm md:hidden">
          <div className="mx-auto grid max-w-6xl gap-2 text-sm">
            <Link onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 font-medium text-slate-600 hover:bg-emerald-50 hover:text-ink" href="/how-it-works">{t("nav.howItWorks")}</Link>
            <Link onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 font-medium text-slate-600 hover:bg-emerald-50 hover:text-ink" href="/api-docs">{t("nav.apiDocs")}</Link>
            <Link onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 font-medium text-slate-600 hover:bg-emerald-50 hover:text-ink" href="/support">{t("nav.support")}</Link>
            <LanguageSwitcher />
            <div className="border-t border-line pt-3"><AuthNav /></div>
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const { t } = useLocale();
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-[1.2fr_.8fr_.8fr]">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold text-ink">
            <Radar className="text-accent" size={20} />
            Scan Krwalo
          </div>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600">
            {t("footer.description")}
          </p>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">{t("footer.platform")}</h2>
          <div className="mt-3 grid gap-2 text-sm text-slate-600">
            <Link href="/how-it-works" className="hover:text-ink">{t("nav.howItWorks")}</Link>
            <Link href="/api-docs" className="hover:text-ink">{t("nav.apiDocs")}</Link>
            <Link href="/signup" className="hover:text-ink">{t("footer.createAccount")}</Link>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-ink">{t("footer.legal")}</h2>
          <div className="mt-3 grid gap-2 text-sm text-slate-600">
            <Link href="/terms" className="hover:text-ink">{t("footer.terms")}</Link>
            <Link href="/privacy" className="hover:text-ink">{t("footer.privacy")}</Link>
            <Link href="/support" className="hover:text-ink">{t("nav.support")}</Link>
          </div>
        </div>
      </div>
      <div className="border-t border-line px-5 py-4 text-center text-xs text-slate-500">
        (c) {new Date().getFullYear()} Scan Krwalo. All rights reserved.
      </div>
    </footer>
  );
}

export function PublicFrame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="min-h-screen bg-surface text-ink">
      <PublicNav />
      <main className={className}>{children}</main>
      <PublicFooter />
    </div>
  );
}

export function AppShell({ children, role }: { children: React.ReactNode; role: "scanner" | "client" | "admin" | "user" }) {
  const [open, setOpen] = useState(false);
  const { t } = useLocale();
  const links: Array<[string, string]> = role === "scanner"
    ? [["/scanner", t("nav.overview")], ["/scanner/live-tasks", t("nav.live")], ["/scanner/current-task", t("nav.current")], ["/scanner/history", t("nav.history")], ["/scanner/payouts", t("nav.payouts")], ["/scanner/payout-settings", t("nav.settings")]]
    : role === "client"
      ? [["/client", t("nav.overview")], ["/client/post-task", t("nav.post")], ["/client/tasks", t("nav.tasks")], ["/client/credits", t("nav.credits")]]
      : role === "admin"
        ? [["/admin", t("nav.overview")], ["/admin/users", t("nav.users")], ["/admin/tasks", t("nav.tasks")], ["/admin/reports", t("nav.reports")], ["/admin/activation-codes", t("nav.codes")], ["/admin/payouts", t("nav.payouts")], ["/admin/settings", t("nav.settings")]]
        : [["/activate", t("nav.activate")], ["/profile", t("nav.profile")], ["/support", t("nav.support")]];
  return (
    <div className="min-h-screen bg-surface text-ink">
      <ScannerPresenceHeartbeat role={role} />
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-white/95 px-4 backdrop-blur xl:hidden sm:px-5">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2 text-base font-semibold text-ink sm:text-lg"><Radar className="shrink-0 text-accent" size={20} /> <span className="truncate">Scan Krwalo</span></Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-ink"
          aria-label="Open menu"
          aria-expanded={open}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {open && <button aria-label="Close menu overlay" className="fixed inset-0 z-30 bg-slate-950/30 xl:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[min(20rem,calc(100vw-2rem))] flex-col border-r border-line bg-white px-5 py-6 shadow-2xl transition-transform duration-200 xl:w-72 xl:translate-x-0 xl:shadow-none ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <Link href="/dashboard" className="mb-8 hidden items-center gap-3 text-xl font-semibold md:flex"><Radar className="text-accent" /> Scan Krwalo</Link>
        <div className="mb-6 flex items-center justify-between xl:hidden">
          <Link href="/dashboard" onClick={() => setOpen(false)} className="flex items-center gap-2 text-xl font-semibold"><Radar className="text-accent" /> Scan Krwalo</Link>
          <button type="button" onClick={() => setOpen(false)} className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-lg border border-line">
            <X size={18} />
          </button>
        </div>
        <nav className="grid min-h-0 gap-1 overflow-y-auto pb-3">
          {links.map(([href, label]) => (
            <Link onClick={() => setOpen(false)} key={href} href={href} className="focus-ring block rounded-md px-3 py-3 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-ink">{label}</Link>
          ))}
          <Link onClick={() => setOpen(false)} href="/notifications" className="focus-ring block rounded-md px-3 py-3 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-ink"><Bell className="mr-2 inline" size={16} /> <span>{t("nav.notifications")}</span></Link>
          <div className="mt-2 border-t border-line pt-3"><LanguageSwitcher /></div>
          <SidebarLogoutButton />
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-4 pb-8 pt-5 sm:px-5 sm:pb-10 sm:pt-6 xl:ml-72 xl:max-w-[calc(100vw-18rem)] xl:px-8 2xl:max-w-6xl">{children}</main>
    </div>
  );
}

function ScannerPresenceHeartbeat({ role }: { role: "scanner" | "client" | "admin" | "user" }) {
  useEffect(() => {
    if (role !== "scanner") return;
    let cancelled = false;

    async function heartbeat() {
      try {
        const status = await api<{ isOnline: boolean }>("/scanner/presence/status");
        if (!cancelled && status.isOnline) {
          getLiveSocket()?.emit("presence:heartbeat");
        }
      } catch {
        // Auth state changes are handled by the API helper and route guards.
      }
    }

    void heartbeat();
    const interval = window.setInterval(() => void heartbeat(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [role]);

  return null;
}

export function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return <div className="min-w-0 rounded-xl border border-line bg-panel p-4 shadow-sm"><div className="mb-3 flex items-center justify-between gap-3 text-sm text-slate-500"><span className="break-safe">{label}</span><span className="shrink-0">{icon ?? <WalletCards size={16} />}</span></div><div className="break-safe text-xl font-semibold text-ink sm:text-2xl">{value}</div></div>;
}

export function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="focus-ring inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-5 py-3 font-semibold text-white shadow-glow sm:w-auto">{children}</Link>;
}
