import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import "@/app/globals.css";
import { MixpanelProvider } from "@/components/app/mixpanel-provider";
import { siteUrl } from "@/lib/seo";
import { getOrganizationStructuredData, getWebsiteStructuredData } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: "Haven",
    template: "%s | Haven"
  },
  description: "Immigration timeline, layoff planning, and community guidance for H-1B and adjacent visa holders.",
  applicationName: "Haven",
  openGraph: {
    type: "website",
    siteName: "Haven",
    url: siteUrl,
    title: "Haven",
    description: "Immigration timeline, layoff planning, and community guidance for H-1B and adjacent visa holders."
  },
  twitter: {
    card: "summary_large_image",
    title: "Haven",
    description: "Immigration timeline, layoff planning, and community guidance for H-1B and adjacent visa holders."
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const organizationStructuredData = getOrganizationStructuredData();
  const websiteStructuredData = getWebsiteStructuredData();

  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationStructuredData) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteStructuredData) }}
        />
        {children}
        <MixpanelProvider />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
