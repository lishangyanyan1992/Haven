"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { validatePetition, type PetitionFieldError } from "@/lib/petitions";
import { savePetitionsAction } from "@/server/petition-actions";
import type {
  ImmigrantPetition,
  ImmigrantPetitionStage,
  ImmigrantPetitionType,
  PetitionEndedReason,
  PreferenceCategory
} from "@/types/domain";

const TYPE_OPTIONS: { value: ImmigrantPetitionType; label: string }[] = [
  { value: "employer_sponsored", label: "Employer-sponsored (PERM)" },
  { value: "self_petition_niw", label: "Self-petition: EB-2 NIW" },
  { value: "self_petition_eb1a", label: "Self-petition: EB-1A" },
  { value: "concurrent_employer", label: "Second employer, at the same time" }
];

const STAGE_OPTIONS: { value: ImmigrantPetitionStage; label: string }[] = [
  { value: "pwd_recruitment", label: "Prevailing wage / recruitment" },
  { value: "perm_in_progress", label: "PERM filed, waiting" },
  { value: "perm_certified", label: "PERM approved" },
  { value: "i140_filed", label: "I-140 filed" },
  { value: "i140_approved", label: "I-140 approved" },
  { value: "i485_filed", label: "I-485 filed" },
  { value: "i485_approved", label: "Green card approved" }
];

const CATEGORY_OPTIONS: PreferenceCategory[] = ["EB-1", "EB-2", "EB-2 NIW", "EB-3", "Not sure"];

const ENDED_OPTIONS: { value: "" | PetitionEndedReason; label: string }[] = [
  { value: "", label: "Still moving forward" },
  { value: "layoff", label: "Ended: laid off" },
  { value: "job_change", label: "Ended: changed jobs" },
  { value: "withdrawn", label: "Ended: employer withdrew it" },
  { value: "denied", label: "Ended: denied" },
  { value: "other", label: "Ended: other reason" }
];

type DateField = "permFilingDate" | "permCertifiedDate" | "i140FiledDate" | "i140ApprovalDate" | "priorityDate";

const DATE_FIELDS: { key: DateField; label: string }[] = [
  { key: "permFilingDate", label: "PERM filed" },
  { key: "permCertifiedDate", label: "PERM approved" },
  { key: "i140FiledDate", label: "I-140 filed" },
  { key: "i140ApprovalDate", label: "I-140 approved" },
  { key: "priorityDate", label: "Priority date" }
];

