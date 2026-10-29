import type { RequiredDocumentItem } from "@/lib/firms/types";
import type { UserDocument, VaultDocumentKind } from "@/types/domain";

export const HAVEN_VAULT_BUCKET = "haven-vault";
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

export type PresetRequiredDocument = {
  key: string;
  label: string;
  detail: string;
  crisisCritical?: boolean;
};

export const PRESET_REQUIRED_DOCUMENTS: PresetRequiredDocument[] = [
  {
    key: "passport_biographic_page",
    label: "Passport biographic page",
    detail: "Needed immediately for filings, status changes, and emergency legal intake.",
    crisisCritical: true
  },
  {
    key: "i94_record",
    label: "Most recent I-94",
    detail: "Proof of legal status and lawful admission into the United States.",
    crisisCritical: true
  },
  {
    key: "uscis_notice",
    label: "I-797 approval / receipt notice",
    detail: "Official notice of action from USCIS for pending or approved petitions.",
    crisisCritical: false
  },
  {
    key: "h1b_petition",
    label: "H-1B petition packet",
    detail: "Petition, LCA, and approval notice together for transfer or extension counsel.",
    crisisCritical: true
  },
  {
    key: "i140_notice",
    label: "I-140 approval notice",
    detail: "First document needed for AC-21 portability, H-4 EAD eligibility, or priority date retention.",
    crisisCritical: true
  },
  {
    key: "perm_certification",
    label: "PERM certification",
    detail: "Labor certification record from the Department of Labor.",
    crisisCritical: true
  },
  {
    key: "ead_card",
    label: "EAD card",
    detail: "Employment Authorization Document front and back.",
    crisisCritical: false
  },
  {
    key: "paystub",
    label: "Recent paystubs or W-2",
    detail: "Recent proof of active employment and wage compliance.",
    crisisCritical: false
  },
  {
    key: "visa_stamp",
    label: "Visa foil / stamp",
    detail: "Entry visa stamp foil inside your passport.",
    crisisCritical: false
  },
  {
    key: "i20_form",
    label: "Form I-20 or DS-2019",
    detail: "Certificate of eligibility for nonimmigrant student or exchange visitor status.",
    crisisCritical: false
  },
  {
    key: "other",
    label: "Other supporting document",
    detail: "Any other supporting notice, letter, or immigration filing.",
    crisisCritical: false
  }
];

export const DEFAULT_PRESET_KEYS = [
  "passport_biographic_page",
  "i94_record",
  "uscis_notice",
  "h1b_petition"
];

/**
 * Presets that belong to one sponsor. I-140 and PERM are asked per green card
 * sponsor; the H-1B packet is asked for the current H-1B employer.
 */
export const SPONSOR_TIED_PRESET_KEYS = ["i140_notice", "perm_certification", "h1b_petition"] as const;

/** Whether a required document is asked once per sponsor. Presets default by type; custom items opt in. */
export function isPerSponsor(item: Pick<RequiredDocumentItem, "key" | "perSponsor">): boolean {
  if (typeof item.perSponsor === "boolean") return item.perSponsor;
  return (SPONSOR_TIED_PRESET_KEYS as readonly string[]).includes(item.key);
}

export function getDefaultRequiredDocuments(): RequiredDocumentItem[] {
  return DEFAULT_PRESET_KEYS.map((key) => {
    const preset = PRESET_REQUIRED_DOCUMENTS.find((p) => p.key === key);
    return {
      key,
      label: preset?.label ?? key,
      isCustom: false,
      perSponsor: isPerSponsor({ key })
    };
  });
}

export function findPresetDocument(key: string): PresetRequiredDocument | undefined {
  return PRESET_REQUIRED_DOCUMENTS.find((p) => p.key === key);
}

export function slugifyCustomKey(label: string): string {
  const sanitized = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `custom_${sanitized || "document"}`;
}

export function validateRequiredDocumentList(items: unknown): { ok: true; items: RequiredDocumentItem[] } | { ok: false; error: string } {
  if (!Array.isArray(items)) {
    return { ok: false, error: "Required documents must be a list." };
  }
  if (items.length === 0) {
    return { ok: false, error: "Please select at least one required document." };
  }
  if (items.length > 25) {
    return { ok: false, error: "You can specify at most 25 required documents." };
  }

  const seenKeys = new Set<string>();
  const validated: RequiredDocumentItem[] = [];

  for (const raw of items) {
    if (typeof raw !== "object" || !raw) continue;
    const label = typeof (raw as any).label === "string" ? (raw as any).label.trim() : "";
    if (!label || label.length > 80) {
      return { ok: false, error: "Document labels must be between 1 and 80 characters." };
    }

    const isCustom = Boolean((raw as any).isCustom);
    let key = typeof (raw as any).key === "string" ? (raw as any).key.trim() : "";
    if (!key) {
      key = slugifyCustomKey(label);
    }

    // Ensure uniqueness
    let finalKey = key;
    let counter = 2;
    while (seenKeys.has(finalKey)) {
      finalKey = `${key}_${counter}`;
      counter += 1;
    }
    seenKeys.add(finalKey);

    const custom = isCustom || finalKey.startsWith("custom_");
    const rawPerSponsor = (raw as any).perSponsor;
    validated.push({
      key: finalKey,
      label,
      isCustom: custom,
      // Custom items are per client unless the lawyer ticks "Tied to a sponsor".
      perSponsor: typeof rawPerSponsor === "boolean" ? rawPerSponsor : custom ? false : isPerSponsor({ key: finalKey })
    });
  }

  if (validated.length === 0) {
    return { ok: false, error: "Please select at least one valid required document." };
  }

  return { ok: true, items: validated };
}

