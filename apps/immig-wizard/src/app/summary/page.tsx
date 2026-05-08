'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { HavenMark } from '@/components/branding/HavenMark';
import { DraftConflictDialog } from '@/components/draft/DraftConflictDialog';
import { AnswerReview } from '@/components/summary/AnswerReview';
import { DocumentsChecklist } from '@/components/summary/DocumentsChecklist';
import { useWizardDraft } from '@/hooks/useWizardDraft';
import { createInitialState } from '@/lib/storage';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  FileText,
  ArrowLeft,
  RotateCcw,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react';

const HAVEN_HOME_URL = 'https://haven-h1b.com/';

const FILING_STEPS = [
  {
    num: 1,
    title: 'Prepare G-1145, I-130, and I-130A',
    desc: 'Start with the acceptance-notification cover sheet and the marriage petition forms for the petitioner and beneficiary.',
  },
  {
    num: 2,
    title: 'Complete Form I-485',
    desc: "The beneficiary fills out Form I-485 (Application to Register Permanent Residence). This is the main green card application. File concurrently with I-130 when possible.",
  },
  {
    num: 3,
    title: 'Complete Form I-864 (Affidavit of Support)',
    desc: "The petitioner fills out I-864 to demonstrate financial ability to support the beneficiary above 125% of the federal poverty line.",
  },
  {
    num: 4,
    title: 'Add optional I-765 and I-131 if selected',
    desc: 'If the couple chose work authorization or advance parole in the wizard, include those forms in the packet now.',
  },
  {
    num: 5,
    title: 'Handle payment and the medical exam',
    desc: 'If paying by credit card, include a hand-signed Form G-1450. The sealed I-693 from the civil surgeon must be filed now or kept ready for later USCIS submission.',
  },
  {
    num: 6,
    title: 'Compile your package and mail to USCIS',
    desc: 'Assemble all forms, supporting documents, photos, and filing fees into a complete package. Mail to the appropriate USCIS lockbox address.',
  },
  {
    num: 7,
    title: 'Attend biometrics appointment',
    desc: "USCIS will send you an appointment notice (Form I-797C) for biometrics (fingerprints, photo). Both petitioner and beneficiary may need to attend.",
  },
  {
    num: 8,
    title: 'Attend the green card interview',
    desc: "USCIS will schedule an interview at your local field office. Both spouses attend. Bring original documents. The officer will verify your eligibility and assess the bona fides of your marriage.",
  },
  {
    num: 9,
    title: 'Receive green card decision',
    desc: "After a successful interview, USCIS will approve the I-485 and mail the green card. Spouses of US citizens typically receive a 2-year conditional green card, which must be removed by filing Form I-751.",
  },
] as const;

type FilingStepItem = (typeof FILING_STEPS)[number];

