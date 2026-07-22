import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  CheckCircle2,
  Clock3,
  FileCheck2,
  LockKeyhole,
  RadioTower,
  ShieldCheck,
  WalletCards,
  Zap,
  type LucideIcon
} from "lucide-react";
import { PublicFrame } from "../components/shell";

const rails: Array<[string, string, string]> = [
  ["01", "Client posts URL", "Credit reserved"],
  ["02", "Scanners notified", "Online only"],
  ["03", "First grab wins", "Atomic claim"],
  ["04", "Proof submitted", "Timer locked"],
  ["05", "Client confirms", "Wallet credited"]
];

const roleRows: Array<[LucideIcon, string, string, string]> = [
  [BadgeCheck, "Activation codes", "SCN and CLI codes decide scanner/client access after signup.", "Admin generated"],
  [Clock3, "Server timers", "Claim and completion windows are based on backend time.", "No browser trust"],
  [WalletCards, "Ledger settlement", "Credits, rewards, payouts, and reversals stay traceable.", "USDT ready"]
];

const proofRows: Array<[LucideIcon, string, string]> = [
  [RadioTower, "Broadcast", "Eligible online scanners receive the new task automatically."],
  [Zap, "Claim", "A database transaction allows one scanner to win."],
  [FileCheck2, "Proof", "Scanner uploads evidence before the completion window closes."],
  [CheckCircle2, "Settle", "Client confirmation credits the scanner exactly once."]
];

export default function HomePage() {
  return (
    <PublicFrame>
      <section className="relative overflow-hidden bg-[#fbfcfb]">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#dbe5e2_1px,transparent_1px),linear-gradient(to_bottom,#dbe5e2_1px,transparent_1px)] bg-[size:44px_44px] opacity-45" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-surface to-transparent" />

        <div className="relative mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl gap-10 px-5 py-10 lg:grid-cols-[.86fr_1.14fr] lg:items-center">
          <div className="pt-8 lg:pt-0">
            <div className="mb-8 inline-flex items-center gap-2 border border-line bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[.18em] text-slate-600 shadow-sm">
              <span className="h-2 w-2 bg-accent" />
              Post. Grab. Complete. Earn.
            </div>
            <h1 className="max-w-3xl text-[clamp(4.2rem,12vw,9.5rem)] font-semibold leading-[.78] tracking-tight text-ink">
              Scan
              <span className="block text-accent">Krwalo</span>
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-slate-600">
              URL task distribution with activation-controlled roles, timed scanner claiming, proof review, and ledger-backed USDT payouts.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/signup" className="focus-ring group inline-flex min-h-12 items-center justify-center gap-2 bg-ink px-6 font-semibold text-white shadow-xl shadow-slate-950/10 transition hover:-translate-y-0.5">
                Start account
                <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
              </Link>
              <Link href="/login" className="focus-ring inline-flex min-h-12 items-center justify-center border border-line bg-white px-6 font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300">
                Login
              </Link>
            </div>
          </div>

          <div className="relative pb-8 lg:pb-0">
            <div className="relative overflow-hidden border border-ink/10 bg-white shadow-2xl shadow-slate-950/10">
              <div className="grid grid-cols-[96px_1fr] border-b border-line">
                <div className="grid place-items-center border-r border-line bg-ink py-5 text-sm font-semibold uppercase tracking-[.18em] text-white [writing-mode:vertical-rl]">
                  Dispatch
                </div>
                <div className="p-5">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Role activation</p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">SCN &amp; CLI control board</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                      <span className="border border-line bg-slate-50 px-3 py-2">SCN583920174</span>
                      <span className="border border-line bg-slate-50 px-3 py-2">CLI739284610</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-[1fr_260px]">
                <div className="p-5 sm:p-6">
                  <div className="grid gap-3">
                    {rails.map(([step, title, meta]) => (
                      <div key={step} className="grid grid-cols-[44px_1fr_auto] items-center gap-3 border-b border-line pb-3 last:border-0 last:pb-0">
                        <span className="font-mono text-sm font-semibold text-accent">{step}</span>
                        <div>
                          <p className="font-semibold text-ink">{title}</p>
                          <p className="text-xs text-slate-500">{meta}</p>
                        </div>
                        <div className="h-2 w-20 bg-slate-100">
                          <div className="h-full bg-accent" style={{ width: `${Number(step) * 17}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-line bg-slate-50 p-5 lg:border-l lg:border-t-0">
                  <p className="text-xs font-semibold uppercase tracking-[.18em] text-slate-400">Settlement rule</p>
                  <div className="mt-5 space-y-3">
                    <RuleLine icon={<FileCheck2 size={17} />} text="Scanner done" />
                    <RuleLine icon={<CheckCircle2 size={17} />} text="Client done" />
                    <RuleLine icon={<WalletCards size={17} />} text="Scanner balance + reward" strong />
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 border border-line bg-white text-center shadow-sm">
              {["SCN code", "CLI credits", "USDT ledger"].map((item) => (
                <div key={item} className="border-r border-line px-3 py-4 text-xs font-semibold uppercase tracking-[.14em] text-slate-500 last:border-r-0">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">What makes it different</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-ink md:text-5xl">The platform is built around irreversible operational records, not loose chat coordination.</h2>
          </div>
          <div className="mt-10 grid border border-line bg-white md:grid-cols-3">
            {roleRows.map(([Icon, title, copy, tag], index) => (
              <div key={title} className={`p-6 sm:p-8 ${index !== roleRows.length - 1 ? "border-b border-line md:border-b-0 md:border-r" : ""}`}>
                <div className="flex items-center justify-between gap-4">
                  <Icon className="text-accent" size={25} />
                  <span className="text-xs font-semibold uppercase tracking-[.16em] text-slate-400">{tag}</span>
                </div>
                <h3 className="mt-8 text-2xl font-semibold tracking-tight text-ink">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-20">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[420px_1fr]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-sm font-semibold uppercase tracking-[.18em] text-accent">Live task mechanics</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-ink">A timed route from URL to verified payout.</h2>
            <p className="mt-4 text-sm leading-6 text-slate-600">Every step is constrained by role, ownership, task state, and server time.</p>
          </div>
          <div className="grid gap-4">
            {proofRows.map(([Icon, title, copy], index) => (
              <div key={title} className="group grid grid-cols-[64px_1fr] gap-5 border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-950/5">
                <div className="grid h-16 w-16 place-items-center bg-ink text-white transition group-hover:bg-accent">
                  <Icon size={24} />
                </div>
                <div>
                  <p className="font-mono text-xs font-semibold text-slate-400">STEP {String(index + 1).padStart(2, "0")}</p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-ink">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink px-5 py-20 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <LockKeyhole className="text-accent" size={26} />
            <h2 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight md:text-6xl">No role selection abuse. No manual scanner notifications. No untracked payouts.</h2>
            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/70">Signup is public. Activation is controlled. Settlement is recorded.</p>
          </div>
          <Link href="/signup" className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 bg-white px-6 font-semibold text-ink transition hover:-translate-y-0.5">
            Create account
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </PublicFrame>
  );
}

function RuleLine({ icon, text, strong = false }: { icon: React.ReactNode; text: string; strong?: boolean }) {
  return (
    <div className={`flex items-center gap-3 border border-line bg-white px-3 py-3 text-sm ${strong ? "font-semibold text-ink" : "text-slate-600"}`}>
      <span className="text-accent">{icon}</span>
      {text}
    </div>
  );
}
