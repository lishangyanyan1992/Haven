/**
 * The Advisor's topic buckets.
 *
 * Extracted from `service.ts` so the guardrail registry can key on topics without
 * importing the service (which imports the registry). The list itself is unchanged
 * — CD-12.1 still wants it re-derived from a real corpus rather than intuition.
 */
export const TOPIC_BUCKETS = [
  "h1b",
  "visa-bulletin",
  "perm",
  "adjustment-of-status",
  "job-change",
  "layoffs",
  "student-status",
  "self-petition",
  "cspa",
  "work-authorization",
  "haven-product"
] as const;

export type TopicBucket = (typeof TOPIC_BUCKETS)[number];