export const VAULT_ESSENTIALS: Array<{
  kind: VaultDocumentKind;
  title: string;
  detail: string;
}> = PRESET_REQUIRED_DOCUMENTS.slice(0, 4).map((preset) => ({
  kind: preset.key as VaultDocumentKind,
  title: preset.label,
  detail: preset.detail
}));

export function inferDocumentMetadata(fileName: string, mimeType?: string | null, customLabel?: string | null) {
  const normalized = `${fileName} ${mimeType ?? ""}`.toLowerCase();

  if (/i[\s-]?140|140 approval|immigrant petition/.test(normalized)) {
    return {
      documentKind: "i140_notice" as const,
      displayLabel: customLabel?.trim() || "I-140 approval notice",
      crisisCritical: true
    };
  }

  if (/h[\s-]?1b|i[\s-]?129|lca|labor condition application/.test(normalized)) {
    return {
      documentKind: "h1b_petition" as const,
      displayLabel: customLabel?.trim() || "H-1B petition packet",
      crisisCritical: true
    };
  }

  if (/perm|eta[\s-]?9089|labor certification/.test(normalized)) {
    return {
      documentKind: "perm_certification" as const,
      displayLabel: customLabel?.trim() || "PERM certification",
      crisisCritical: true
    };
  }

  if (/passport/.test(normalized)) {
    return {
      documentKind: "passport_biographic_page" as const,
      displayLabel: customLabel?.trim() || "Passport biographic page",
      crisisCritical: true
    };
  }

  if (/i[\s-]?94\b|arrival record|admission record/.test(normalized)) {
    return {
      documentKind: "i94_record" as const,
      displayLabel: customLabel?.trim() || "Most recent I-94",
      crisisCritical: true
    };
  }

  if (/i[\s-]?20\b|certificate of eligibility|ds[\s-]?2019/.test(normalized)) {
    const isDs2019 = /ds[\s-]?2019/.test(normalized);
    return {
      documentKind: "i20_form" as const,
      displayLabel: customLabel?.trim() || (isDs2019 ? "Form DS-2019" : "Form I-20"),
      crisisCritical: false
    };
  }

  if (/i[\s-]?797|receipt|uscis notice|approval notice/.test(normalized)) {
    return {
      documentKind: "uscis_notice" as const,
      displayLabel: customLabel?.trim() || "USCIS notice",
      crisisCritical: false
    };
  }

  if (/paystub|pay stub|w[\s-]?2/.test(normalized)) {
    return {
      documentKind: "paystub" as const,
      displayLabel: customLabel?.trim() || "Paystub or W-2",
      crisisCritical: false
    };
  }

  if (/visa stamp|stamp/.test(normalized)) {
    return {
      documentKind: "visa_stamp" as const,
      displayLabel: customLabel?.trim() || "Visa stamp",
      crisisCritical: false
    };
  }

  if (/ead|employment authorization/.test(normalized)) {
    return {
      documentKind: "ead_card" as const,
      displayLabel: customLabel?.trim() || "EAD card",
      crisisCritical: false
    };
  }

  if (/attorney|lawyer|counsel/.test(normalized)) {
    return {
      documentKind: "attorney_letter" as const,
      displayLabel: customLabel?.trim() || "Attorney correspondence",
      crisisCritical: false
    };
  }

  return {
    documentKind: "other" as const,
    displayLabel: customLabel?.trim() || "Immigration document",
    crisisCritical: false
  };
}

/**
 * MIME types accepted for document uploads.
 * We allow common document and image formats only — no executables or scripts.
 */
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "text/plain",
]);

export function isAllowedMimeType(mimeType: string): boolean {
  // Normalise: strip parameters (e.g. "application/pdf; charset=utf-8")
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return ALLOWED_MIME_TYPES.has(base);
}

export function sanitizeFilename(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 104857.6) / 10} MB`;
}

export function getMissingVaultEssentials(documents: UserDocument[]) {
  const presentKinds = new Set(documents.map((document) => document.documentKind));
  return VAULT_ESSENTIALS.filter((item) => !presentKinds.has(item.kind));
}
