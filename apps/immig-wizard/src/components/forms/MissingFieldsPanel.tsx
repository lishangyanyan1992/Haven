'use client';

import Link from 'next/link';
import { AlertCircle, ArrowRightCircle, FileWarning, PenSquare } from 'lucide-react';
import { FormValidationIssue } from '@/lib/forms/types';

interface MissingFieldsPanelProps {
  issues: FormValidationIssue[];
  compact?: boolean;
  title?: string;
}

function groupIssuesByStep(issues: FormValidationIssue[]) {
  const map = new Map<number | null, FormValidationIssue[]>();
  for (const issue of issues) {
    const current = map.get(issue.stepId) ?? [];
    current.push(issue);
    map.set(issue.stepId, current);
  }
  return [...map.entries()].sort(([stepA], [stepB]) => {
    if (stepA === null) return 1;
    if (stepB === null) return -1;
    return stepA - stepB;
  });
}

export function MissingFieldsPanel({
  issues,
  compact = false,
  title = 'Complete these fields before downloading',
}: MissingFieldsPanelProps) {
  if (issues.length === 0) return null;

  const blockingIssues = issues.filter((issue) => issue.blocking);
  const warningIssues = issues.filter((issue) => !issue.blocking);

  return (
    <div
      className={`rounded-[var(--radius-lg-token)] border p-4 ${
        blockingIssues.length > 0
          ? 'border-[color:rgb(217_123_42_/_0.22)] bg-[color:var(--warning-tint)]'
          : 'border-[color:rgb(42_101_184_/_0.18)] bg-[color:var(--info-tint)]'
      }`}
    >
      <div className="mb-3 flex items-start gap-2">
        {blockingIssues.length > 0 ? (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning)]" />
        ) : (
          <PenSquare className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--info)]" />
        )}
        <div>
          <p
            className={`text-sm font-semibold ${
              blockingIssues.length > 0 ? 'text-[color:var(--warning-foreground)]' : 'text-[color:var(--info-foreground)]'
            }`}
          >
            {title}
          </p>
          <p
            className={`text-xs ${
              blockingIssues.length > 0 ? 'text-[color:var(--warning-foreground)]' : 'text-[color:var(--info-foreground)]'
            }`}
          >
            {blockingIssues.length > 0
              ? `${blockingIssues.length} blocking item${blockingIssues.length === 1 ? '' : 's'} must be completed first.`
              : 'These are manual follow-ups after you print the forms.'}
          </p>
        </div>
      </div>

      {blockingIssues.length > 0 && (
        <div className="space-y-3">
          {groupIssuesByStep(blockingIssues).map(([stepId, stepIssues]) => (
            <div key={stepId ?? 'manual'} className="rounded-[var(--radius-md-token)] border border-[color:rgb(217_123_42_/_0.18)] bg-white/75 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--warning-foreground)]">
                  {stepId === null ? 'Manual follow-up' : `Wizard step ${stepId}`}
                </p>
                {stepId !== null && (
                  <Link
                    href={`/wizard/${stepId}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[color:var(--warning-foreground)] hover:opacity-80"
                  >
                    Go to step
                    <ArrowRightCircle className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
              <div className="space-y-1">
                {stepIssues.map((issue, index) => (
                  <p key={`${issue.label}-${index}`} className="text-sm text-[color:var(--warning-foreground)]">
                    {issue.label}
                    {issue.formPage ? ` (needed on page ${issue.formPage})` : ''}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {warningIssues.length > 0 && (
        <div className={`${blockingIssues.length > 0 ? 'mt-4' : ''} space-y-2`}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--neutral-600)]">
            <FileWarning className="h-3.5 w-3.5" />
            Manual follow-up items
          </div>
          <div className="space-y-1">
            {warningIssues.map((issue, index) => (
              <p
                key={`${issue.label}-${index}`}
                className={`text-sm ${compact ? 'text-[color:var(--neutral-700)]' : 'text-[color:var(--neutral-800)]'}`}
              >
                {issue.label}
                {issue.formPage ? ` (page ${issue.formPage})` : ''}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
