import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PublicNavbar } from "@/components/app/public-navbar";
import { FirmClaimForm } from "@/components/app/firm-claim-form";
import { getLawFirm } from "@/lib/legal-directory";
import { noIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Claim your firm — Haven Immigration Lawyer Directory",
  ...noIndexMetadata
};

type ClaimPageProps = {
  params: Promise<{ firm: string }>;
};

export default async function ClaimFirmPage({ params }: ClaimPageProps) {
  const { firm: firmId } = await params;
  const firm = getLawFirm(firmId);

  if (!firm) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <PublicNavbar currentPath="/lawyers" />
      <main className="content-container-visual py-10 md:py-14">
        <div className="mx-auto max-w-3xl space-y-6">
          <Link
            className="inline-flex items-center gap-1.5 text-body-sm text-[var(--haven-ink-mid)] transition-colors hover:text-[var(--haven-ink)]"
            href={`/lawyers/${firm.id}`}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to {firm.firmName}
          </Link>

          <div>
            <h1 className="text-display max-w-[24ch]">Claim {firm.firmName}</h1>
            <p className="text-body mt-4 max-w-[68ch]">
              Add the details that help immigrants choose you — your visa specialties, languages, pricing, and
              evidence links. It&rsquo;s free. Once we publish your claim, this information appears on your listing,
              clearly marked as provided by your firm.
            </p>
          </div>

          <FirmClaimForm firmId={firm.id} firmName={firm.firmName} mode="claim" />
        </div>
      </main>
    </div>
  );
}
