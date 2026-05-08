import { env } from "@/lib/env";
import { absoluteUrl, siteUrl } from "@/lib/seo";

const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

export function isIndexNowEnabled() {
  return Boolean(env.INDEXNOW_KEY);
}

export function getIndexNowKeyLocation() {
  return absoluteUrl("/api/indexnow-key").toString();
}

export async function submitIndexNowUrls(urls: string[]) {
  if (!env.INDEXNOW_KEY) {
    return { ok: false as const, reason: "missing_key" as const };
  }

  const allowedUrls = urls
    .map((url) => {
      try {
        return new URL(url);
      } catch {
        return null;
      }
    })
    .filter((url): url is URL => Boolean(url))
    .filter((url) => url.host === siteUrl.host)
    .map((url) => url.toString());

  if (allowedUrls.length === 0) {
    return { ok: false as const, reason: "no_matching_urls" as const };
  }

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify({
      host: siteUrl.host,
      key: env.INDEXNOW_KEY,
      keyLocation: getIndexNowKeyLocation(),
      urlList: allowedUrls
    })
  });

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText
  };
}
