import { resolveDashboardFacts } from "@/lib/dashboard-facts";
import Link from "next/link";
import { CheckCircle2, CircleAlert, FileText, Upload } from "lucide-react";

import { AppShell } from "@/components/app/app-shell";
import { DocumentContextUploader } from "@/components/app/document-context-uploader";
import { RefreshWhileReading } from "@/components/app/refresh-while-reading";
import { Card, CardContent } from "@/components/ui/card";
import GonePage from "@/app/gone/page";
import { isPerSponsor, PRESET_REQUIRED_DOCUMENTS } from "@/lib/document-vault";
import { normalizePetitions } from "@/lib/petitions";
import { expandRequiredDocuments } from "@/lib/sponsor-documents";
import { factSetForKind, willTakeSentence } from "@/lib/document-facts/catalog";
import { describeFacts } from "@/lib/document-facts/describe";
import { loadFactsByDocument } from "@/lib/document-facts/run";
import { loadFieldSources } from "@/lib/field-sources/db";
import { documentContextAvailableFor } from "@/lib/document-context/store";
import { FirmSharingNote } from "@/components/app/firm-sharing-note";
import { getClientFirms, type ClientFirmInfo } from "@/lib/firms/intake";
import type { RequiredDocumentItem } from "@/lib/firms/types";
import { getFirmRequiredDocuments, unionRequiredDocuments } from "@/lib/firms/required-documents";
import { getCrisisState } from "@/lib/get-crisis-state";
import { getInboxPageData } from "@/lib/repositories/case-compass";
import { noIndexMetadata } from "@/lib/seo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DocumentCard, type DocumentCategoryOption } from "./DocumentCard";
import type { UserDocument } from "@/types/domain";

export const metadata = noIndexMetadata;
export const dynamic = "force-dynamic";

/**
 * Client document vault page that renders uploaded documents and unions required
 * document checklists across all connected law firms while preserving firm attribution.
 */
