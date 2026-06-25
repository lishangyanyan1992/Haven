import lawFirmDirectoryData from "@/data/law-firm-directory.json";
import type { LawFirm } from "@/components/app/legal-directory";

export type LegalSource = {
  label: string;
  name: string;
  recordCount: number;
  url: string;
};

type LegalDirectoryData = {
  firms: LawFirm[];
  generatedAt: string;
  isSampleData?: boolean;
  sources: LegalSource[];
};

const data = lawFirmDirectoryData as LegalDirectoryData;

export function getLawFirms(): LawFirm[] {
  return data.firms;
}

export function getLawFirm(id: string): LawFirm | undefined {
  return data.firms.find((firm) => firm.id === id);
}

export function getLegalSources(): LegalSource[] {
  return data.sources;
}

export function getLegalGeneratedAt(): string {
  return data.generatedAt;
}

export function isLegalSampleData(): boolean {
  return Boolean(data.isSampleData);
}

export function getFirmPath(id: string): string {
  return `/lawyers/${id}`;
}
