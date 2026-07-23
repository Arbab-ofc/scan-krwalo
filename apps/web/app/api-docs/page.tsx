import { ArrowRight, Braces, Cable, CheckCircle2, DatabaseZap, KeyRound, LockKeyhole, RadioTower, ShieldCheck, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { PublicFrame } from "../../components/shell";

type Endpoint = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  auth: string;
  purpose: string;
};

type Group = {
  title: string;
  copy: string;
  icon: LucideIcon;
  endpoints: Endpoint[];
};

const groups: Group[] = [
  {
    title: "System",
    copy: "Health, readiness, public settings, and API metadata used before authentication.",
    icon: RadioTower,
    endpoints: [
      ["GET", "/health", "Public", "Service health probe."],
      ["GET", "/ready", "Public", "Database readiness probe."],
      ["GET", "/api/v1/settings/public", "Public", "Public contact and platform settings."]
    ].map(endpoint)
  },
  {
    title: "Auth",
    copy: "Account creation, login, refresh sessions, logout, and current-user lookup.",
    icon: KeyRound,
    endpoints: [
      ["POST", "/api/v1/auth/signup", "Public", "Create user, client, scanner, or protected admin account."],
      ["POST", "/api/v1/auth/login", "Public", "Exchange username/email and password for access and refresh tokens."],
      ["POST", "/api/v1/auth/refresh", "Refresh token", "Rotate a refresh token and issue a new access token."],
      ["POST", "/api/v1/auth/logout", "Refresh token", "Revoke one refresh session."],
      ["POST", "/api/v1/auth/logout-all", "Authenticated", "Revoke all sessions for the current user."],
      ["GET", "/api/v1/auth/me", "Authenticated", "Return the current authenticated user."],
      ["POST", "/api/v1/auth/change-password", "Authenticated", "Password-change placeholder endpoint."]
    ].map(endpoint)
  },
  {
    title: "Activation",
    copy: "Role activation and credit-code redemption after signup.",
    icon: ShieldCheck,
    endpoints: [
      ["POST", "/api/v1/activation/redeem", "Authenticated", "Redeem SCN or CLI activation code."],
      ["GET", "/api/v1/activation/status", "Authenticated", "Return activation and profile status."]
    ].map(endpoint)
  },
  {
    title: "Tasks",
    copy: "Task creation, bulk publishing, claiming, proof submission, review, and proof file access.",
    icon: DatabaseZap,
    endpoints: [
      ["POST", "/api/v1/tasks", "Client/Admin", "Create one task with URL, optional title, and instructions."],
      ["POST", "/api/v1/tasks/bulk", "Client/Admin", "Create many independent tasks from multiple URLs."],
      ["GET", "/api/v1/tasks", "Authenticated", "List tasks visible to the current user."],
      ["GET", "/api/v1/tasks/proofs/:key", "Task participant", "Download or view a submitted proof file."],
      ["GET", "/api/v1/tasks/:id", "Authenticated", "Fetch one task by ID."],
      ["POST", "/api/v1/tasks/:id/claim", "Scanner", "Atomically claim an available task."],
      ["POST", "/api/v1/tasks/:id/submit", "Scanner", "Submit task completion and optional proof file."],
      ["POST", "/api/v1/tasks/:id/confirm", "Client", "Confirm scanner work and settle ledgers."],
      ["POST", "/api/v1/tasks/:id/dispute", "Authenticated", "Dispute placeholder endpoint."],
      ["POST", "/api/v1/tasks/:id/cancel", "Authenticated", "Cancel placeholder endpoint."]
    ].map(endpoint)
  },
  {
    title: "Client",
    copy: "Client workspace data, credits, task history, scanner presence, and credit ledger.",
    icon: Braces,
    endpoints: [
      ["GET", "/api/v1/client/dashboard", "Client", "Client profile, credit account, and recent tasks."],
      ["GET", "/api/v1/client/credits", "Client", "Current client credit account."],
      ["GET", "/api/v1/client/scanner-presence", "Client", "Current count of online scanners."],
      ["GET", "/api/v1/client/credit-transactions", "Client", "Paginated client credit ledger."],
      ["GET", "/api/v1/client/tasks", "Client", "Paginated tasks posted by the client."]
    ].map(endpoint)
  },
  {
    title: "Scanner",
    copy: "Scanner task feed, presence, current task, history, payout profile, wallet, and payouts.",
    icon: Cable,
    endpoints: [
      ["GET", "/api/v1/scanner/dashboard", "Scanner", "Scanner profile, wallet, and server time."],
      ["GET", "/api/v1/scanner/live-tasks", "Scanner", "Available task feed for online scanners."],
      ["GET", "/api/v1/scanner/current-task", "Scanner", "Current active scanner task."],
      ["GET", "/api/v1/scanner/history", "Scanner", "Paginated scanner task history."],
      ["PATCH", "/api/v1/scanner/profile", "Scanner", "Update payout destination profile."],
      ["POST", "/api/v1/scanner/presence/online", "Scanner", "Set scanner online and broadcast presence."],
      ["POST", "/api/v1/scanner/presence/offline", "Scanner", "Set scanner offline and broadcast presence."],
      ["GET", "/api/v1/scanner/presence/status", "Scanner", "Read own presence and online scanner count."],
      ["GET", "/api/v1/scanner/wallet", "Scanner", "Current scanner wallet."],
      ["GET", "/api/v1/scanner/wallet/transactions", "Scanner", "Paginated scanner wallet ledger."],
      ["POST", "/api/v1/scanner/payouts", "Scanner", "Create payout request."],
      ["GET", "/api/v1/scanner/payouts", "Scanner", "Paginated payout requests."]
    ].map(endpoint)
  },
  {
    title: "Notifications And Push",
    copy: "Persistent notifications and browser push subscription management.",
    icon: CheckCircle2,
    endpoints: [
      ["GET", "/api/v1/notifications", "Authenticated", "Paginated notifications."],
      ["GET", "/api/v1/notifications/unread-count", "Authenticated", "Unread notification count."],
      ["POST", "/api/v1/notifications/:id/read", "Authenticated", "Mark one notification as read."],
      ["POST", "/api/v1/notifications/read-all", "Authenticated", "Mark all notifications as read."],
      ["GET", "/api/v1/push-subscriptions/public-key", "Public", "Firebase Web Push configuration."],
      ["POST", "/api/v1/push-subscriptions", "Authenticated", "Register a Firebase browser token for the signed-in user."],
      ["POST", "/api/v1/push-subscriptions/test", "Authenticated", "Send a Firebase test push notification."],
      ["DELETE", "/api/v1/push-subscriptions/:id", "Authenticated", "Delete one push subscription."],
      ["GET", "/api/v1/scanner/telegram", "Scanner", "Read scanner Telegram alert link status."],
      ["POST", "/api/v1/scanner/telegram/link", "Scanner", "Generate Telegram bot deep link for this scanner."],
      ["DELETE", "/api/v1/scanner/telegram", "Scanner", "Unlink Telegram task alerts."],
      ["POST", "/api/v1/telegram/webhook", "Telegram", "Telegram bot webhook for /start link updates."]
    ].map(endpoint)
  },
  {
    title: "Admin",
    copy: "Operations, activation-code management, task exports, reports, disputes, payouts, settings, and audit logs.",
    icon: LockKeyhole,
    endpoints: [
      ["GET", "/api/v1/admin/dashboard", "Admin", "Admin overview metrics."],
      ["POST", "/api/v1/admin/activation-codes/scanner", "Admin", "Create scanner activation code."],
      ["POST", "/api/v1/admin/activation-codes/client", "Admin", "Create client credit code."],
      ["GET", "/api/v1/admin/activation-codes", "Admin", "List activation codes."],
      ["GET", "/api/v1/admin/activation-codes/:id", "Admin", "Get one activation code."],
      ["POST", "/api/v1/admin/activation-codes/:id/revoke", "Admin", "Revoke activation code."],
      ["DELETE", "/api/v1/admin/activation-codes/:id", "Admin", "Delete revoked activation code."],
      ["GET", "/api/v1/admin/scanners", "Admin", "List scanners."],
      ["GET", "/api/v1/admin/clients", "Admin", "List clients."],
      ["PATCH", "/api/v1/admin/users/:id/status", "Admin", "Suspend or activate user account."],
      ["GET", "/api/v1/admin/tasks/export.csv", "Admin", "Export task list CSV."],
      ["GET", "/api/v1/admin/tasks/:id", "Admin", "Get admin task detail."],
      ["GET", "/api/v1/admin/tasks", "Admin", "List and filter tasks."],
      ["GET", "/api/v1/admin/reports/:report/export.csv", "Admin", "Export report CSV."],
      ["GET", "/api/v1/admin/reports/:report", "Admin", "Read named admin report."],
      ["GET", "/api/v1/admin/disputes", "Admin", "List disputes."],
      ["POST", "/api/v1/admin/disputes/:id/resolve", "Admin", "Resolve dispute placeholder endpoint."],
      ["GET", "/api/v1/admin/payouts", "Admin", "List payout requests."],
      ["POST", "/api/v1/admin/payouts/:id/processing", "Admin", "Move payout to processing."],
      ["POST", "/api/v1/admin/payouts/:id/paid", "Admin", "Mark payout paid."],
      ["POST", "/api/v1/admin/payouts/:id/reject", "Admin", "Reject payout."],
      ["GET", "/api/v1/admin/settings", "Admin", "Read system settings."],
      ["PATCH", "/api/v1/admin/settings", "Admin", "Update system settings."],
      ["POST", "/api/v1/admin/notifications/test-push", "Admin", "Send one Firebase test push to every registered browser."],
      ["GET", "/api/v1/admin/telegram/webhook", "Admin", "Read Telegram webhook URL, pending updates, and last error."],
      ["POST", "/api/v1/admin/telegram/webhook", "Admin", "Save optional bot settings and install the Telegram webhook."],
      ["GET", "/api/v1/admin/audit-logs", "Admin", "Paginated audit log."]
    ].map(endpoint)
  }
];