export default async function DocumentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user || !(await documentContextAvailableFor(user.email))) return <GonePage />;

  let clientFirms: ClientFirmInfo[] = [];
  try {
    clientFirms = await getClientFirms(user.id);
  } catch (err) {
    console.error("[documents] failed to get client firms:", err);
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-16 flex flex-col items-center justify-center text-center">
        <h1 className="text-xl font-semibold text-rose-300">Unable to load document requirements</h1>
        <p className="mt-2 text-sm text-slate-400">
          We encountered an issue loading requirements for your connected legal firms. Please reload to try again.
        </p>
      </div>
    );
  }
  const firmNames = clientFirms.map((f) => f.firmName);

  let requiredDocs: RequiredDocumentItem[] | null = null;
  if (clientFirms.length > 0) {
    try {
      const firmDocsList = await Promise.all(
        clientFirms.map(async (f) => ({
          firmId: f.firmId,
          docs: await getFirmRequiredDocuments(f.firmId)
        }))
      );
      const unioned = unionRequiredDocuments(firmDocsList);
      requiredDocs = unioned.length > 0 ? unioned : null;
    } catch (err) {
      console.error("[documents] failed to load firm required documents:", err);
      return (
        <div className="min-h-screen bg-slate-950 px-4 py-16 flex flex-col items-center justify-center text-center">
          <h1 className="text-xl font-semibold text-rose-300">Unable to load document requirements</h1>
          <p className="mt-2 text-sm text-slate-400">
            We encountered an issue loading requirements for your connected legal firms. Please reload to try again.
          </p>
        </div>
      );
    }
  }

  const [snapshot, crisisState] = await Promise.all([getInboxPageData(), getCrisisState()]);
  const documents = snapshot.documents.filter((d) => d.sourceKind === "manual_upload");
  const stillReading = documents.some((d) => d.readingStatus === "pending" || d.readingStatus === "reading");

  // Partition documents if firm has required documents
  const hasFirmRequirements = Boolean(requiredDocs && requiredDocs.length > 0);
  const requiredKeys = new Set(requiredDocs?.map((r) => r.key) ?? []);

  const availableCategories: DocumentCategoryOption[] = [
    ...PRESET_REQUIRED_DOCUMENTS.map((p) => ({ key: p.key, label: p.label })),
    ...(requiredDocs?.filter((r) => r.isCustom).map((r) => ({ key: r.key, label: r.label })) ?? [])
  ];

  // Sponsor documents (I-140, PERM, H-1B packet) are asked once per sponsor.
  const petitions = normalizePetitions(snapshot.profile.immigrantPetitions);
  const sponsorOptions = petitions.map((p) => ({
    id: p.id,
    label: p.endedReason ? `${p.sponsorName} (ended)` : p.sponsorName
  }));
  // Kinds that belong to one green card. The H-1B packet belongs to the employer, so it isn't linked to one.
  const perSponsorKeys = [
    ...PRESET_REQUIRED_DOCUMENTS.filter((p) => isPerSponsor({ key: p.key }) && p.key !== "h1b_petition").map((p) => p.key),
    ...(requiredDocs?.filter((r) => r.isCustom && isPerSponsor(r)).map((r) => r.key) ?? [])
  ];
  const isSponsorDoc = (doc: UserDocument) => perSponsorKeys.includes(doc.documentKind);
  // "What Haven took" for each document.
  const [factsByDocument, fieldSources] = await Promise.all([loadFactsByDocument(user.id), loadFieldSources(user.id)]);
  const sponsorNames = new Map(petitions.map((p) => [p.id, p.sponsorName]));
  const detailsFor = (doc: UserDocument) => ({
    ...describeFacts(factsByDocument.get(doc.id) ?? [], sponsorNames, fieldSources),
    // A general USCIS notice may be an I-140 or H-1B approval; only reading it tells.
    hasFactSet: Boolean(factSetForKind(doc.documentKind)) || doc.documentKind === "uscis_notice"
  });
  const checklist = expandRequiredDocuments({
    items: requiredDocs ?? [],
    petitions,
    employerName: snapshot.profile.employerName,
    documents
  });
  const firmChecklist = checklist.entries;
  const fulfilledCount = checklist.uploadedCount;
  const additionalDocuments = hasFirmRequirements
    ? documents.filter((d) => !requiredKeys.has(d.documentKind))
    : documents;

  const uploadedKinds = new Set(documents.map((d) => d.documentKind));
  const profile = snapshot.profile;
  const unverifiedIntakeClaims: { title: string; detail: string; neededKind: string }[] = [];
  if (profile.currentVisaExpiryDate && !uploadedKinds.has("i94_record")) {
    unverifiedIntakeClaims.push({
      title: `Status end date (${profile.currentVisaExpiryDate}) is unverified by Form I-94`,
      detail: "Your Case timeline uses this date to cap your authorized stay under 8 CFR § 214.1(l)(2), but no CBP I-94 record has been uploaded.",
      neededKind: "Most recent I-94"
    });
  }
  const docFacts = resolveDashboardFacts({ profile });
  if (docFacts.protection.hasApprovedI140 && !uploadedKinds.has("i140_notice")) {
    unverifiedIntakeClaims.push({
      title: `Approved ${docFacts.priorityDate.category ?? profile.preferenceCategory} I-140 (${docFacts.priorityDate.iso ?? "Priority Date"}) is unverified`,
      detail: "Your AC21 3-year H-1B extension eligibility and priority date retention rely on an approved Form I-140 that is not yet in your Vault.",
      neededKind: "I-140 approval notice"
    });
  }
  if (profile.employmentStatus === "laid_off" && !uploadedKinds.has("paystub")) {
    unverifiedIntakeClaims.push({
      title: `Maintenance of status through last day of work (${profile.employerName ?? "sponsor"}) needs pay stubs`,
      detail: "USCIS requires recent pay stubs to prove valid H-1B employment prior to your grace period when filing a transfer or change of status.",
      neededKind: "Recent paystubs or W-2"
    });
  }

  return (
    <AppShell activePath="/documents" crisisState={crisisState} snapshot={snapshot}>
      <RefreshWhileReading active={stillReading} />
      <div className="mx-auto max-w-[820px] space-y-6">
        <section>
          <h1 className="text-h1">Document Vault</h1>
          <p className="text-body mt-2 text-[var(--color-text-secondary)]">
            Store and manage your immigration records. When you ask questions in Haven Advisor, your answers are
            cited directly from these documents.
          </p>
        </section>

        {firmNames.length > 0 ? <FirmSharingNote firmNames={firmNames} /> : null}

        {unverifiedIntakeClaims.length > 0 && (
          <div className="rounded-[var(--radius-2xl)] border border-[var(--haven-blush)] bg-[var(--haven-blush-light)]/70 p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CircleAlert className="h-4 w-4 text-[var(--haven-blush-ink)] shrink-0" />
                <p className="text-body-sm font-bold text-[var(--haven-blush-ink)]">
                  Intake vs. Document Vault Verification Gaps ({unverifiedIntakeClaims.length})
                </p>
              </div>
              <span className="rounded-full bg-[var(--haven-white)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--haven-blush-ink)] border border-[var(--haven-blush)]">
                Client warning · Self-reported dates need notices
              </span>
            </div>
            <p className="text-body-sm text-[var(--haven-ink)]">
              Your dashboard timeline is currently plotting self-reported intake dates without the official verification notices below:
            </p>
            <div className="grid gap-2.5">
              {unverifiedIntakeClaims.map((claim) => (
                <div
                  key={claim.title}
                  className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-white)] p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-body-sm font-semibold text-[var(--haven-ink)]">{claim.title}</p>
                    <span className="rounded-full bg-[var(--haven-blush-light)] px-2 py-0.5 text-[11px] font-semibold text-[var(--haven-blush-ink)]">
                      Missing: {claim.neededKind}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-[var(--haven-ink-mid)]">{claim.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Card>
          <CardContent className="space-y-4 pt-6">
            <p className="rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-4 text-body-sm">
              To read a document, Haven sends it to OpenAI, the AI company behind the chat. It&apos;s used only to answer
              your questions and citations will name the exact document and page. Delete a document and everything Haven
              read from it is permanently removed.
            </p>
            <div>
              <p className="text-body-sm font-semibold text-[var(--haven-ink)]">Upload a document</p>
              <div className="mt-2">
                <DocumentContextUploader
                  allowCategorySelect
                  availableCategories={availableCategories}
                  perSponsorKeys={perSponsorKeys}
                  sponsorOptions={sponsorOptions}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {hasFirmRequirements ? (
          <div className="space-y-6">
            <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-4">
                <div>
                  <h2 className="text-h3">
                    Requested by {firmNames.length === 1 ? firmNames[0] : "your law firms"}
                  </h2>
                  <p className="text-body-sm mt-0.5 text-[var(--haven-ink-mid)]">
                    Upload these required documents for your attorney to review.
                  </p>
                </div>
                <span className="rounded-full bg-[var(--haven-cream)] px-3 py-1 text-body-sm font-semibold text-[var(--haven-ink)]">
                  {fulfilledCount} of {checklist.requestedCount} fulfilled
                </span>
              </div>

              {checklist.unlinked.length > 0 && (
                <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--haven-blush)] bg-[var(--haven-blush-light)]/60 p-3.5">
                  <p className="text-body-sm font-semibold text-[var(--haven-ink)]">Which sponsor is each of these for?</p>
                  <p className="mt-0.5 text-[12px] text-[var(--haven-ink-mid)]">
                    You have more than one green card sponsor, so pick the one each document belongs to.
                  </p>
                  <div className="mt-3 space-y-2">
                    {checklist.unlinked.map((doc) => (
                      <DocumentCard
                        availableCategories={availableCategories}
                        details={detailsFor(doc)}
                        document={doc}
                        key={doc.id}
                        perSponsor
                        sponsorOptions={sponsorOptions}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 divide-y divide-[var(--color-border)]">
                {firmChecklist.map((item) => (
                  <div className="py-4 first:pt-0 last:pb-0" key={item.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {item.status === "uploaded" ? (
                          <CheckCircle2 className="h-4 w-4 text-[var(--haven-sage)]" />
                        ) : item.status === "not_needed_yet" ? (
                          <FileText className="h-4 w-4 text-[var(--haven-ink-mid)]" />
                        ) : (
                          <CircleAlert className="h-4 w-4 text-[var(--haven-blush-ink)]" />
                        )}
                        <p className="text-body-sm font-semibold text-[var(--haven-ink)]">{item.label}</p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            item.status === "uploaded"
                              ? "bg-[var(--haven-sage-light)] text-[var(--haven-ink)]"
                              : item.status === "not_needed_yet"
                                ? "bg-[var(--haven-cream)] text-[var(--haven-ink-mid)]"
                                : "bg-[var(--haven-blush-light)] text-[var(--haven-blush-ink)]"
                          }`}
                        >
                          {item.status === "uploaded" ? "Uploaded" : item.status === "not_needed_yet" ? "Not needed yet" : "Needed"}
                        </span>
                      </div>
                    </div>

                    {item.status === "not_needed_yet" ? (
                      <p className="text-body-sm mt-1 text-[var(--haven-ink-mid)]">{item.reason}</p>
                    ) : item.status !== "uploaded" ? (
                      <>
                        {item.detail ? <p className="text-body-sm mt-1 text-[var(--haven-ink-mid)]">{item.detail}</p> : null}
                        <p className="mt-1 text-[12px] text-[var(--haven-ink-mid)]">{willTakeSentence(item.key, item.sponsorName)}</p>
                      </>
                    ) : null}

                    {item.status === "uploaded" ? (
                      <div className="mt-3 space-y-2">
                        {item.documents.map((doc) => (
                          <DocumentCard
                            availableCategories={availableCategories}
                            details={detailsFor(doc)}
                        document={doc}
                            key={doc.id}
                            perSponsor={isSponsorDoc(doc)}
                            sponsorOptions={sponsorOptions}
                          />
                        ))}
                      </div>
                    ) : item.status === "not_needed_yet" ? null : (
                      <div className="mt-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--haven-cream)] p-3">
                        <DocumentContextUploader
                          buttonLabel={`Upload ${item.baseLabel}`}
                          compact
                          displayLabel={item.label}
                          documentKind={item.key}
                          perSponsorKeys={perSponsorKeys}
                          petitionId={item.petitionId}
                          sponsorOptions={sponsorOptions}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-h3">Other Documents ({additionalDocuments.length})</h2>
              {additionalDocuments.length === 0 ? (
                <p className="text-body-sm text-[var(--color-text-secondary)]">No additional documents uploaded.</p>
              ) : (
                <div className="space-y-3">
                  {additionalDocuments.map((doc) => (
                    <DocumentCard
                      availableCategories={availableCategories}
                      details={detailsFor(doc)}
                        document={doc}
                      key={doc.id}
                      perSponsor={isSponsorDoc(doc)}
                      sponsorOptions={sponsorOptions}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-h3">Your Uploaded Documents ({documents.length})</h2>
            </div>
            {documents.length === 0 ? (
              <p className="text-body-sm text-[var(--color-text-secondary)]">
                No documents in your vault yet. Upload notices, cards, or passport pages above.
              </p>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <DocumentCard
                    availableCategories={availableCategories}
                    details={detailsFor(doc)}
                        document={doc}
                    key={doc.id}
                    perSponsor={isSponsorDoc(doc)}
                    sponsorOptions={sponsorOptions}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
