"use client";

import { useEffect, useState, useTransition } from "react";
import { CheckCircle2, LockKeyhole, Radar, ScanLine, UserRound, WalletCards } from "lucide-react";
import { api, getToken } from "../../lib/api";
import { dashboardPathForUser } from "../../lib/auth-routing";
import { PublicFrame } from "../../components/shell";

const roles = [
  {
    value: "CLIENT",
    label: "Client",
    description: "Post URL tasks and manage credits.",
    icon: WalletCards
  },
  {
    value: "SCANNER",
    label: "Scanner",
    description: "Grab tasks and earn rewards.",
    icon: ScanLine
  },
  {
    value: "ADMIN",
    label: "Admin",
    description: "Manage platform operations.",
    icon: LockKeyhole
  }
];

export default function SignupPage() {
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("CLIENT");
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
    startTransition(async () => {
      try {
        await api("/auth/signup", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(formData))
        });
        setMessage(role === "SCANNER" ? "Account created. Login now, then enter your SCN activation code." : "Account created. You can log in now.");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Signup failed");
      }
    });
  }
  return (
    <PublicFrame className="min-h-screen px-5 py-24">
      {checkingSession ? (
        <div className="mx-auto grid min-h-[60vh] max-w-md place-items-center">
          <div className="w-full rounded-2xl border border-line bg-white p-6 text-center shadow-glow">
            <h1 className="text-2xl font-semibold text-ink">Opening dashboard</h1>
            <p className="mt-2 text-sm text-slate-600">Checking your active session...</p>
          </div>
        </div>
      ) : (
      <section className="mx-auto grid max-w-6xl overflow-hidden rounded-[1.25rem] border border-line bg-white shadow-glow lg:grid-cols-[.92fr_1.08fr]">
        <div className="relative hidden min-h-[720px] overflow-hidden bg-ink p-10 text-white lg:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(15,191,159,.34),transparent_34%),linear-gradient(145deg,#10201d_0%,#15302b_48%,#0f1715_100%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">
                <Radar className="text-accent" size={24} />
              </div>
              <p className="mt-10 text-sm font-semibold uppercase tracking-[.22em] text-accent">Start with a role</p>
              <h1 className="mt-4 max-w-sm text-5xl font-semibold leading-tight">Create your Scan Krwalo account.</h1>
              <p className="mt-5 max-w-md text-base leading-7 text-white/72">Choose Client to post work, Scanner to activate with an SCN code after login, or Admin with the private setup secret.</p>
            </div>
            <div className="grid gap-4">
              {["Client accounts can post tasks immediately.", "Scanner accounts activate only after SCN code redemption.", "Admin signup is protected by your seed secret."].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-white/82">
                  <CheckCircle2 className="text-accent" size={18} />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <form action={submit} className="p-6 sm:p-8 lg:p-10">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Signup</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink">Set up your account</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Client is selected by default. Scanner accounts require an SCN code after login.</p>
          </div>

          <input type="hidden" name="role" value={role} />

          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            {roles.map((item) => {
              const Icon = item.icon;
              const active = role === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setRole(item.value)}
                  className={`focus-ring rounded-xl border p-4 text-left transition ${active ? "border-accent bg-emerald-50 shadow-sm" : "border-line bg-white hover:border-accent/60 hover:bg-slate-50"}`}
                  aria-pressed={active}
                >
                  <span className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${active ? "bg-accent text-white" : "bg-slate-100 text-slate-600"}`}>
                    <Icon size={19} />
                  </span>
                  <span className="block font-semibold text-ink">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="username" label="Username" placeholder="arbab_scan" icon={<UserRound size={17} />} />
            <Field name="email" label="Email" placeholder="you@example.com" type="email" />
            <Field name="password" label="Password" placeholder="Minimum 10 characters" type="password" />
            <Field name="confirmPassword" label="Confirm password" placeholder="Repeat password" type="password" />
            {role === "ADMIN" && (
              <div className="sm:col-span-2">
                <Field name="adminSecret" label="Admin secret" placeholder="ADMIN_SEED_PASSWORD" type="password" icon={<LockKeyhole size={17} />} />
              </div>
            )}
          </div>

          {message && (
            <p className={`mt-5 rounded-lg border px-4 py-3 text-sm ${message.startsWith("Account created") ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
              {message}
            </p>
          )}

          <button disabled={isPending} className="mt-6 w-full rounded-lg bg-accent px-5 py-4 font-semibold text-white shadow-glow transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70">
            {isPending ? "Creating account..." : "Create account"}
          </button>
          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account? <a href="/login" className="font-semibold text-accent hover:underline">Login</a>
          </p>
        </form>
      </section>
      )}
    </PublicFrame>
  );
}

function Field({ name, label, placeholder, type = "text", icon }: { name: string; label: string; placeholder: string; type?: string; icon?: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {label}
      <span className="relative">
        {icon && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
        <input
          className={`h-12 w-full rounded-lg border border-line bg-white px-4 shadow-sm transition placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-4 focus:ring-emerald-100 ${icon ? "pl-10" : ""}`}
          name={name}
          type={type}
          placeholder={placeholder}
          required
        />
      </span>
    </label>
  );
}
