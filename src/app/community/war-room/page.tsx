import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSnapshot } from "@/lib/repositories/case-compass";

export default async function WarRoomPage() {
  const { warRoom } = await getSnapshot();

  return (
    <AppShell activePath="/community">
      <div className="space-y-6">
        <section className="rounded-[var(--radius-2xl)] border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] p-6 md:p-8">
          <p className="text-label text-[var(--haven-blush-ink)]">High-urgency space</p>
          <h1 className="text-h1 mt-4">{warRoom.name}</h1>
          <p className="text-body mt-4 max-w-[65ch]">
            High-urgency, moderated support for people planning around a 60-day grace period. This space exists to help you move without amplifying panic.
          </p>
        </section>

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <CardHeader>
              <div>
                <p className="text-label">Why this space exists</p>
                <CardTitle className="mt-2">Grounding before action</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-body-sm">{warRoom.summary}</p>
              <div className="rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-4">
                <p className="text-body-sm">Community posts here are informational only and should not replace legal counsel.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <p className="text-label">Active posts</p>
                <CardTitle className="mt-2">What members are sharing right now</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {warRoom.posts.map((post) => (
                <div key={post.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-4">
                  <p className="text-h3">{post.title}</p>
                  <p className="text-caption mt-1">{post.authorLabel}</p>
                  <p className="text-body-sm mt-3">{post.body}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
