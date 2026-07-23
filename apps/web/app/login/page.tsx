"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { ArrowRight, LockKeyhole, Mail, Radar, ShieldCheck, Sparkles, UserPlus } from "lucide-react";
import { api, getToken, storeAuthTokens } from "../../lib/api";
import { dashboardPathForUser } from "../../lib/auth-routing";
import { PublicFrame } from "../../components/shell";
import { useLocale } from "../../lib/i18n";

type LoginResult = {
  accessToken: string;
  refreshToken: string;
  user: { role: string; activationStatus: string };
};

export default function LoginPage() {
  const { t } = useLocale();
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!getToken()) {
      setCheckingSession(false);
      return;
    }
    api<{ user: { role: string; activationStatus: string } }>("/auth/me")
      .then((data) => {
        window.location.replace(dashboardPathForUser(data.user));
      })
      .catch(() => setCheckingSession(false));
  }, []);

  function submit(formData: FormData) {
    setError("");
    startTransition(async () => {
      try {
        const result = await api<LoginResult>("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            identifier: formData.get("identifier"),
            password: formData.get("password")
          })
        });

        storeAuthTokens(result.accessToken, result.refreshToken);
        location.href = dashboardPathForUser(result.user);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Login failed");
      }
    });
  }

  return (
    <PublicFrame className="px-5 py-10 sm:py-14 lg:py-16">
      {checkingSession ? (
        <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center">
          <div className="w-full rounded-2xl border border-line bg-white p-6 text-center shadow-glow">
            <h1 className="text-2xl font-semibold text-ink">{t("login.opening")}</h1>
            <p className="mt-2 text-sm text-slate-600">{t("login.checking")}</p>
          </div>
        </div>
      ) : (
      <section className="mx-auto grid max-w-6xl overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_80px_rgba(15,23,42,.10)] lg:grid-cols-[1.03fr_.97fr]">
        <div className="relative min-h-[560px] overflow-hidden bg-[#f6fbf9] p-6 sm:p-8 lg:p-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(20,184,166,.18),transparent_32%),radial-gradient(circle_at_86%_72%,rgba(59,130,246,.13),transparent_28%)]" />
          <div className="relative flex min-h-[500px] flex-col justify-between">
            <div>
              <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white shadow-glow">
                  <Radar size={20} />
                </span>
                Scan Krwalo
              </Link>

              <div className="mt-16 max-w-xl">
                <p className="text-sm font-semibold uppercase tracking-[.2em] text-accent">{t("login.secureAccess")}</p>
                <h1 className="mt-4 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
                  {t("login.heroTitle")}
                </h1>
                <p className="mt-5 max-w-lg text-base leading-7 text-slate-600">
                  {t("login.heroCopy")}
                </p>
              </div>
            </div>

            <div className="mt-12 grid gap-3 sm:grid-cols-3">
              <Feature icon={<ShieldCheck size={18} />} label="JWT sessions" />
              <Feature icon={<Sparkles size={18} />} label="Live tasks" />
              <Feature icon={<UserPlus size={18} />} label="Role dashboards" />
            </div>
          </div>
        </div>

        <div className="flex items-center p-6 sm:p-8 lg:p-12">
          <form action={submit} className="w-full">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">{t("login.welcome")}</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">{t("login.title")}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {t("login.copy")}
              </p>
            </div>

            <div className="grid gap-4">
              <Field
                name="identifier"
                label={t("login.identifier")}
                placeholder="you@example.com"
                icon={<Mail size={17} />}
              />
              <Field
                name="password"
                label={t("login.password")}
                placeholder={t("login.enterPassword")}
                type="password"
                icon={<LockKeyhole size={17} />}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" className="h-4 w-4 rounded border-line text-accent focus:ring-accent" />
                {t("login.remember")}
              </label>
              <Link href="/support" className="font-semibold text-accent hover:underline">
                {t("login.needHelp")}
              </Link>
            </div>

            {error && (
              <p className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              disabled={isPending}
              className="focus-ring mt-6 inline-flex h-13 w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-4 font-semibold text-white shadow-glow transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isPending ? t("login.signingIn") : t("login.button")}
              <ArrowRight size={18} />
            </button>

            <p className="mt-5 text-center text-sm text-slate-500">
              {t("login.newUser")} {" "}
              <Link href="/signup" className="font-semibold text-accent hover:underline">
                {t("login.createAccount")}
              </Link>
            </p>
          </form>
        </div>
      </section>
      )}
    </PublicFrame>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = "text",
  icon
}: {
  name: string;
  label: string;
  placeholder: string;
  type?: string;
  icon: React.ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      <span className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>
        <input
          className="h-12 w-full rounded-lg border border-line bg-white px-4 pl-10 shadow-sm transition placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-4 focus:ring-emerald-100"
          name={name}
          type={type}
          placeholder={placeholder}
          required
        />
      </span>
    </label>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white bg-white/80 px-3 py-3 text-sm font-medium text-slate-700 shadow-sm">
      <span className="text-accent">{icon}</span>
      {label}
    </div>
  );
}
