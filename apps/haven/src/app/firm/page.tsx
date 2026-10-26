import { requireFirmMember } from "@/lib/firms/access";
import { getFirmConsultationBooking, listFirmClients } from "@/lib/firms/clients";
import { getFirmIntakeQuestions } from "@/lib/firms/intake-questions";
import { getCurrentFirmLink, intakeUrl } from "@/lib/firms/links";
import { getFirmRequiredDocuments } from "@/lib/firms/required-documents";
import { noIndexMetadata } from "@/lib/seo";
import { ConsultationBookingControls } from "./ConsultationBookingControls";
import { FirmHeader } from "./FirmHeader";
import { FirmNavTabs } from "./FirmNavTabs";
import { IntakeQuestionsControls } from "./IntakeQuestionsControls";
import { LeadsTableWithFilters } from "./LeadsTableWithFilters";
import { LinkControls } from "./LinkControls";
import { RequiredDocumentsControls } from "./RequiredDocumentsControls";

export const metadata = { ...noIndexMetadata, title: "Leads Dashboard · Haven" };
export const dynamic = "force-dynamic";

export default async function FirmDashboardPage() {
  const membership = await requireFirmMember("/firm");
  const [allClients, link, requiredDocs, intakeQuestions, booking] = await Promise.all([
    listFirmClients(membership.firmId),
    getCurrentFirmLink(membership.firmId),
    getFirmRequiredDocuments(membership.firmId),
    getFirmIntakeQuestions(membership.firmId),
    getFirmConsultationBooking(membership.firmId)
  ]);

  const leads = allClients.filter((c) => c.pipelineStatus !== "contract_signed");
  const retainedClients = allClients.filter((c) => c.pipelineStatus === "contract_signed");
  const newCount = leads.filter((c) => c.isNew).length;

  return (
    <div className="min-h-screen bg-[var(--haven-cream)]">
      <FirmHeader email={membership.email} firmName={membership.firmName} isDemo={membership.isDemo} />
      <main className="content-container-wide space-y-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-label">Firm dashboard</p>
            <h1 className="text-h1 mt-2">{membership.firmName}</h1>
          </div>
          {newCount > 0 ? (
            <p className="rounded-full bg-[var(--haven-ink)] px-3.5 py-1.5 text-body-sm font-semibold text-[var(--haven-cream)]">
              {newCount} new leads
            </p>
          ) : null}
        </div>

        {/* Top-level Navigation between Leads Pipeline and Retained Clients */}
        <FirmNavTabs
          clientsCount={retainedClients.length}
          current="leads"
          leadsCount={leads.length}
        />

        <ConsultationBookingControls
          initialBookingEmail={booking.bookingEmail}
          initialBookingUrl={booking.bookingUrl}
        />

        <IntakeQuestionsControls initialItems={intakeQuestions} />

        <RequiredDocumentsControls initialItems={requiredDocs} />

        <LinkControls initialUrl={link ? intakeUrl(link.token) : null} isActive={Boolean(link?.is_active)} />

        {/* Filterable Leads Table with Direct Contact actions & CRM CSV Export */}
        <LeadsTableWithFilters leads={leads} />
      </main>
    </div>
  );
}
