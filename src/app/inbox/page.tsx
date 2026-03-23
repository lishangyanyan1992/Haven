import { AppShell } from "@/components/app/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSnapshot } from "@/lib/repositories/case-compass";

export default async function InboxPage() {
  const { emailInbox } = await getSnapshot();

  return (
    <AppShell activePath="/inbox">
      <div className="space-y-6">
        <section className="page-intro">
          <p className="text-label">Email ingest</p>
          <h1 className="text-h1 mt-4">Forward the immigration emails you want Haven to understand.</h1>
          <p className="text-body mt-4 max-w-[65ch]">
            Haven never reaches into your inbox. You decide what to forward, and Haven asks for confirmation before profile fields change.
          </p>
        </section>

        <Card>
          <CardHeader>
            <div>
              <p className="text-label">Your forwarding alias</p>
              <CardTitle className="mt-2">Send immigration updates here</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--haven-white)] px-4 py-2 font-mono text-[13px] text-[var(--haven-ink)]">
              {emailInbox[0]?.alias}
            </div>
            <p className="text-body-sm mt-3">Forward only the notices or attorney updates you want Haven to process.</p>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {emailInbox.map((record) => (
            <Card key={record.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-label">{record.sourceType.replaceAll("_", " ")}</p>
                    <CardTitle className="mt-2">{record.subject}</CardTitle>
                  </div>
                  <Badge variant={record.status === "accepted" ? "active" : "pending"}>
                    {record.status.replaceAll("_", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-caption">
                  Received {new Date(record.receivedAt).toLocaleDateString()} · Confidence appears on each extracted field.
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {record.extractedFields.map((field) => (
                    <div key={field.label} className="rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-label">{field.label}</p>
                        <Badge variant={field.confidence === "high" ? "active" : "pending"}>{field.confidence}</Badge>
                      </div>
                      <p className="text-body-sm mt-3">{field.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
