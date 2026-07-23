"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LayoutDashboard, LogIn, LogOut } from "lucide-react";
import { api, getToken, logoutUser } from "../lib/api";
import { useLocale } from "../lib/i18n";

type User = {
  id: string;
  role: string;
  activationStatus: string;
  accountStatus: string;
};

export function AuthNav() {
  const { t } = useLocale();
  const [user, setUser] = useState<User | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!getToken()) {
        if (active) {
          setUser(null);
          setChecked(true);
        }
        return;
      }
      try {
        const data = await api<{ user: User }>("/auth/me");
        if (active) setUser(data.user);
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setChecked(true);
      }
    }
    load();
    window.addEventListener("scan-krwalo:auth-changed", load);
    window.addEventListener("storage", load);
    return () => {
      active = false;
      window.removeEventListener("scan-krwalo:auth-changed", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  async function handleLogout() {
    await logoutUser();
    window.location.href = "/";
  }

  if (!checked) {
    return <div className="h-10 w-24 rounded-md bg-slate-100" aria-hidden="true" />;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link className="hidden rounded px-3 py-2 font-medium text-slate-600 hover:text-ink sm:block" href="/signup">{t("nav.signup")}</Link>
        <Link className="focus-ring flex items-center gap-2 rounded-md bg-accent px-4 py-2 font-medium text-white shadow-glow" href="/login"><LogIn size={16} /> {t("nav.login")}</Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link className="focus-ring hidden items-center gap-2 rounded-md border border-line bg-white px-4 py-2 font-medium text-ink shadow-sm sm:flex" href="/dashboard"><LayoutDashboard size={16} /> {t("nav.dashboard")}</Link>
      <button type="button" onClick={handleLogout} className="focus-ring flex items-center gap-2 rounded-md bg-ink px-4 py-2 font-medium text-white">
        <LogOut size={16} /> {t("nav.logout")}
      </button>
    </div>
  );
}

export function SidebarLogoutButton() {
  const { t } = useLocale();
  async function handleLogout() {
    await logoutUser();
    window.location.href = "/";
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="focus-ring block w-full rounded-md px-3 py-3 text-left text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-700"
    >
      {t("nav.logout")}
    </button>
  );
}
