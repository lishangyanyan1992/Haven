import type { UserDocument, VaultDocumentKind } from "@/types/domain";

export const HAVEN_VAULT_BUCKET = "haven-vault";
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

export const VAULT_ESSENTIALS: Array<{
  kind: VaultDocumentKind;
  title: string;
  detail: string;
}> = [
  {
    kind: "i140_notice",
    title: "I-140 approval notice",
    detail: "This is the first document an attorney will ask for when you need portability or backup options."
  },
  {
    kind: "h1b_petition",
    title: "H-1B petition packet",
    detail: "Keep the petition, LCA, and approval notice together so transfer counsel has a clean starting point."
  },
  {
    kind: "perm_certification",
    title: "PERM certification",
    detail: "Critical for understanding where your green card process actually stands."
  },
  {
    kind: "passport_biographic_page",
    title: "Passport biographic page",
    detail: "Needed immediately for filings, status changes, and emergency legal intake."
  }
];

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
