import type { Metadata } from "next";

import { LegalPage } from "@/components/app/legal-page";

/**
 * NEEDS LEGAL REVIEW BEFORE IT IS RELIED ON.
 *
 * Until now, `register/page.tsx` told every new user they were agreeing to "Haven's
 * terms and privacy policy" — as plain text, with no link, and no such page
 * anywhere in the app. That is a promise of a document that did not exist, made to
 * people handing over their immigration history.
 *
 * This page is written from what the code actually does rather than from a
 * template: every category and every processor named below was verified against the
 * source (see `buildAdvisorContext`, `lib/advisor/memory.ts`, `lib/advisor/threads.ts`,
 * and the dependency list). That makes it accurate, which is the part an agent can
 * usefully contribute. It does not make it legally sufficient — jurisdictional
 * coverage, retention periods, and the lawful basis for processing all need a
 * qualified reviewer, and the retention section deliberately describes current
 * behaviour rather than committing to a schedule nobody has agreed to.
 */
export const metadata: Metadata = {
  title: "Privacy Policy — Haven",
  description: "What Haven collects, why, who it is shared with, and how to delete it."
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" lastUpdated="10 August 2026">
      <p>
        Haven helps people on employment-based visas keep track of their immigration situation. That means we hold
        information that matters a great deal to you, and some of it is sensitive. This page explains what we collect,
        why, who else sees it, and how to get rid of it.
      </p>
      <p>
        <strong>Haven provides information, not legal advice.</strong> Nothing here or in the product is a substitute
        for a qualified immigration attorney.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Account details</strong> — your email address and name.
        </li>
        <li>
          <strong>Your immigration profile</strong> — the information you enter yourself: visa type, country of birth,
          priority date, preference category, I-140 and I-485 status, PERM stage, employment status, your spouse&apos;s
          visa status, and visa expiry dates.
        </li>
        <li>
          <strong>Your timeline and documents</strong> — milestones you record, and information extracted from
          immigration emails or documents you choose to connect or upload.
        </li>
        <li>
          <strong>Advisor conversations</strong> — the questions you ask the Advisor and the answers it gives, saved so
          you can reopen them.
        </li>
        <li>
          <strong>Things you told the Advisor</strong> — short quotes from your own messages, kept so you do not have to
          repeat yourself in a later conversation. These are always shown to you in the Advisor, in your own words, and
          you can remove any of them at any time.
        </li>
        <li>
          <strong>Usage data</strong> — how you move through the product, and errors it hits, so we can fix them.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To run the product you signed up for: your dashboard, timeline, reminders, and the Advisor.</li>
        <li>
          To make Advisor answers specific to you. Your profile is used only where it is relevant to what you asked —
          your priority date is sent when you ask about the visa bulletin, your visa expiry when you ask about a grace
          period.
        </li>
        <li>
          To show anonymous, aggregated community outcomes (&ldquo;what did people in a similar situation do?&rdquo;).
          These figures are only ever produced from groups large enough that no individual can be identified, and are
          never shown for a group that is too small.
        </li>
        <li>To keep the product safe and working, and to fix what breaks.</li>
      </ul>

      <h2>Who else sees it</h2>
      <p>
        We do not sell your information, and we do not share it with employers, immigration authorities, or anyone
        acting on their behalf. We use a small number of service providers to run Haven:
      </p>
      <ul>
        <li>
          <strong>OpenAI</strong> — processes Advisor questions. When you ask the Advisor something, your question and
          the relevant parts of your Haven profile are sent to OpenAI to generate the answer.
        </li>
        <li>
          <strong>Supabase</strong> — stores your account, profile, timeline, and conversations.
        </li>
        <li>
          <strong>Vercel</strong> — hosts and serves the site.
        </li>
        <li>
          <strong>Langfuse</strong> — records Advisor requests so we can measure answer quality and investigate
          problems.
        </li>
        <li>
          <strong>Sentry</strong> — records errors so we can fix them.
        </li>
        <li>
          <strong>Mixpanel, PostHog and Vercel Analytics</strong> — product usage analytics.
        </li>
      </ul>
      <p>
        We may also disclose information where the law requires it. If we are ever compelled to do so, we will tell you
        unless we are legally prohibited from telling you.
      </p>

      <h2>Your control</h2>
      <ul>
        <li>
          <strong>See what the Advisor remembers.</strong> Everything it has kept from your earlier conversations is
          listed in the Advisor, in your own words.
        </li>
        <li>
          <strong>Delete a conversation.</strong> Removing it deletes the messages, the sources recorded with them, and
          any feedback you left. This cannot be undone.
        </li>
        <li>
          <strong>Make the Advisor forget something.</strong> Remove any remembered item and it stops being used in
          future answers.
        </li>
        <li>
          <strong>Edit or clear your profile</strong> at any time in your settings.
        </li>
        <li>
          <strong>Delete your account.</strong> Email us and we will remove your account and the data attached to it.
        </li>
      </ul>
      <p>
        Depending on where you live, you may have additional rights over your personal data, including access,
        correction, portability, and erasure. Contact us and we will honour them.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account information and profile for as long as your account exists. Advisor conversations and
        remembered items are kept until you delete them or close your account. Deleting your account removes the data
        attached to it; backups and service-provider logs may retain copies for a limited period afterwards before they
        expire.
      </p>

      <h2>Security</h2>
      <p>
        Access to your data is restricted to your own account at the database level, and connections are encrypted in
        transit. No system is perfectly secure, and we will not pretend otherwise — if we ever discover a breach
        affecting your information, we will tell you.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that materially affects how your information is used, we will tell you rather
        than quietly updating this page.
      </p>
    </LegalPage>
  );
}
