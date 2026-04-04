import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Haven",
  description: "Immigration timeline, layoff planning, and community guidance for H1B and adjacent visa holders."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
