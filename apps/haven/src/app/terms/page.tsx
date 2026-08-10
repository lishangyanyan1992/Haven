import type { Metadata } from "next";

import { LegalPage } from "@/components/app/legal-page";

/**
 * NEEDS LEGAL REVIEW BEFORE IT IS RELIED ON. See the note in `privacy/page.tsx`.
 *
 * The substantive point this page has to carry, and the reason it is worth more
 * than boilerplate here: Haven answers immigration questions where being wrong can
 * cost somebody their status. The "not legal advice" limitation is the single most
 * important sentence on it, so it is stated first, plainly, rather than buried in
 * a limitation-of-liability clause nobody reads.
 */
export const metadata: Metadata = {
  title: "Terms of Service — Haven",
  description: "The terms you agree to when using Haven."
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" lastUpdated="10 August 2026">
      <h2>Haven is not your lawyer</h2>
      <p>
        This is the most important thing on this page. Haven gives you information about employment-based immigration —
        official sources, your own dates, and what other people in similar situations have done. That is not legal
        advice, and using Haven does not create an attorney-client relationship with anyone.
      </p>
      <p>
        Immigration outcomes depend on facts we do not have and rules that change. Before you act on anything you read
        here — especially anything involving a deadline, a filing, travel, or leaving a job —{" "}
        <strong>confirm it with a qualified immigration attorney.</strong> If Haven and your attorney disagree, your
        attorney is right.
      </p>

      <h2>Using Haven</h2>
      <ul>
        <li>You need an account, and you are responsible for what happens under it.</li>
        <li>Give us accurate information. Answers built on a stale profile will be wrong, and you will not know it.</li>
        <li>
          Do not use Haven to break the law, to misrepresent facts to any government agency, or to get help concealing
          something from one. The Advisor is built to refuse this, and we will close accounts that try.
        </li>
        <li>Do not attempt to access anyone else&apos;s data, or to disrupt the service.</li>
      </ul>

      <h2>The Advisor</h2>
      <p>
        The Advisor is an AI assistant. It uses a language model, and language models make mistakes — including
        confident ones. We put substantial effort into keeping it accurate and into making it say when it is unsure, but
        you should treat its answers as a well-researched starting point, not a conclusion.
      </p>
      <p>
        The Advisor is not an emergency service. If you are in crisis, please contact a crisis line or emergency
        services — the Advisor will point you to them, but it cannot help you itself.
      </p>

      <h2>Community content</h2>
      <p>
        Some of what Haven shows you comes from other people&apos;s experiences. Those are anecdotes, not precedent.
        What worked for someone else may not apply to your facts, and may not have been correct for them either.
      </p>
      <p>
        If you post to the community, keep it accurate and civil, and do not post anyone else&apos;s personal
        information. We may remove content and close accounts that do not.
      </p>

      <h2>Availability and changes</h2>
      <p>
        We may change, suspend, or discontinue parts of Haven. If we are shutting down something you depend on, we will
        give you notice and a way to get your data out.
      </p>

      <h2>Liability</h2>
      <p>
        Haven is provided as-is. To the fullest extent the law allows, we are not liable for decisions you make based on
        information from Haven. This does not limit any liability that cannot be limited by law.
      </p>

      <h2>Ending it</h2>
      <p>
        You can stop using Haven and delete your account at any time. We may suspend or close an account that breaks
        these terms.
      </p>

      <h2>Privacy</h2>
      <p>
        How we handle your information is covered in our <a href="/privacy">Privacy Policy</a>.
      </p>
    </LegalPage>
  );
}
