import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronRight, ExternalLink, MessageSquareWarning, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdminUser } from "@/lib/admin-auth";
import { noIndexMetadata } from "@/lib/seo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ManualSyncButton } from "./ManualSyncButton";

export const metadata = noIndexMetadata;
export const dynamic = "force-dynamic";

function formatMonthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export default async function AdminDashboardPage() {
  await requireAdminUser("/admin");

  const admin = createSupabaseAdminClient() as any;

  // 1. Fetch newest Visa Bulletin entry
  const bulletinPromise = admin
    .from("visa_bulletin_entries")
    .select("bulletin_year, bulletin_month, created_at, source_url")
    .order("bulletin_year", { ascending: false })
    .order("bulletin_month", { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2. Fetch community imports metrics using head-only count queries
  const pendingCommunityPromise = admin
    .from("community_import_items")
    .select("id", { count: "exact", head: true })
    .in("moderation_status", ["pending", "needs_revision"]);

  const autoApprovedCommunityPromise = admin
    .from("community_import_items")
    .select("id", { count: "exact", head: true })
    .eq("moderation_status", "approved")
    .like("moderation_notes", "Auto-approved.%");

  const liveCommunityPromise = admin
    .from("community_import_items")
    .select("id", { count: "exact", head: true })
    .not("published_post_id", "is", null);

  // 3. Fetch recent firm pilot requests
  const pilotsPromise = admin
    .from("firm_pilot_requests")
    .select("id, firm_name, full_name, email, note, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  // 4. Fetch recent advisor complaints (excluding null, empty, or whitespace-only feedback)
  const feedbackPromise = admin
    .from("advisor_feedback")
    .select("id, rating, feedback_text, created_at")
    .lte("rating", 0)
    .not("feedback_text", "is", null)
    .neq("feedback_text", "")
    .order("created_at", { ascending: false })
    .limit(5);

  const [
    bulletinRes,
    pendingCommunityRes,
    autoApprovedCommunityRes,
    liveCommunityRes,
    pilotsRes,
    feedbackRes
  ] = await Promise.all([
    bulletinPromise,
    pendingCommunityPromise,
    autoApprovedCommunityPromise,
    liveCommunityPromise,
    pilotsPromise,
    feedbackPromise
  ]);

  // Track any query errors so we never show "All systems normal" on data failure
  const queryErrors: string[] = [];
  if (bulletinRes.error) queryErrors.push(`Visa Bulletin feed query error: ${bulletinRes.error.message}`);
  if (pendingCommunityRes.error) queryErrors.push(`Community pending queue query error: ${pendingCommunityRes.error.message}`);
  if (autoApprovedCommunityRes.error) queryErrors.push(`Community auto-approved queue query error: ${autoApprovedCommunityRes.error.message}`);
  if (liveCommunityRes.error) queryErrors.push(`Community live posts query error: ${liveCommunityRes.error.message}`);
  if (pilotsRes.error) queryErrors.push(`Law firm inquiries query error: ${pilotsRes.error.message}`);
  if (feedbackRes.error) queryErrors.push(`Advisor feedback query error: ${feedbackRes.error.message}`);

  // Compute bulletin status & staleness
  const latestBulletin = bulletinRes.data;
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();

  let bulletinLabel = "None held";
  let bulletinAgeDays = 0;
  let isBulletinStale = true;
  let bulletinLastSynced: string | null = null;
  let bulletinSourceUrl: string | null = null;

  if (latestBulletin) {
    bulletinLabel = formatMonthLabel(latestBulletin.bulletin_year, latestBulletin.bulletin_month);
    bulletinLastSynced = latestBulletin.created_at;
    bulletinSourceUrl = latestBulletin.source_url;

    const bulletinStart = Date.UTC(latestBulletin.bulletin_year, latestBulletin.bulletin_month - 1, 1);
    bulletinAgeDays = Math.floor((now.getTime() - bulletinStart) / (1000 * 60 * 60 * 24));

    const monthDelta =
      latestBulletin.bulletin_year * 12 +
      latestBulletin.bulletin_month -
      (currentYear * 12 + currentMonth);

    // Stale if:
    // - Behind current month (monthDelta < 0)
    // - In current month but past the 15th (next bulletin is published)
    // - Age is older than 35 days
    isBulletinStale = monthDelta < 0 || (monthDelta === 0 && currentDay >= 15) || bulletinAgeDays > 35;
  }

  // Community import counts
  const pendingCommunityCount = pendingCommunityRes.count ?? 0;
  const autoApprovedCommunityCount = autoApprovedCommunityRes.count ?? 0;
  const liveCommunityCount = liveCommunityRes.count ?? 0;

  // Recent firm pilot requests
  const recentPilots = (pilotsRes.data as Array<{
    id: string;
    firm_name: string;
    full_name: string;
    email: string;
    note: string | null;
    created_at: string;
  }>) ?? [];

  // Recent complaints (trimmed text check)
  const recentFeedback = (feedbackRes.data as Array<{
    id: string;
    rating: number;
    feedback_text: string | null;
    created_at: string;
  }>) ?? [];
  const complaintsWithText = recentFeedback.filter((f) => Boolean(f.feedback_text?.trim()));

  // Action required items for triage banner (stale bulletin, pending drafts, or query errors)
  const actionItems: Array<{ message: string; href?: string; actionLabel?: string }> = [];

  for (const err of queryErrors) {
    actionItems.push({ message: err });
  }

  if (isBulletinStale) {
    actionItems.push({
      message: `Visa Bulletin is outdated: latest held is ${bulletinLabel} (${bulletinAgeDays} days old). An updated bulletin should be available from the State Department.`
    });
  }

  if (pendingCommunityCount > 0) {
    actionItems.push({
      message: `${pendingCommunityCount} community draft${pendingCommunityCount === 1 ? "" : "s"} waiting in the moderation queue.`,
      href: "/admin/community-imports?filter=needs-review",
      actionLabel: "Review drafts →"
    });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-display-sm text-[var(--haven-ink)] font-semibold">Admin Operations</h1>
        <p className="text-body text-[var(--haven-ink-mid)] mt-1">
          Monitor system freshness, background sync pipelines, and operational queues.
        </p>
      </div>

      {/* Action Required Banner */}
      {actionItems.length > 0 ? (
        <section className="rounded-2xl border border-[var(--haven-blush-mid,#fecdd3)] bg-[var(--haven-blush-light,#fff1f2)] p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-[var(--haven-blush-ink,#9f1239)] mt-0.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <h2 className="text-body-sm font-semibold text-[var(--haven-blush-ink,#9f1239)] uppercase tracking-wide">
                Action Required ({actionItems.length})
              </h2>
              <ul className="space-y-2">
                {actionItems.map((item, idx) => (
                  <li key={idx} className="flex flex-wrap items-center justify-between gap-2 text-body-sm text-[var(--haven-ink)]">
                    <span>{item.message}</span>
                    {item.href && item.actionLabel ? (
                      <Link
                        href={item.href}
                        className="font-medium text-[var(--haven-blush-ink,#9f1239)] underline underline-offset-4 hover:opacity-80"
                      >
                        {item.actionLabel}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-[var(--color-border-success,#86efac)] bg-[var(--color-bg-success,#f0fdf4)] p-4 shadow-sm flex items-center gap-3 text-[var(--color-text-success,#166534)]">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-body-sm font-medium">All systems normal. Data feeds are current and queues are clear.</span>
        </section>
      )}

      {/* Primary Status Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Visa Bulletin Card */}
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--haven-white)] rounded-2xl shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className="text-label text-[var(--haven-ink-mid)]">Regulatory Feed</p>
              <h3 className="text-h3 text-[var(--haven-ink)] font-semibold mt-0.5">Visa Bulletin</h3>
            </div>
            {isBulletinStale ? (
              <Badge variant="urgent">STALE (Update Due)</Badge>
            ) : (
              <Badge variant="active">CURRENT</Badge>
            )}
          </div>

          <div className="space-y-3 py-2 text-body-sm">
            <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
              <span className="text-[var(--haven-ink-mid)]">Latest Held Edition</span>
              <span className="font-medium text-[var(--haven-ink)]">{bulletinLabel}</span>
            </div>
            <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
              <span className="text-[var(--haven-ink-mid)]">Edition Age</span>
              <span className="font-medium text-[var(--haven-ink)]">{bulletinAgeDays} days</span>
            </div>
            <div className="flex justify-between border-b border-[var(--color-border)] pb-2">
              <span className="text-[var(--haven-ink-mid)]">Last Synced</span>
              <span className="font-medium text-[var(--haven-ink)]">{formatDate(bulletinLastSynced)}</span>
            </div>
            {bulletinSourceUrl ? (
              <div className="flex justify-between items-center pt-1">
                <span className="text-[var(--haven-ink-mid)]">State Dept Source</span>
                <a
                  href={bulletinSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[var(--haven-sky-ink)] hover:underline text-caption"
                >
                  travel.state.gov <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ) : null}
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
            <ManualSyncButton label="Run Manual Sync" />
          </div>
        </Card>

        {/* Community Story Queue Card */}
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--haven-white)] rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-label text-[var(--haven-ink-mid)]">Moderation Queue</p>
                <h3 className="text-h3 text-[var(--haven-ink)] font-semibold mt-0.5">Community Stories</h3>
              </div>
              {pendingCommunityCount > 0 ? (
                <Badge variant="urgent">{pendingCommunityCount} Pending</Badge>
              ) : (
                <Badge variant="active">Queue Clear</Badge>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 my-4">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--haven-cream,#fdfaf6)] p-3 text-center">
                <p className="text-caption text-[var(--haven-ink-mid)]">Need Review</p>
                <p className="text-h3 font-semibold text-[var(--haven-ink)] mt-1">{pendingCommunityCount}</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--haven-cream,#fdfaf6)] p-3 text-center">
                <p className="text-caption text-[var(--haven-ink-mid)]">AI Approved</p>
                <p className="text-h3 font-semibold text-[var(--haven-ink)] mt-1">{autoApprovedCommunityCount}</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--haven-cream,#fdfaf6)] p-3 text-center">
                <p className="text-caption text-[var(--haven-ink-mid)]">Live Posts</p>
                <p className="text-h3 font-semibold text-[var(--haven-ink)] mt-1">{liveCommunityCount}</p>
              </div>
            </div>

            <p className="text-caption text-[var(--haven-ink-mid)]">
              Outside source stories from Reddit and community submissions staged for moderation before publication.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-[var(--color-border)]">
            <Link
              href="/admin/community-imports"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--haven-sky-ink)] bg-[var(--haven-white)] px-4 py-2.5 text-body-sm font-semibold text-[var(--haven-sky-ink)] transition hover:bg-[var(--haven-sky-light)]"
            >
              <span>Open Review Queue</span>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </Card>
      </div>

      {/* Secondary Operational Lists */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Lawyer Pilot Inquiries */}
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--haven-white)] rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[var(--haven-sky-ink)]" />
              <h3 className="text-body font-semibold text-[var(--haven-ink)]">Recent Law Firm Pilot Inquiries</h3>
            </div>
            <span className="text-caption text-[var(--haven-ink-mid)]">{recentPilots.length} total</span>
          </div>

          {recentPilots.length === 0 ? (
            <p className="text-body-sm text-[var(--haven-ink-mid)] py-4">No inbound law firm inquiries yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {recentPilots.map((pilot) => (
                <li key={pilot.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-body-sm font-semibold text-[var(--haven-ink)]">{pilot.firm_name}</p>
                      <p className="text-caption text-[var(--haven-ink-mid)]">
                        {pilot.full_name} · <a href={`mailto:${pilot.email}`} className="text-[var(--haven-sky-ink)] hover:underline">{pilot.email}</a>
                      </p>
                    </div>
                    <span className="text-caption text-[var(--haven-ink-mid)] shrink-0">{formatDate(pilot.created_at)}</span>
                  </div>
                  {pilot.note ? (
                    <p className="text-caption text-[var(--haven-ink)] bg-[var(--haven-cream,#fdfaf6)] rounded p-2 mt-2 italic">
                      "{pilot.note}"
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Advisor Quality & User Complaints */}
        <Card className="p-6 border border-[var(--color-border)] bg-[var(--haven-white)] rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquareWarning className="h-5 w-5 text-[var(--haven-blush-ink,#9f1239)]" />
              <h3 className="text-body font-semibold text-[var(--haven-ink)]">Advisor Feedback & Complaints</h3>
            </div>
            <span className="text-caption text-[var(--haven-ink-mid)]">{complaintsWithText.length} with notes</span>
          </div>

          {complaintsWithText.length === 0 ? (
            <p className="text-body-sm text-[var(--haven-ink-mid)] py-4">No recent negative feedback comments on record.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {complaintsWithText.map((item) => (
                <li key={item.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <Badge variant="urgent">Downvote</Badge>
                    <span className="text-caption text-[var(--haven-ink-mid)]">{formatDate(item.created_at)}</span>
                  </div>
                  <p className="text-body-sm text-[var(--haven-ink)] mt-2 bg-[var(--haven-blush-light,#fff1f2)] rounded-lg p-2.5">
                    "{item.feedback_text}"
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
