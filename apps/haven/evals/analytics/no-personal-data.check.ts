/**
 * Analytics must not receive client data.
 *
 * Mixpanel used to get each person's name, email, visa type, country of birth,
 * job status and goal, the full text of every Advisor question, full URLs
 * (invite tokens and sign-up claim codes), and recordings of every session.
 * Immigration status is sensitive data, and none of it is needed to count usage.
 *
 * Asserts the URL cleaning, the blocked-property list, the init settings, and
 * that no tracking call in the app passes a personal field.
 *
 * Run: npm run check:analytics-privacy
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BLOCKED_PROPERTIES, hasRecordLikeId, sanitizePath } from "@/lib/analytics-privacy";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(here, "../../src");

let pass = 0;
const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n      ${detail}`}`);
  if (ok) pass += 1;
  else failures.push(name);
};

// URL cleaning
const paths: Array<[string, string]> = [
  ["/i/abcDEF123token", "/i/:token"],
  ["/firm/clients/3f2b8c1e-1a2b-4c3d-9e8f-0123456789ab", "/firm/clients/:id"],
  ["/reset-password?claim=839201", "/reset-password"],
  ["/advisor", "/advisor"],
  ["/community/insights", "/community/insights"],
  ["/threads/1234", "/threads/:id"],
  ["/docs/x7Kq9TzL2mN4pR8sW1", "/docs/:id"],
  ["/invite/abc", "/invite/:token"],
  ["/invite/jane@example.com", "/invite/:token"],
  ["/i/short", "/i/:token"],
  ["/firm/clients/anything", "/firm/clients/:id"],
  ["/api/advisor/threads/t1", "/api/advisor/threads/:id"],
  ["/profile/jane@example.com", "/profile/:redacted"],
  ["/profile/jane%40example.com", "/profile/:redacted"],
  ["/blog/h1b-layoff-guide", "/blog/h1b-layoff-guide"],
  ["/lawyers/smith-immigration", "/lawyers/smith-immigration"],
  ["/blog/dhs-60-day-grace-period-elimination-proposed-rule-2026", "/blog/dhs-60-day-grace-period-elimination-proposed-rule-2026"],
  ["/x/3f2b8c1e9a7d4b6c8e0f1a2b3c4d5e6f", "/x/:id"]
];
for (const [input, expected] of paths) {
  const got = sanitizePath(input);
  check(`path ${input} becomes ${expected}`, got === expected, `got ${got}`);
}

// Blocked properties
for (const prop of ["$current_url", "$pathname", "$el_attr__href", "current_url_search", "$referrer", "$initial_referrer", "visa_type", "country_of_birth", "$email", "$name"]) {
  check(`blocked: ${prop}`, (BLOCKED_PROPERTIES as readonly string[]).includes(prop));
}

// Element ids that carry record ids stop the interaction from being tracked
for (const [id, expected] of [
  ["report-note-3f2b8c1e-1a2b-4c3d-9e8f-0123456789ab", true],
  ["firm-3f2b8c1e-1a2b-4c3d-9e8f-0123456789ab", true],
  ["sponsor-12345", true],
  ["main-content", false],
  ["", false]
] as Array<[string, boolean]>) {
  check(`element id "${id || "(none)"}" ${expected ? "is" : "is not"} blocked`, hasRecordLikeId({ id }) === expected);
}
for (const prop of ["$el_id", "utm_source", "initial_utm_source"]) {
  check(`blocked: ${prop}`, (BLOCKED_PROPERTIES as readonly string[]).includes(prop));
}

// Init settings
const mixpanelSource = fs.readFileSync(path.join(src, "lib/mixpanel.ts"), "utf8");
check("screen recordings off", /record_sessions_percent:\s*0\b/.test(mixpanelSource));
check("no IP-based location", /ip:\s*false/.test(mixpanelSource));
check("built-in page views (full URL) off", /track_pageview:\s*false/.test(mixpanelSource));
check("autocapture does not record link addresses", /block_attrs:\s*\[\.\.\.BLOCKED_ELEMENT_ATTRIBUTES\]/.test(mixpanelSource));
check("autocapture does not capture element text", /capture_text_content:\s*false/.test(mixpanelSource));
check("interactions inside elements with record ids are skipped", /block_element_callback:\s*\(element: Element\) => hasRecordLikeId\(element\)/.test(mixpanelSource));
for (const [option, value] of [["track_marketing", "false"], ["skip_first_touch_marketing", "true"], ["stop_utm_persistence", "true"], ["save_referrer", "false"], ["store_google", "false"]]) {
  check(`marketing collection off: ${option}`, new RegExp(`${option}:\\s*${value}\\b`).test(mixpanelSource));
}
check("marketing settings are applied", /\.\.\.NO_MARKETING_CONFIG/.test(mixpanelSource));
check("blocked-property list is applied", /property_blacklist:\s*\[\.\.\.BLOCKED_PROPERTIES\]/.test(mixpanelSource));
check("no profile fields are set", !/people\.set\(/.test(mixpanelSource));
check("old saved details are cleared from the browser", /unregister\(/.test(mixpanelSource));
check("identify takes the id only", /export function identifyUser\(userId: string\)\s*\{/.test(mixpanelSource));

// Vercel Analytics and Speed Insights get cleaned URLs
const insightsSource = fs.readFileSync(path.join(src, "components/app/vercel-insights.tsx"), "utf8");
const layoutSource = fs.readFileSync(path.join(src, "app/layout.tsx"), "utf8");
check("Vercel Analytics cleans URLs", /<Analytics beforeSend=\{\(event\) => \(\{ \.\.\.event, url: cleanUrl\(event\.url\) \}\)\}/.test(insightsSource));
check("Speed Insights cleans URLs", /<SpeedInsights beforeSend=/.test(insightsSource));
check("layout uses the cleaned versions only", /<VercelInsights \/>/.test(layoutSource) && !/<Analytics \/>|<SpeedInsights \/>/.test(layoutSource));

// No tracking call passes a personal field
const PERSONAL_KEYS = /\b(email|\$email|\$name|full_?name|visa_?type|country_?of_?birth|employment_?status|primary_?goal|search_query|page_url|question|message_text|content)\s*:/i;
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}
const offenders: string[] = [];
for (const file of walk(src)) {
  const text = fs.readFileSync(file, "utf8");
  const calls = text.matchAll(/(trackEvent|identifyUser)\(([^;]*?)\);/gs);
  for (const call of calls) {
    if (PERSONAL_KEYS.test(call[2])) offenders.push(`${path.relative(src, file)}: ${call[0].replace(/\s+/g, " ").slice(0, 120)}`);
  }
}
check("no tracking call passes a personal field", offenders.length === 0, offenders.join("\n      "));

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
