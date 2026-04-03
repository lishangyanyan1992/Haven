import { AlertCircle, ArrowUpRight, CalendarClock } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getImmigrationUpdates } from "@/lib/immigration-updates";

export async function ImmigrationUpdates() {
  const updates = await getImmigrationUpdates();

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-label">Official updates</p>
          <h2 className="text-h2 mt-2">Important immigration changes to watch right now</h2>
        </div>
        <p className="text-caption max-w-[46ch]">
          Pulled from official government pages only. Use this as a watchlist, then open the source before making decisions.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {updates.map((update) => (
          <Card
            key={update.id}
            variant={update.emphasis === "critical" ? "urgent" : update.emphasis === "important" ? "alert" : "default"}
          >
            <CardHeader>
              <div>
                <p className="text-label">{update.sourceLabel}</p>
                <CardTitle className="mt-2">{update.title}</CardTitle>
              </div>
              {update.emphasis === "critical" ? (
                <AlertCircle className="h-5 w-5 text-[var(--haven-blush-ink)]" />
              ) : (
                <CalendarClock className="h-5 w-5 text-[var(--haven-ink-mid)]" />
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-body-sm">{update.summary}</p>
              {update.publishedAt && <p className="text-caption">Published {update.publishedAt}</p>}
              <a
                className="inline-flex items-center gap-2 text-body-sm text-[var(--haven-ink)] underline-offset-4 hover:underline"
                href={update.url}
                rel="noreferrer"
                target="_blank"
              >
                Open official source
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