function newPetition(): ImmigrantPetition {
  const id = `pet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    sponsorName: "",
    petitionType: "employer_sponsored",
    preferenceCategory: "EB-2",
    stage: "pwd_recruitment"
  };
}

function clean(p: ImmigrantPetition): ImmigrantPetition {
  const out = { ...p } as Record<string, unknown>;
  for (const [k, v] of Object.entries(out)) if (v === "" || v === undefined) delete out[k];
  return out as unknown as ImmigrantPetition;
}

function FieldError({ errors, field }: { errors: PetitionFieldError[]; field: keyof ImmigrantPetition }) {
  const match = errors.filter((e) => e.field === field);
  if (match.length === 0) return null;
  return <p className="mt-1 text-[12px] text-[var(--haven-blush-ink)]">{match.map((e) => e.message).join(" ")}</p>;
}

/** Settings section to add, edit, end and remove green cards. */
export function GreenCardEditor({ initialPetitions }: { initialPetitions: ImmigrantPetition[] }) {
  const router = useRouter();
  const [petitions, setPetitions] = useState<ImmigrantPetition[]>(initialPetitions);
  const [serverErrors, setServerErrors] = useState<Record<string, PetitionFieldError[]>>({});
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [isPending, startTransition] = useTransition();

  const update = (id: string, patch: Partial<ImmigrantPetition>) => {
    setPetitions((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    // An edit replaces whatever the server said about this green card.
    setServerErrors((prev) => {
      if (!prev[id]) return prev;
      const { [id]: _removed, ...rest } = prev;
      return rest;
    });
    setMessage(null);
  };

  const errorsFor = (p: ImmigrantPetition) => [...validatePetition(clean(p)), ...(serverErrors[p.id] ?? [])];

  const save = () => {
    setShowErrors(true);
    const cleaned = petitions.map(clean);
    if (cleaned.some((p) => validatePetition(p).length > 0)) {
      setMessage({ tone: "error", text: "Fix the highlighted fields, then save." });
      return;
    }
    startTransition(async () => {
      try {
        const result = await savePetitionsAction(cleaned);
        if (result.ok) {
          setPetitions(result.petitions);
          setServerErrors({});
          setShowErrors(false);
          setMessage({ tone: "ok", text: "Green cards saved. Your dashboard now uses them." });
          router.refresh();
        } else {
          setServerErrors(result.fieldErrors ?? {});
          setMessage({ tone: "error", text: result.error });
        }
      } catch {
        setMessage({ tone: "error", text: "We couldn't save your green cards. Try again in a moment." });
      }
    });
  };

  return (
    <Card id="green-cards">
      <CardHeader>
        <div>
          <p className="text-label">Green cards</p>
          <CardTitle className="mt-2">Every green card filed for you</CardTitle>
          <p className="mt-2 text-body-sm text-[var(--color-text-secondary)]">
            Add one for each employer or self-petition, including ones that ended. An approved I-140 keeps your
            priority date even after the job ends.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {petitions.length === 0 && (
          <p className="text-body-sm text-[var(--haven-ink-mid)]">No green cards added yet.</p>
        )}

        {petitions.map((p, index) => {
          const errors = showErrors ? errorsFor(p) : serverErrors[p.id] ?? [];
          const isEnded = Boolean(p.endedReason);
          return (
            <fieldset
              key={p.id}
              className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-cream)] p-4"
            >
              <legend className="sr-only">Green card {index + 1}</legend>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <label className="text-label" htmlFor={`${p.id}-sponsor`}>
                    Employer or petitioner
                  </label>
                  <Input
                    id={`${p.id}-sponsor`}
                    value={p.sponsorName}
                    placeholder="e.g. Acme Robotics"
                    onChange={(e) => update(p.id, { sponsorName: e.target.value })}
                  />
                  <FieldError errors={errors} field="sponsorName" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={`Remove ${p.sponsorName || "this green card"}`}
                  onClick={() => {
                    if (window.confirm("Remove this green card? Use this only for one added by mistake. To keep its history, mark it ended instead.")) {
                      setPetitions((list) => list.filter((x) => x.id !== p.id));
                      setMessage(null);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <div>
                  <label className="text-label" htmlFor={`${p.id}-type`}>Type</label>
                  <Select
                    id={`${p.id}-type`}
                    value={p.petitionType}
                    onChange={(e) => update(p.id, { petitionType: e.target.value as ImmigrantPetitionType })}
                  >
                    {TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-label" htmlFor={`${p.id}-category`}>Category</label>
                  <Select
                    id={`${p.id}-category`}
                    value={p.preferenceCategory}
                    onChange={(e) => update(p.id, { preferenceCategory: e.target.value as PreferenceCategory })}
                  >
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="text-label" htmlFor={`${p.id}-stage`}>Furthest step reached</label>
                  <Select
                    id={`${p.id}-stage`}
                    value={p.stage === "withdrawn" ? "i140_approved" : p.stage}
                    onChange={(e) => update(p.id, { stage: e.target.value as ImmigrantPetitionStage })}
                  >
                    {STAGE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 xl:grid-cols-3">
                {DATE_FIELDS.map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-label" htmlFor={`${p.id}-${key}`}>{label}</label>
                    <Input
                      id={`${p.id}-${key}`}
                      type="date"
                      value={p[key] ?? ""}
                      onChange={(e) => update(p.id, { [key]: e.target.value || undefined })}
                    />
                    <FieldError errors={errors} field={key} />
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 text-body-sm text-[var(--haven-ink-mid)]">
                <input
                  type="checkbox"
                  checked={Boolean(p.isPriorityDateRecaptured)}
                  onChange={(e) => update(p.id, { isPriorityDateRecaptured: e.target.checked || undefined })}
                />
                Priority date carried over from an earlier green card
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-label" htmlFor={`${p.id}-ended`}>Status</label>
                  <Select
                    id={`${p.id}-ended`}
                    value={p.endedReason ?? ""}
                    onChange={(e) =>
                      update(p.id, {
                        endedReason: (e.target.value || undefined) as PetitionEndedReason | undefined,
                        // Clearing the status also clears an older "withdrawn" stage,
                        // which would otherwise mark it ended again on save.
                        ...(e.target.value
                          ? {}
                          : { endedDate: undefined, ...(p.stage === "withdrawn" ? { stage: "i140_approved" as const } : {}) })
                      })
                    }
                  >
                    {ENDED_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                </div>
                {isEnded && (
                  <div>
                    <label className="text-label" htmlFor={`${p.id}-endedDate`}>Date it ended</label>
                    <Input
                      id={`${p.id}-endedDate`}
                      type="date"
                      value={p.endedDate ?? ""}
                      onChange={(e) => update(p.id, { endedDate: e.target.value || undefined })}
                    />
                    <FieldError errors={errors} field="endedDate" />
                  </div>
                )}
              </div>
            </fieldset>
          );
        })}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPetitions((list) => [...list, newPetition()]);
              setMessage(null);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Add a green card
          </Button>
          <Button type="button" disabled={isPending} onClick={save}>
            {isPending ? "Saving..." : "Save green cards"}
          </Button>
          {message && (
            <p
              role="status"
              className={
                message.tone === "ok"
                  ? "text-body-sm text-[var(--haven-ink)]"
                  : "text-body-sm text-[var(--haven-blush-ink)]"
              }
            >
              {message.text}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