export default function SummaryPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'checklist' | 'answers' | 'nextsteps'>('checklist');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const {
    wizardState,
    isHydrating,
    conflict,
    chooseLocalDraft,
    chooseRemoteDraft,
    resetDraft
  } = useWizardDraft();

  const handleEdit = (step: number) => {
    router.push(`/wizard/${step}`);
  };

  const handleReset = () => {
    resetDraft();
    router.push('/');
  };

  if (isHydrating || !wizardState) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const petitionerName = [
    wizardState.answers['petitioner_first_name'],
    wizardState.answers['petitioner_last_name'],
  ]
    .filter(Boolean)
    .join(' ');

  const beneficiaryName = [
    wizardState.answers['beneficiary_first_name'],
    wizardState.answers['beneficiary_last_name'],
  ]
    .filter(Boolean)
    .join(' ');

  const hasCriminalHistory = wizardState.answers['criminal_arrests'] === 'yes';
  const hasOverstay = wizardState.answers['overstayed'] === 'yes';
  const needsAttorney = hasCriminalHistory || hasOverstay;

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,var(--neutral-25)_0%,var(--neutral-50)_38%,var(--neutral-25)_100%)]">
      <header className="border-b border-border bg-[color:rgb(250_249_247_/_0.88)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href={HAVEN_HOME_URL} prefetch={false}>
              <HavenMark labelClassName="text-[1.65rem]" />
            </Link>
            <div className="hidden h-8 w-px bg-border sm:block" />
            <p className="hidden text-sm text-muted-foreground sm:block">Your Summary</p>
          </div>
          <Link href="/wizard/1">
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              Back to wizard
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 rounded-[1.75rem] border border-[color:var(--green-700)] bg-[linear-gradient(180deg,var(--green-700)_0%,var(--green-800)_100%)] p-6 text-white shadow-[var(--shadow-lg)]">
          <div className="mb-3 flex items-center gap-3">
            <CheckCircle2 className="h-7 w-7 text-[color:var(--amber-300)]" />
            <h1 className="text-4xl font-light leading-none text-white">Your application summary is ready!</h1>
          </div>
          {(petitionerName || beneficiaryName) && (
            <p className="mb-4 text-sm text-[color:var(--green-200)]">
              {petitionerName && `Petitioner: ${petitionerName}`}
              {petitionerName && beneficiaryName && ' · '}
              {beneficiaryName && `Beneficiary: ${beneficiaryName}`}
            </p>
          )}
          <p className="text-sm leading-7 text-[color:var(--green-100)]">
            Review your documents checklist, confirm your answers, and follow the filing steps below to submit your
            marriage-based green card application.
          </p>
        </div>

        {needsAttorney && (
          <div className="mb-6 flex items-start gap-3 rounded-[var(--radius-xl-token)] border border-[color:rgb(217_123_42_/_0.22)] bg-[color:var(--warning-tint)] p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--warning)]" />
            <div>
              <p className="mb-1 text-sm font-semibold text-[color:var(--warning-foreground)]">
                We recommend consulting an immigration attorney
              </p>
              <p className="text-sm leading-6 text-[color:var(--warning-foreground)]">
                Based on your answers (
                {[hasCriminalHistory && 'criminal history', hasOverstay && 'out-of-status period']
                  .filter(Boolean)
                  .join(' and ')}
                ), your case has added complexity. An attorney can significantly improve your chances of approval.
              </p>
            </div>
          </div>
        )}

        <div className="mb-6 flex items-center gap-4 rounded-[var(--radius-xl-token)] border border-[color:var(--green-700)] bg-[color:var(--green-700)] p-5 text-white shadow-[var(--shadow-md)]">
          <div className="flex-1">
            <p className="mb-1 text-sm font-semibold">Ready to prepare your forms?</p>
            <p className="text-xs leading-relaxed text-[color:var(--green-100)]">
              Review missing packet data and download the selected USCIS forms pre-filled with your answers.
            </p>
          </div>
          <Link href="/forms" className="shrink-0">
            <Button size="sm" className="border-0 bg-white text-[color:var(--green-700)] hover:bg-[color:var(--neutral-50)]">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Prepare Forms (PDF)
            </Button>
          </Link>
        </div>

        <div className="mb-6 flex gap-1 rounded-[var(--radius-lg-token)] bg-secondary p-1">
          {(
            [
              { id: 'checklist', label: 'Documents', icon: <FileText className="h-4 w-4" /> },
              { id: 'nextsteps', label: 'Next Steps', icon: <CheckCircle2 className="h-4 w-4" /> },
              { id: 'answers', label: 'Your Answers', icon: <FileText className="h-4 w-4" /> },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-[calc(var(--radius-md-token)-1px)] py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-foreground shadow-[var(--shadow-xs)]'
                  : 'text-muted-foreground hover:text-[color:var(--neutral-700)]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'checklist' && <DocumentsChecklist wizardState={wizardState} />}

        {activeTab === 'answers' && (
          <AnswerReview wizardState={wizardState} onEdit={handleEdit} />
        )}

        {activeTab === 'nextsteps' && (
          <div className="space-y-4">
            <div className="mb-4 rounded-[var(--radius-xl-token)] border border-border bg-white p-5 shadow-[var(--shadow-sm)]">
              <h2 className="text-[1.8rem] font-normal text-foreground">Filing Order & Process</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                For immediate relatives of US citizens, all forms are filed concurrently. USCIS typically processes
                these in 12–18 months, though times vary.
              </p>
            </div>

            {FILING_STEPS.map((step, idx) => (
              <FilingStep
                key={step.num}
                step={step}
                isLast={idx === FILING_STEPS.length - 1}
              />
            ))}

            <div className="mt-6 rounded-[var(--radius-xl-token)] border border-[color:var(--green-700)] bg-[color:var(--green-800)] p-5 text-white">
              <h3 className="mb-3 flex items-center gap-2 text-[1.6rem] font-normal text-white">
                <ExternalLink className="h-4 w-4" />
                Official USCIS Resources
              </h3>
              <div className="space-y-2 text-sm text-[color:var(--green-100)]">
                <p>• Form I-130: uscis.gov/i-130</p>
                <p>• Form G-1145: uscis.gov/g-1145</p>
                <p>• Form I-485: uscis.gov/i-485</p>
                <p>• Form I-864: uscis.gov/i-864</p>
                <p>• Form G-1450: uscis.gov/g-1450</p>
                <p>• Current filing fees: uscis.gov/forms/filing-fees</p>
                <p>• Find a civil surgeon: uscis.gov/find-a-civil-surgeon</p>
                <p>• Check case status: egov.uscis.gov</p>
              </div>
              <p className="mt-4 text-xs text-[color:var(--green-200)]">
                Always verify current fees and addresses on uscis.gov before filing — they change periodically.
              </p>
            </div>
          </div>
        )}

        <div className="mt-12 border-t border-border pt-6">
          {showResetConfirm ? (
            <div className="rounded-[var(--radius-xl-token)] border border-[color:rgb(201_58_50_/_0.22)] bg-[color:var(--destructive-subtle)] p-4">
              <p className="mb-3 text-sm font-medium text-[color:var(--error-ink)]">
                This will delete all your saved answers. Are you sure?
              </p>
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleReset}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-3 w-3" />
                  Yes, start over
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-[color:var(--neutral-700)]"
            >
              <RotateCcw className="h-3 w-3" />
              Start over / clear all answers
            </button>
          )}
        </div>

        <p className="mt-8 text-center text-xs leading-6 text-muted-foreground">
          ImmigWizard is for informational purposes only and does not constitute legal advice.
          Consult a licensed immigration attorney for your specific situation.
        </p>

        <DraftConflictDialog
          open={Boolean(conflict)}
          localState={conflict?.localState ?? createInitialState()}
          localSupplements={conflict?.localSupplements ?? {}}
          remoteState={conflict?.remoteState ?? createInitialState()}
          remoteSupplements={conflict?.remoteSupplements ?? {}}
          onChooseLocal={chooseLocalDraft}
          onChooseRemote={chooseRemoteDraft}
        />
      </main>
    </div>
  );
}

function FilingStep({
  step,
  isLast,
}: {
  step: FilingStepItem;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          {step.num}
        </div>
        {!isLast && <div className="mb-0 mt-1 w-0.5 flex-1 bg-border" />}
      </div>
      <div className="flex-1 pb-4">
        <button
          onClick={() => setOpen(!open)}
          className="w-full rounded-[var(--radius-xl-token)] border border-border bg-white p-4 text-left shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:border-[color:var(--border-strong)] hover:shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[color:var(--neutral-800)]">{step.title}</p>
            {open ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </div>
          {open && (
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{step.desc}</p>
          )}
        </button>
      </div>
    </div>
  );
}
