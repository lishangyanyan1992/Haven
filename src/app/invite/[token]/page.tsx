import Link from "next/link";

import { HavenBrand } from "@/components/app/haven-brand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="min-h-screen">
      <div className="content-container py-8">
        <Link href="/">
          <HavenBrand />
        </Link>
      </div>
      <div className="content-container flex items-center justify-center py-10">
        <Card className="w-full max-w-[560px]">
          <CardHeader>
            <div>
              <p className="text-label">Invitation pending</p>
              <CardTitle className="mt-3 text-h1">This invite is ready when you are.</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-body-sm">Invite token: <span className="font-mono text-[var(--haven-ink)]">{token}</span></p>
            <p className="text-body-sm">
              Wire this route to Supabase invite acceptance once the authenticated invite flow is confirmed.
            </p>
            <Button size="lg">Accept invitation</Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
