"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, UserRound } from "lucide-react";
import { PublicFrame } from "../../components/shell";
import { api } from "../../lib/api";

type MeResponse = {
  user: {
    id: string;
    role: string;
    activationStatus: string;
    accountStatus: string;
  };
};

export default function ProfilePage() {
  const [data, setData] = useState<MeResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<MeResponse>("/auth/me")
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Please log in to view your profile."));
  }, []);

  const dashboardHref = data?.user.activationStatus !== "ACTIVE" ? "/activate" : data?.user.role === "SCANNER" ? "/scanner" : data?.user.role === "CLIENT" ? "/client" : data?.user.role === "ADMIN" ? "/admin" : "/activate";

  return (
    <PublicFrame className="min-h-screen px-5 py-24">
      <section className="mx-auto max-w-3xl rounded-2xl border border-line bg-white p-6 shadow-glow sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-accent">
            <UserRound size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Account</p>
            <h1 className="text-3xl font-semibold text-ink">Profile</h1>
          </div>
        </div>

        {error ? (
          <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            <p className="font-semibold">Login required</p>
            <p className="mt-2 text-sm">Your browser does not have an active session token.</p>
            <Link href="/login" className="mt-4 inline-flex rounded-lg bg-accent px-4 py-2 font-semibold text-white">Login</Link>
          </div>
        ) : data ? (
          <div className="mt-8 grid gap-4">
            <ProfileRow label="User ID" value={data.user.id} />
            <ProfileRow label="Role" value={data.user.role} />
            <ProfileRow label="Activation" value={data.user.activationStatus} />
            <ProfileRow label="Account status" value={data.user.accountStatus} />
            <div className="mt-2 flex flex-wrap gap-3">
              <Link href={dashboardHref} className="rounded-lg bg-accent px-5 py-3 font-semibold text-white">Open dashboard</Link>
              <Link href="/security" className="rounded-lg border border-line px-5 py-3 font-semibold text-ink">Security</Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 rounded-xl border border-line bg-slate-50 p-5 text-slate-600">Loading profile...</div>
        )}

        <div className="mt-8 flex items-start gap-3 rounded-xl border border-line bg-slate-50 p-4 text-sm text-slate-600">
          <ShieldCheck className="mt-0.5 text-accent" size={18} />
          Role and account status are verified by the API. Frontend navigation is only for convenience.
        </div>
      </section>
    </PublicFrame>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-xl border border-line bg-slate-50 p-4 sm:grid-cols-[180px_1fr] sm:items-center">
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <span className="break-all font-semibold text-ink">{value}</span>
    </div>
  );
}
