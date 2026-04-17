import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getSnapshot } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";

export const metadata = noIndexMetadata;

export default async function TimelinePage() {
  const [snapshot, crisisState] = await Promise.all([getSnapshot(), getCrisisState()]);
  const { timelineEvents } = snapshot;

  return (
    <AppShell activePath="/timeline" crisisState={crisisState} snapshot={snapshot}>
      <div className="space-y-6">
        <section className="page-intro">
          <p className="text-label">Timeline engine</p>
          <h1 className="text-h1 mt-4">Dates when they’re real. Ranges when they aren’t.</h1>
          <p className="text-body mt-4 max-w-[65ch]">
            Haven should communicate uncertainty with honesty. Every timeline event includes what it means and what to do next, not just a date.
          </p>
        </section>

        <Card>
          <CardHeader>
            <div>
              <p className="text-label">Principles</p>
              <CardTitle className="mt-2">How Haven communicates uncertainty</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-4 text-body-sm">
              Precise dates when rules are deterministic.
            </div>
            <div className="rounded-[var(--radius-lg)] bg-[var(--haven-sage-light)] p-4 text-body-sm">
              Ranges when bulletin movement or outcomes are probabilistic.
            </div>
            <div className="rounded-[var(--radius-lg)] bg-[var(--haven-sky-light)] p-4 text-body-sm">
              A recommended action on every event, not just a number.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <p className="text-label">Your timeline</p>
              <CardTitle className="mt-2">What to keep in view</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="timeline">
              {timelineEvents.map((event, index) => (
                <div key={event.id} className="timeline-item">
                  <div className="timeline-track">
                    <div
                      className={
                        index === 0
                          ? "timeline-dot timeline-dot-active"
                          : event.group === "now"
                            ? "timeline-dot timeline-dot-urgent"
                            : "timeline-dot timeline-dot-done"
                      }
                    />
                  </div>
                  <div className="timeline-content">
                    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-h3">{event.title}</p>
                          <p className="text-caption mt-1">{event.dateLabel}</p>
                        </div>
                        <Badge variant={event.group === "now" ? "urgent" : event.group === "upcoming" ? "community" : "pending"}>
                          {event.group}
                        </Badge>
                      </div>
                      <p className="text-body-sm mt-3">{event.explanation}</p>
                      <div className="mt-4 rounded-[var(--radius-md)] bg-[var(--haven-sage-light)] p-4">
                        <p className="text-label">Recommended next action</p>
                        <p className="text-body-sm mt-2">{event.nextAction}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
