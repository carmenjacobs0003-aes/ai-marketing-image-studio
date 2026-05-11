import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  EyeOff,
  HeartPulse,
  LineChart,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2
} from "lucide-react";
import type { AdminDashboardData } from "@/lib/admin/types";
import { cn } from "@/lib/utils/cn";

type AdminAction = (formData: FormData) => Promise<void>;

type Props = {
  data: AdminDashboardData;
  query?: string;
  status?: string;
  updateUserAction: AdminAction;
  updateReportAction: AdminAction;
  updateGalleryAction: AdminAction;
};

const toneClasses = {
  cyan: "border-cyan-300/35 bg-cyan-300/[0.07] text-cyan-100",
  green: "border-emerald-300/35 bg-emerald-300/[0.07] text-emerald-100",
  amber: "border-amber-300/35 bg-amber-300/[0.08] text-amber-100",
  rose: "border-rose-300/35 bg-rose-300/[0.08] text-rose-100"
};

function shortDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function dateTime(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export function AdminDashboard({ data, query = "", status = "all", updateUserAction, updateReportAction, updateGalleryAction }: Props) {
  const normalizedQuery = query.toLowerCase().trim();
  const filteredUsers = data.users.filter((user) => {
    const matchesQuery = !normalizedQuery || [user.email, user.full_name, user.plan, user.subscription_status, user.admin_role].some((item) => item?.toLowerCase().includes(normalizedQuery));
    const matchesStatus = status === "all" || user.subscription_status === status || user.plan === status || user.moderation_status === status || user.admin_role === status;
    return matchesQuery && matchesStatus;
  });
  const maxDaily = Math.max(...data.dailyGenerations.map((point) => point.total), 1);

  return (
    <main className="page-shell">
      <div className="page-container">
        <header className="page-hero overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.22),transparent_34rem)]" />
          <div className="relative grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
            <div>
              <p className="eyebrow">Admin command deck</p>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white sm:text-5xl">Platform management system</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Secure operator dashboard for analytics, subscriptions, user management, moderation, audit trails, and generation reliability monitoring.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="holo-panel p-4">
                <ShieldCheck className="mb-3 h-5 w-5 text-cyan-300" />
                <p className="font-black text-white">Admin-only</p>
                <p className="mt-1 text-xs text-slate-400">Server-side role gate</p>
              </div>
              <div className="holo-panel p-4">
                <HeartPulse className="mb-3 h-5 w-5 text-cyan-300" />
                <p className="font-black text-white">Production ready</p>
                <p className="mt-1 text-xs text-slate-400">Audit logged actions</p>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {data.metrics.map((metric) => (
            <article className={cn("metric-card p-5", toneClasses[metric.tone ?? "cyan"])} key={metric.label}>
              <p className="text-xs font-black uppercase tracking-[0.22em] opacity-80">{metric.label}</p>
              <p className="mt-3 text-3xl font-black text-white">{metric.value}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{metric.detail}</p>
            </article>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="glass-card p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="eyebrow">Analytics overview</p>
                <h2 className="mt-2 text-2xl font-black text-white">Generations per day</h2>
              </div>
              <LineChart className="h-7 w-7 text-cyan-300" />
            </div>
            <div className="mt-6 flex h-72 items-end gap-2 overflow-x-auto rounded-3xl border border-white/10 bg-black/45 p-4">
              {data.dailyGenerations.map((point) => (
                <div className="flex min-w-12 flex-1 flex-col items-center gap-2" key={point.date}>
                  <div className="flex h-52 w-full items-end justify-center rounded-t-2xl bg-white/[0.035] p-1">
                    <div
                      className="w-full rounded-t-xl bg-gradient-to-t from-cyan-500 via-cyan-300 to-white shadow-[0_0_24px_rgba(34,211,238,0.42)]"
                      style={{ height: `${Math.max((point.total / maxDaily) * 100, point.total ? 8 : 2)}%` }}
                      title={`${point.total} generations`}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-slate-400">{shortDate(point.date)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="eyebrow">Generation health</p>
                <h2 className="mt-2 text-2xl font-black text-white">Success/error monitor</h2>
              </div>
              <Activity className="h-7 w-7 text-cyan-300" />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <HealthPill label="Success" value={`${data.generationHealth.successRate}%`} />
              <HealthPill label="Errors" value={`${data.generationHealth.errorRate}%`} danger={data.generationHealth.errorRate > 10} />
              <HealthPill label="Queued" value={String(data.generationHealth.queued)} />
              <HealthPill label="Processing" value={String(data.generationHealth.processing)} />
            </div>
            <div className="mt-5 space-y-3">
              {data.generationHealth.recentErrors.length ? data.generationHealth.recentErrors.map((error) => (
                <div className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-3" key={`${error.kind}-${error.id}`}>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-rose-100">{error.kind} error · {dateTime(error.created_at)}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-300">{error.error_message ?? error.prompt}</p>
                </div>
              )) : <p className="empty-state text-sm">No generation errors detected in the latest sample window.</p>}
            </div>
          </div>
        </section>

        <section className="glass-card p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="eyebrow">User management</p>
              <h2 className="mt-2 text-2xl font-black text-white">Accounts, subscriptions, verification</h2>
            </div>
            <form className="grid gap-3 sm:grid-cols-[1fr_180px_auto]" action="/admin">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-300" />
                <input className="field-control pl-11" name="q" placeholder="Search users" defaultValue={query} />
              </label>
              <select className="field-control" name="status" defaultValue={status}>
                <option value="all">All statuses</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="agency">Agency</option>
                <option value="active">Active subscription</option>
                <option value="clean">Clean</option>
                <option value="flagged">Flagged</option>
                <option value="admin">Admins</option>
                <option value="moderator">Moderators</option>
              </select>
              <button className="ghost-button" type="submit">Filter</button>
            </form>
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-[980px] w-full border-separate border-spacing-y-3 text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.2em] text-slate-500">
                <tr><th>User</th><th>Plan</th><th>Subscription</th><th>Role</th><th>Verified</th><th>Moderation</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr className="rounded-3xl bg-white/[0.035] ring-1 ring-white/10" key={user.id}>
                    <td className="rounded-l-3xl p-4"><p className="font-bold text-white">{user.email ?? "Unknown"}</p><p className="text-xs text-slate-400">Joined {shortDate(user.created_at)} · Active {dateTime(user.last_active_at)}</p></td>
                    <td className="p-4"><Badge>{user.plan}</Badge></td>
                    <td className="p-4 text-slate-300">{user.subscription_status}</td>
                    <td className="p-4"><Badge>{user.admin_role}</Badge></td>
                    <td className="p-4">{user.creator_verified ? <BadgeCheck className="h-5 w-5 text-cyan-300" /> : <span className="text-slate-500">No</span>}</td>
                    <td className="p-4 text-slate-300">{user.moderation_status}</td>
                    <td className="rounded-r-3xl p-4">
                      <form action={updateUserAction} className="flex flex-wrap gap-2">
                        <input type="hidden" name="userId" value={user.id} />
                        <select className="field-control max-w-28 py-2 text-xs" name="plan" defaultValue={user.plan}><option value="free">Free</option><option value="pro">Pro</option><option value="agency">Agency</option></select>
                        <select className="field-control max-w-36 py-2 text-xs" name="subscriptionStatus" defaultValue={user.subscription_status}><option value="free">Free</option><option value="approval_pending">Pending</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option><option value="past_due">Past due</option></select>
                        <select className="field-control max-w-32 py-2 text-xs" name="adminRole" defaultValue={user.admin_role}><option value="user">User</option><option value="moderator">Moderator</option><option value="admin">Admin</option></select>
                        <input type="hidden" name="creatorVerified" value={user.creator_verified ? "false" : "true"} />
                        <button className="ghost-button px-3 py-2 text-xs" name="intent" value="save" type="submit">Save</button>
                        <button className="ghost-button px-3 py-2 text-xs" name="intent" value="toggleVerification" type="submit">{user.creator_verified ? "Unverify" : "Verify"}</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Panel title="Moderation queue" eyebrow="Reports" icon={<AlertTriangle className="h-6 w-6 text-cyan-300" />}>
            <div className="space-y-3">
              {data.reports.map((report) => (
                <div className="rounded-3xl border border-white/10 bg-black/45 p-4" key={report.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-black text-white">{report.gallery_item?.title ?? "Deleted content"}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200">{report.reason} · {report.status}</p>
                      <p className="mt-2 text-sm text-slate-400">{report.details ?? "No report details provided."}</p>
                    </div>
                    <Badge>{dateTime(report.created_at)}</Badge>
                  </div>
                  <form action={updateReportAction} className="mt-4 flex flex-wrap gap-2">
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="itemId" value={report.gallery_item_id} />
                    <button className="ghost-button px-3 py-2 text-xs" name="intent" value="reviewing" type="submit">Review</button>
                    <button className="ghost-button px-3 py-2 text-xs" name="intent" value="resolved" type="submit"><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Resolve</button>
                    <button className="ghost-button px-3 py-2 text-xs" name="intent" value="dismissed" type="submit">Dismiss</button>
                    <button className="ghost-button px-3 py-2 text-xs text-rose-100" name="intent" value="remove" type="submit"><Trash2 className="mr-1 h-3.5 w-3.5" />Remove content</button>
                  </form>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Content controls" eyebrow="Gallery operations" icon={<Sparkles className="h-6 w-6 text-cyan-300" />}>
            <div className="space-y-3">
              {data.galleryItems.map((item) => (
                <div className="rounded-3xl border border-white/10 bg-black/45 p-4" key={item.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-black text-white">{item.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">{item.category} · {item.visibility} · {item.report_count} reports</p>
                    </div>
                    {item.featured ? <Star className="h-5 w-5 fill-cyan-300 text-cyan-300" /> : <Star className="h-5 w-5 text-slate-600" />}
                  </div>
                  <form action={updateGalleryAction} className="mt-4 flex flex-wrap gap-2">
                    <input type="hidden" name="itemId" value={item.id} />
                    <button className="ghost-button px-3 py-2 text-xs" name="intent" value={item.featured ? "unfeature" : "feature"} type="submit"><Star className="mr-1 h-3.5 w-3.5" />{item.featured ? "Unfeature" : "Feature"}</button>
                    <button className="ghost-button px-3 py-2 text-xs" name="intent" value={item.visibility === "public" ? "hide" : "restore"} type="submit"><EyeOff className="mr-1 h-3.5 w-3.5" />{item.visibility === "public" ? "Hide" : "Restore"}</button>
                    <button className="ghost-button px-3 py-2 text-xs text-rose-100" name="intent" value="remove" type="submit"><Trash2 className="mr-1 h-3.5 w-3.5" />Remove</button>
                  </form>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Panel title="System health" eyebrow="Infrastructure" icon={<HeartPulse className="h-6 w-6 text-cyan-300" />}>
            <div className="grid gap-3 sm:grid-cols-2">
              {data.systemHealth.map((item) => <HealthPill key={item.label} label={item.label} value={item.value} detail={item.detail} danger={item.tone === "rose"} />)}
            </div>
          </Panel>

          <Panel title="Production monitoring" eyebrow="Alerts & recovery" icon={<AlertTriangle className="h-6 w-6 text-cyan-300" />}>
            <div className="space-y-3">
              {data.monitoringIncidents.length ? data.monitoringIncidents.map((incident) => (
                <div className={cn("rounded-2xl border p-3", incident.severity === "critical" ? "border-rose-300/25 bg-rose-300/[0.07]" : "border-amber-300/25 bg-amber-300/[0.07]")} key={`${incident.label}-${incident.value}`}>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-white">{incident.label} · {incident.value}</p>
                  <p className="mt-1 text-sm text-slate-300">{incident.detail}</p>
                </div>
              )) : <p className="empty-state text-sm">All production diagnostics are clear. Syntrix monitoring is launch-ready.</p>}
            </div>
          </Panel>
          <Panel title="Audit logging" eyebrow="Operator trail" icon={<BarChart3 className="h-6 w-6 text-cyan-300" />}>
            <div className="space-y-3">
              {data.auditLogs.map((log) => (
                <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:flex-row sm:items-center sm:justify-between" key={log.id}>
                  <div>
                    <p className="font-bold text-white">{log.action}</p>
                    <p className="text-xs text-slate-400">{log.target_type} {log.target_id ? `· ${log.target_id.slice(0, 8)}` : ""}</p>
                  </div>
                  <Badge>{log.severity} · {dateTime(log.created_at)}</Badge>
                </div>
              ))}
              {!data.auditLogs.length ? <p className="empty-state text-sm">No audit events yet. Admin actions will appear here.</p> : null}
            </div>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">{children}</span>;
}

function HealthPill({ label, value, detail, danger = false }: { label: string; value: string; detail?: string; danger?: boolean }) {
  return (
    <div className={cn("rounded-3xl border p-4", danger ? "border-rose-300/30 bg-rose-300/[0.07]" : "border-cyan-300/20 bg-cyan-300/[0.055]")}>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p> : null}
    </div>
  );
}

function Panel({ title, eyebrow, icon, children }: { title: string; eyebrow: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="glass-card p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
        </div>
        {icon}
      </div>
      {children}
    </section>
  );
}
