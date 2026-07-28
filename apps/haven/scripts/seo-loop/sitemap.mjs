const XML_ENTITY_PATTERN = /&(amp|apos|gt|lt|quot);/g;

function decodeXml(value) {
  const entities = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"'
  };

  return String(value ?? "")
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replace(XML_ENTITY_PATTERN, (_, entity) => entities[entity] ?? _)
    .trim();
}

function tagValue(block, tagName) {
  const match = block.match(new RegExp(`<(?:[\\w-]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tagName}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function blocksFor(xml, tagName) {
  return [...String(xml).matchAll(new RegExp(`<(?:[\\w-]+:)?${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tagName}>`, "gi"))].map(
    (match) => match[1]
  );
}

export function parseSitemapXml(xml) {
  if (/<(?:[\w-]+:)?sitemapindex(?:\s[^>]*)?>/i.test(xml)) {
    return {
      type: "index",
      entries: blocksFor(xml, "sitemap")
        .map((block) => ({
          url: tagValue(block, "loc"),
          lastModified: tagValue(block, "lastmod") || null
        }))
        .filter((entry) => entry.url)
    };
  }

  return {
    type: "urlset",
    entries: blocksFor(xml, "url")
      .map((block) => {
        const priorityValue = tagValue(block, "priority");
        const priority = priorityValue === "" ? null : Number(priorityValue);
        return {
          url: tagValue(block, "loc"),
          lastModified: tagValue(block, "lastmod") || null,
          changeFrequency: tagValue(block, "changefreq") || null,
          priority: priority !== null && Number.isFinite(priority) ? priority : null
        };
      })
      .filter((entry) => entry.url)
  };
}

function validateSitemapUrl(value, expectedOrigin) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`Unsupported sitemap URL protocol: ${url.protocol}`);
  }
  if (expectedOrigin && url.origin !== expectedOrigin) {
    throw new Error(`Sitemap index referenced a different origin: ${url.origin}`);
  }
  return url;
}

async function fetchSitemapDocument(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/xml,text/xml;q=0.9,*/*;q=0.1",
      "User-Agent": "Haven-SEO-Monitor/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Sitemap request failed (${response.status}) for ${url}`);
  }

  return response.text();
}

export async function fetchSitemapEntries({
  sitemapUrl,
  fetchImpl = fetch,
  maxSitemaps = 50,
  maxUrls = 2000
}) {
  const root = validateSitemapUrl(sitemapUrl);
  const queue = [root.toString()];
  const visitedSitemaps = new Set();
  const entriesByUrl = new Map();

  while (queue.length && visitedSitemaps.size < maxSitemaps && entriesByUrl.size < maxUrls) {
    const current = queue.shift();
    if (visitedSitemaps.has(current)) continue;
    visitedSitemaps.add(current);

    const xml = await fetchSitemapDocument(current, fetchImpl);
    const parsed = parseSitemapXml(xml);

    if (parsed.type === "index") {
      for (const entry of parsed.entries) {
        const child = validateSitemapUrl(entry.url, root.origin).toString();
        if (!visitedSitemaps.has(child)) queue.push(child);
      }
      continue;
    }

    for (const entry of parsed.entries) {
      if (entriesByUrl.size >= maxUrls) break;
      const url = validateSitemapUrl(entry.url, root.origin).toString();
      entriesByUrl.set(url, { ...entry, url, sourceSitemap: current });
    }
  }

  return {
    sitemapUrl: root.toString(),
    sitemapCount: visitedSitemaps.size,
    truncated: queue.length > 0 || entriesByUrl.size >= maxUrls,
    entries: [...entriesByUrl.values()]
  };
}
