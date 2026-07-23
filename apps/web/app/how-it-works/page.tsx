import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Gauge,
  LockKeyhole,
  RadioTower,
  ScanLine,
  ShieldCheck,
  Timer,
  WalletCards,
  Zap,
  type LucideIcon
} from "lucide-react";
import { PublicFrame } from "../../components/shell";

const flow: Array<[string, string, string, LucideIcon]> = [
  ["01", "Client posts", "A credit is reserved only after the URL passes validation.", ClipboardList],
  ["02", "Scanners receive", "Online active scanners see the task and get realtime alerts.", RadioTower],
  ["03", "First claim wins", "One database transaction assigns the task to one scanner.", Zap],
  ["04", "Proof is uploaded", "The scanner submits evidence before the completion timer ends.", FileCheck2],
  ["05", "Issue window closes", "The scanner is paid automatically after 5 minutes unless the client raises an issue.", WalletCards]
];

const roles: Array<[string, string, string, LucideIcon]> = [
  ["Client", "Redeem CLI credits, post single or multiple URL tasks, and review submitted proof.", "Posts work", ClipboardList],
  ["Scanner", "Redeem an SCN code, go online, grab one available task, then submit proof.", "Earns reward", ScanLine],
  ["Admin", "Creates activation codes, manages users, reviews tasks, and processes payouts.", "Controls ops", LockKeyhole]
];

const guarantees: Array<[string, string, LucideIcon]> = [
  ["Activation gate", "Public signup does not grant scanner/client power until the right code is redeemed.", BadgeCheck],
  ["Server timers", "Claim, completion, and review windows are calculated by the backend.", Timer],
  ["Atomic claims", "The first successful scanner claim wins; duplicate grabs are rejected.", ShieldCheck],
  ["Tracked settlement", "Credits, scanner rewards, and payouts are recorded in ledgers.", Gauge]
];

export default function HowItWorksPage() {
  return (
    <PublicFrame>
      <section className="relative overflow-hidden bg-[#fbfcfb]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#dbe5e2_1px,transparent_1px),linear-gradient(to_bottom,#dbe5e2_1px,transparent_1px)] bg-[size:42px_42px] opacity-55" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-surface to-transparent" />
        <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.2em] text-accent">How it works</p>
            <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-[.95] tracking-tight text-ink sm:text-6xl lg:text-7xl">
              From URL to verified payout.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Scan Krwalo routes client URL tasks to active scanners, enforces timed claiming, collects proof, and settles credits through auditable ledgers.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 bg-ink px-6 font-semibold text-white shadow-xl shadow-slate-950/10 transition hover:-translate-y-0.5">
                Start account
                <ArrowRight size={18} />
              </Link>
              <Link href="/api-docs" className="focus-ring inline-flex min-h-12 items-center justify-center border border-line bg-white px-6 font-semibold text-ink shadow-sm transition hover:-translate-y-0.5">
                View API docs
              </Link>
            </div>
          </div>

          <div className="border border-line bg-white shadow-2xl shadow-slate-950/10">
            <div className="grid grid-cols-[76px_1fr] border-b border-line sm:grid-cols-[96px_1fr]">
              <div className="grid place-items-center border-r border-line bg-ink py-5 text-xs font-semibold uppercase tracking-[.18em] text-white [writing-mode:vertical-rl] sm:text-sm">
                Workflow
              </div>
              <div className="p-5 sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Operational path</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">One task, one claim, one settlement</p>
              </div>
            </div>
            <div className="divide-y divide-line">
              {flow.map(([step, title, copy, Icon]) => (
                <div key={step} className="grid grid-cols-[44px_1fr] gap-4 p-5 sm:grid-cols-[56px_1fr_auto] sm:items-center sm:p-6">
                  <span className="font-mono text-sm font-semibold text-accent">{step}</span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-ink">{title}</h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{copy}</p>
                  </div>
                  <span className="hidden h-11 w-11 place-items-center bg-slate-50 text-accent sm:grid">
                    <Icon size={21} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface px-5 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Role paths</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">Each role has one clear lane.</h2>
          </div>
          <div className="mt-10 grid border border-line bg-white lg:grid-cols-3">
            {roles.map(([role, copy, tag, Icon], index) => (
              <div key={role} className={`p-6 sm:p-8 ${index !== roles.length - 1 ? "border-b border-line lg:border-b-0 lg:border-r" : ""}`}>
                <div className="flex items-center justify-between gap-4">
                  <Icon className="text-accent" size={26} />
                  <span className="bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[.14em] text-slate-600">{tag}</span>
                </div>
                <h3 className="mt-8 text-2xl font-semibold tracking-tight text-ink">{role}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[420px_1fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">What stays controlled</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">The platform removes manual coordination from critical moments.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              The backend owns task state, timers, claims, credits, proof access, and payout records.
            </p>
          </div>
          <div className="grid gap-4">
            {guarantees.map(([title, copy, Icon], index) => (
              <div key={title} className="group grid gap-5 border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-950/5 sm:grid-cols-[64px_1fr]">
                <div className="grid h-16 w-16 place-items-center bg-ink text-white transition group-hover:bg-accent">
                  <Icon size={24} />
                </div>
                <div>
                  <p className="font-mono text-xs font-semibold text-slate-400">CONTROL {String(index + 1).padStart(2, "0")}</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink px-5 py-16 text-white sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <BellRing className="text-accent" size={28} />
            <h2 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight sm:text-6xl">Post tasks. Notify scanners. Settle cleanly.</h2>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/70">
              Clients can publish one URL or many URLs. Scanners still receive them as separate tasks.
            </p>
          </div>
          <Link href="/signup" className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 bg-white px-6 font-semibold text-ink transition hover:-translate-y-0.5">
            Create account
            <CheckCircle2 size={18} />
          </Link>
        </div>
      </section>
    </PublicFrame>
  );
}
