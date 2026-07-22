"use client";

import { useEffect } from "react";
import { PublicFrame } from "../../components/shell";
import { api } from "../../lib/api";
import { dashboardPathForUser } from "../../lib/auth-routing";

export default function DashboardRedirectPage() {
  useEffect(() => {
    api<{ user: { role: string; activationStatus: string } }>("/auth/me")
      .then((data) => {
        window.location.href = dashboardPathForUser(data.user);
      })
      .catch(() => {
        window.location.href = "/login";
      });
  }, []);

  return (
    <PublicFrame className="grid min-h-screen place-items-center px-5 py-24">
      <div className="rounded-2xl border border-line bg-white p-6 text-center shadow-glow">
        <h1 className="text-2xl font-semibold text-ink">Opening dashboard</h1>
        <p className="mt-2 text-slate-600">Checking your account role...</p>
      </div>
    </PublicFrame>
  );
}
