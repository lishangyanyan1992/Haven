import sponsorDirectoryData from "@/data/sponsor-directory.json";
import type { SponsorCompany } from "@/components/app/sponsor-directory";

export type SponsorSource = {
  label: string;
  name: string;
  recordCount: number;
  url: string;
};

type SponsorDirectoryData = {
  companies: SponsorCompany[];
  generatedAt: string;
  sources: SponsorSource[];
};

const data = sponsorDirectoryData as SponsorDirectoryData;

export function getSponsorCompanies(): SponsorCompany[] {
  return data.companies;
}

export function getSponsorCompany(id: string): SponsorCompany | undefined {
  return data.companies.find((company) => company.id === id);
}

export function getSponsorSources(): SponsorSource[] {
  return data.sources;
}

export function getSponsorGeneratedAt(): string {
  return data.generatedAt;
}

export function getCompanyPath(id: string): string {
  return `/jobs/${id}`;
}
