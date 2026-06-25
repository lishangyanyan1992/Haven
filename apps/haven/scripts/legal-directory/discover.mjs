// Stage 1 — discover candidate firms via the official Google Places API.
//
//   GOOGLE_PLACES_API_KEY=... node discover.mjs [--limit N]
//
// Writes work/01-discovered.json: one record per firm with place_id, name,
// website, phone, rating, reviewCount, city, state, metro.

import { mkdir, writeFile } from "node:fs/promises";

import { GOOGLE_PLACES_API_KEY, METROS, WORK_DIR, sleep, slugify } from "./config.mjs";

const limitArg = process.argv.indexOf("--limit");
const LIMIT = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

const PLACES_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus"
].join(",");

async function searchText(query) {
  const res = await fetch(PLACES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": FIELD_MASK
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 20 })
  });
  if (!res.ok) {
    throw new Error(`Places API ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return json.places ?? [];
}

// "123 Main St, San Jose, CA 95113, USA" -> { city: "San Jose", state: "CA" }
function parseCityState(address) {
  const parts = (address ?? "").split(",").map((p) => p.trim());
  const stateZip = parts.at(-2) ?? "";
  const state = stateZip.split(/\s+/)[0] ?? "";
  const city = parts.at(-3) ?? "";
  return { city, state };
}

async function main() {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("Set GOOGLE_PLACES_API_KEY in the environment before running discover.mjs");
  }
  await mkdir(WORK_DIR, { recursive: true });

  const byPlaceId = new Map();
  for (const { metro, state, queries } of METROS) {
    for (const query of queries) {
      console.log(`Searching: ${query}`);
      const places = await searchText(query);
      for (const place of places) {
        if (place.businessStatus && place.businessStatus !== "OPERATIONAL") continue;
        if (byPlaceId.has(place.id)) continue;
        const name = place.displayName?.text ?? "";
        if (!name) continue;
        const parsed = parseCityState(place.formattedAddress);
        byPlaceId.set(place.id, {
          placeId: place.id,
          id: slugify(name),
          firmName: name,
          metro,
          city: parsed.city,
          state: parsed.state || state,
          website: place.websiteUri ?? "",
          phone: place.nationalPhoneNumber ?? null,
          rating: place.rating ?? null,
          reviewCount: place.userRatingCount ?? null
        });
        if (byPlaceId.size >= LIMIT) break;
      }
      await sleep(250); // be gentle
      if (byPlaceId.size >= LIMIT) break;
    }
    if (byPlaceId.size >= LIMIT) break;
  }

  const firms = [...byPlaceId.values()];
  await writeFile(`${WORK_DIR}/01-discovered.json`, JSON.stringify(firms, null, 2));
  console.log(`Discovered ${firms.length} firms -> work/01-discovered.json`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