const methodClass: Record<Endpoint["method"], string> = {
  GET: "bg-sky-50 text-sky-700",
  POST: "bg-emerald-50 text-emerald-700",
  PATCH: "bg-amber-50 text-amber-700",
  DELETE: "bg-rose-50 text-rose-700"
};

export default function ApiDocsPage() {
  const totalEndpoints = groups.reduce((count, group) => count + group.endpoints.length, 0);
  return (
    <PublicFrame>
      <section className="relative overflow-hidden bg-ink px-5 py-16 text-white sm:py-20">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.08)_1px,transparent_1px)] bg-[size:42px_42px]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_420px] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.2em] text-accent">Developer reference</p>
            <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl">Scan Krwalo API endpoints</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70">
              Every HTTP route exposed by the Fastify API, grouped by product surface and access level.
            </p>
          </div>
          <div className="border border-white/12 bg-white/8 p-5 backdrop-blur">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Endpoints" value={totalEndpoints} />
              <Stat label="Groups" value={groups.length} />
            </div>
            <Link href="/signup" className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 bg-accent px-5 font-semibold text-white">
              Create account
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-surface px-5 py-14">
        <div className="mx-auto grid max-w-7xl gap-6">
          {groups.map((group) => {
            const Icon = group.icon;
            return (
              <section key={group.title} className="overflow-hidden border border-line bg-white shadow-sm">
                <div className="grid gap-4 border-b border-line p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
                  <div className="flex min-w-0 gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-ink text-white">
                      <Icon size={22} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-2xl font-semibold tracking-tight text-ink">{group.title}</h2>
                      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{group.copy}</p>
                    </div>
                  </div>
                  <span className="w-fit bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[.14em] text-slate-600">
                    {group.endpoints.length} routes
                  </span>
                </div>
                <div className="divide-y divide-line">
                  {group.endpoints.map((item) => (
                    <div key={`${item.method}-${item.path}`} className="grid gap-3 p-4 transition hover:bg-slate-50 md:grid-cols-[92px_minmax(0,1fr)_160px] md:items-center">
                      <span className={`w-fit rounded px-2.5 py-1 font-mono text-xs font-semibold ${methodClass[item.method]}`}>{item.method}</span>
                      <div className="min-w-0">
                        <p className="break-safe font-mono text-sm font-semibold text-ink">{item.path}</p>
                        <p className="mt-1 text-sm text-slate-500">{item.purpose}</p>
                      </div>
                      <span className="w-fit rounded-full border border-line px-3 py-1 text-xs font-semibold text-slate-600 md:justify-self-end">{item.auth}</span>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </PublicFrame>
  );
}

function endpoint([method, path, auth, purpose]: string[]): Endpoint {
  return {
    method: method as Endpoint["method"],
    path: path ?? "",
    auth: auth ?? "",
    purpose: purpose ?? ""
  };
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-white/12 bg-white/8 p-4">
      <p className="text-xs font-semibold uppercase tracking-[.16em] text-white/55">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}
