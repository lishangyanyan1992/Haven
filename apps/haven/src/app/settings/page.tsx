import Link from "next/link";
import { ArrowRight, Sliders, Bell } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getAppShellSnapshot } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";
import { saveSystemPreferencesAction } from "@/server/actions";

export const metadata = {
  ...noIndexMetadata,
  title: "Settings · Haven"
};

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ saved?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [snapshot, crisisState] = await Promise.all([
    getAppShellSnapshot(),
    getCrisisState()
  ]);
  const { profile } = snapshot;

  return (
    <AppShell activePath="/settings" crisisState={crisisState} snapshot={snapshot}>
      <div className="space-y-6 max-w-[820px]">
        <section className="page-intro">
          <p className="text-label">System Preferences</p>
          <h1 className="text-h1 mt-4">Settings</h1>
          <p className="text-body mt-4 text-[var(--color-text-secondary)]">
            Manage your account settings, notifications, and application preferences.
          </p>
        </section>

        {resolvedSearchParams?.saved === "1" && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-5 py-4 text-body-sm">
            System preferences updated.
          </div>
        )}

        {/* Banner pointing to Your Info */}
        <section className="rounded-[var(--radius-xl)] border border-[var(--haven-sage)] bg-[var(--haven-sage-light)]/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[var(--haven-ink)]">
                Looking for your visa, green card, or case memories?
              </p>
              <p className="mt-1 text-body-sm text-[var(--haven-ink-mid)]">
                Case details, active visas, all green cards filed, document facts, and client notes live together in Your Info.
              </p>
            </div>
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--haven-ink)] bg-white px-4 py-1.5 text-[13px] font-semibold text-[var(--haven-ink)] shadow-sm hover:bg-[var(--haven-cream)]"
            >
              Go to Your Info
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>

        <form action={saveSystemPreferencesAction} className="space-y-6">
          <Card>
            <CardHeader>
              <div>
                <p className="text-label">Email notifications</p>
                <CardTitle className="mt-2">Choose which Haven updates land in your inbox</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="field-label">Community replies</label>
                <Select
                  defaultValue={profile.communityReplyEmailNotifications ? "true" : "false"}
                  name="communityReplyEmailNotifications"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </Select>
                <p className="mt-1 text-body-sm text-[var(--color-text-secondary)]">
                  Send an email when Haven notifies you about replies to your community posts and threads.
                </p>
              </div>

              <div>
                <label className="field-label">Status updates & Bulletin movements</label>
                <Select
                  defaultValue={profile.statusUpdateEmailNotifications ? "true" : "false"}
                  name="statusUpdateEmailNotifications"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </Select>
                <p className="mt-1 text-body-sm text-[var(--color-text-secondary)]">
                  Send an email when official immigration inputs change, such as monthly Visa Bulletin movements for your priority date queue.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button size="lg" type="submit">
              Save preferences
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
