import type { Metadata } from "next";

import { env } from "@/lib/env";

export const siteUrl = new URL(env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

export function absoluteUrl(path = "/") {
  return new URL(path, siteUrl);
}

export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true
    }
  }
};
