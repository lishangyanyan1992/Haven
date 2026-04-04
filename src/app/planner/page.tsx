import { AppShell } from "@/components/app/app-shell";
import { CrisisActivationModal } from "@/components/app/crisis-activation-modal";
import { PlannerChecklist } from "@/components/app/planner-checklist";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildChecklist } from "@/lib/crisis-checklist";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getSnapshot } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";
import Link from "next/link";

export const metadata = noIndexMetadata;

export default async function PlannerPage() {
  const [{ planner, profile }, crisisState] = await Promise.all([getSnapshot(), getCrisisState()]);
  const crisisChecklist = buildChecklist(profile);
  const dayProgressWidth = crisisState ? `${Math.max((crisisState.dayNumber / 60) * 100, 2)}%` : "20%";

  return (
    <AppShell activePath="/planner" crisisState={crisisState}>
      <div className="space-y-6">
        <section className="page-intro">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-[65ch]">
              <p className="text-label">Layoff scenario planner</p>
              <h1 className="text-h1 mt-4">
                {crisisState
                  ? "Your live 60-day survival checklist."
                  : "You just lost your job. Here&apos;s what you need to know."}
              </h1>
              <p className="text-body mt-4">
                {crisisState
                  ? "The countdown is now live, and each checklist item is persisted to your current layoff event."
                  : planner.situationSummary}
              </p>
            </div>

            {!crisisState ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <CrisisActivationModal />
                <Link className={buttonVariants({ variant: "outline" })} href="/dashboard">
                  Back to dashboard
                </Link>
              </div>
            ) : null}
          </div>

          <div className="mt-6 rounded-[var(--radius-lg)] border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-label text-[var(--haven-blush-ink)]">Grace period</p>
                <p className="text-h3 mt-1">
                  {crisisState ? `Day ${crisisState.dayNumber} of 60` : "Day 12 of 60"}
                </p>
              </div>
              <Badge variant="urgent">
                {crisisState ? `${crisisState.daysRemaining} days left` : "48 days left"}
              </Badge>
            </div>
            <div className="mt-4 countdown-bar">
              <div className="countdown-bar-fill urgent" style={{ width: dayProgressWidth }} />
            </div>
          </div>
        </section>

        <Card>
          <CardHeader>
            <div>
              <p className="text-label">Scenario options</p>
              <CardTitle className="mt-2">Choose the path Haven thinks fits best</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {planner.rankedOptions.map((option, index) => (
                <span key={option.id} className={index === 0 ? "tag tag-visa" : "tag tag-pending"}>
                  {option.title}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <div>
                <p className="text-label">Ranked guidance</p>
                <CardTitle className="mt-2">Your strongest options right now</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {planner.rankedOptions.map((option, index) => (
                <article key={option.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-h3">{option.title}</p>
                      <p className="text-body-sm mt-2">{option.summary}</p>
                    </div>
                    <Badge variant={index === 0 ? "active" : "pending"}>{option.fitScore}/100 fit</Badge>
                  </div>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[var(--radius-md)] bg-[var(--haven-sage-light)] p-4">
                      <p className="text-label">Why it fits</p>
                      <ul className="mt-3 space-y-2">
                        {option.whyItFits.map((item) => (
                          <li key={item} className="text-body-sm">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-[var(--radius-md)] bg-[var(--haven-sand)] p-4">
                      <p className="text-label">Constraints</p>
                      <ul className="mt-3 space-y-2">
                        {option.constraints.map((item) => (
                          <li key={item} className="text-body-sm">
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div>
                  <p className="text-label">60-day plan</p>
                  <CardTitle className="mt-2">
                    {crisisState ? "Track the actions that protect your status" : "What to do first, second, and next"}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {crisisState ? (
                  <PlannerChecklist
                    completedItemKeys={crisisState.completedItemKeys}
                    eventId={crisisState.eventId}
                    items={crisisChecklist}
                  />
                ) : (
                  <div className="timeline">
                    {planner.checklist.map((item, index) => (
                      <div key={item.id} className="timeline-item">
                        <div className="timeline-track">
                          <div className={index === 0 ? "timeline-dot timeline-dot-active" : "timeline-dot timeline-dot-done"} />
                        </div>
                        <div className="timeline-content">
                          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4">
                            <p className="text-label">{item.window}</p>
                            <p className="text-h3 mt-2">{item.title}</p>
                            <p className="text-body-sm mt-2">{item.detail}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card variant="alert">
              <CardHeader>
                <div>
                  <p className="text-label">Community context</p>
                  <CardTitle className="mt-2">What people in your situation shared</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-body-sm">{planner.communityContext}</p>
              </CardContent>
            </Card>

            <Card variant="urgent">
              <CardHeader>
                <div>
                  <p className="text-label">Important note</p>
                  <CardTitle className="mt-2">Use this to stay organized, not to replace counsel.</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-body-sm">{planner.disclaimer}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
