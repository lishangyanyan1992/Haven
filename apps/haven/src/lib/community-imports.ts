import { getConfirmedCommunityLabels, isCountryCommunityLabel, sortCommunityLabels } from "@/lib/community-labels";
import type { Json } from "@/types/database";

export type PublishedCommentDraft = {
  authorLabel: string;
  authorKey: string;
  body: string;
};

export type PublishDraft = {
  publicAuthorLabel: string;
  publicAuthorKey: string;
  title: string;
  body: string;
  tags: string[];
  comments: PublishedCommentDraft[];
  publishReady: boolean;
  moderationFlags: string[];
  privacyFlags: string[];
};

function stableNumber(seed: string, min: number, max: number) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return min + (hash % (max - min + 1));
}

export function buildAnonymousCommentAuthor(index: number, seed = "") {
  const personas = [
    "Community member",
    "Fellow applicant",
    "Forum member",
    "Case sharer",
    "Timeline reader",
    "Status tracker",
    "Visa peer",
    "Immigration peer"
  ];
  const stableSeed = seed || `comment:${index + 1}`;
  const persona = personas[stableNumber(`${stableSeed}:persona`, 0, personas.length - 1)] ?? "Community member";
  const suffix = stableNumber(`${stableSeed}:suffix`, 100, 999);

  return `${persona} ${suffix}`;
}

function normalizeImportedAuthorName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function isOpaqueImportedAuthorName(value: string) {
  const normalized = normalizeImportedAuthorName(value);
  return (
    !normalized ||
    normalized === "[deleted]" ||
    normalized === "deleted" ||
    normalized === "anonymous" ||
    normalized === "unknown" ||
    normalized === "reddit user" ||
    normalized === "community member" ||
    normalized === "member" ||
    normalized === "user" ||
    /^haven_user_\d+$/.test(normalized)
  );
}

export function buildImportedAuthorKey(params: {
  authorName?: unknown;
  fallbackSeed: string;
}) {
  const authorName = readString(params.authorName);

  if (authorName && !isOpaqueImportedAuthorName(authorName)) {
    return `author:${normalizeImportedAuthorName(authorName)}`;
  }

  return `story:${params.fallbackSeed.trim().toLowerCase()}`;
}

function readObject(value: Json | undefined) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeSourceTimestamp(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    const milliseconds = value > 100000000000 ? value : value * 1000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const raw = readString(value);
  if (!raw) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T12:00:00.000Z`;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function readSourcePublishedAt(sourcePayloadPrivate?: Json) {
  const source = readObject(sourcePayloadPrivate);
  return (
    normalizeSourceTimestamp(source.source_created_at) ??
    normalizeSourceTimestamp(source.posted_at) ??
    normalizeSourceTimestamp(source.published_at) ??
    normalizeSourceTimestamp(source.created_at) ??
    normalizeSourceTimestamp(source.created_utc) ??
    normalizeSourceTimestamp(source.date)
  );
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((entry) => (typeof entry === "string" ? entry.trim() : "")).filter(Boolean)
    : [];
}

function normalizeSentence(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function normalizeNarrativeBody(body: string) {
  return body
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildFallbackBody(draft: Record<string, unknown>) {
  const situationSummary = readString(draft.situation_summary);
  const actionsTaken = readStringArray(draft.actions_taken);
  const outcomeSummary = readString(draft.outcome_summary);
  const communityTakeaways = readStringArray(draft.community_takeaways);

  const sections: string[] = [];

  if (situationSummary) {
    sections.push(normalizeSentence(situationSummary));
  }

  const actionsAndOutcome: string[] = [];
  if (actionsTaken.length > 0) {
    actionsAndOutcome.push(`Actions taken: ${actionsTaken.map(normalizeSentence).join(" ")}`);
  }
  if (outcomeSummary) {
    actionsAndOutcome.push(`Outcome: ${normalizeSentence(outcomeSummary)}`);
  }
  if (actionsAndOutcome.length > 0) {
    sections.push(actionsAndOutcome.join(" "));
  }

  if (communityTakeaways.length > 0) {
    sections.push(`Takeaways: ${communityTakeaways.map(normalizeSentence).join(" ")}`);
  }

  const conciseBody = sections.join("\n\n").trim();
  return conciseBody;
}

function readPublishedComments(value: unknown, sourcePayloadPrivate?: Json, sourceStoryId?: string) {
  if (!Array.isArray(value)) {
    return [] as PublishedCommentDraft[];
  }

  const sourceComments = Array.isArray(readObject(sourcePayloadPrivate).comments)
    ? (readObject(sourcePayloadPrivate).comments as unknown[])
    : [];

  return value
    .map((comment, index) => {
      const sourceComment = sourceComments[index] as Json | undefined;
      const sourceCommentId = readString(readObject(sourceComment).id) || String(index + 1);
      const fallbackSeed = `${sourceStoryId || "unknown-story"}:comment:${sourceCommentId}`;

      if (typeof comment === "string") {
        const body = comment.trim();
        return body
          ? {
              authorLabel: buildAnonymousCommentAuthor(index, fallbackSeed),
              authorKey: buildImportedAuthorKey({
                authorName: readObject(sourceComment).author,
                fallbackSeed
              }),
              body
            }
          : null;
      }

      if (typeof comment !== "object" || comment === null) {
        return null;
      }

      const record = comment as Record<string, unknown>;
      const body = readString(record.body);
      const explicitAuthorLabel = readString(record.author_label);

      if (!body) {
        return null;
      }

      return {
        authorLabel:
          explicitAuthorLabel && !isOpaqueImportedAuthorName(explicitAuthorLabel)
            ? explicitAuthorLabel
            : buildAnonymousCommentAuthor(index, fallbackSeed),
        authorKey:
          readString(record.author_key) ||
          buildImportedAuthorKey({
            authorName: readObject(sourceComment).author ?? record.author_label,
            fallbackSeed
          }),
        body
      };
    })
    .filter((comment): comment is PublishedCommentDraft => Boolean(comment));
}

function readSourceComments(value: Json | undefined, sourceStoryId?: string) {
  const sourcePayload = readObject(value);
  const comments = Array.isArray(sourcePayload.comments) ? sourcePayload.comments : [];

  return comments
    .map((comment, index) => {
      if (typeof comment !== "object" || comment === null) {
        return null;
      }

      const record = comment as Record<string, unknown>;
      const translatedBody = readString(record.body_translated);
      const originalBody = readString(record.body);
      const body = translatedBody || originalBody;

      if (!body) {
        return null;
      }

      return {
        authorLabel: buildAnonymousCommentAuthor(
          index,
          `${sourceStoryId || "unknown-story"}:comment:${readString(record.id) || index + 1}`
        ),
        authorKey: buildImportedAuthorKey({
          authorName: record.author,
          fallbackSeed: `${sourceStoryId || "unknown-story"}:comment:${readString(record.id) || index + 1}`
        }),
        body: normalizeNarrativeBody(body)
      };
    })
    .filter((comment): comment is PublishedCommentDraft => Boolean(comment));
}

function readSourceCountryTags(sourcePayloadPrivate: Json | undefined) {
  const source = readObject(sourcePayloadPrivate);
  const originalTitle = readString(source.title);
  const originalBody = readString(source.body);

  if (!originalTitle && !originalBody) {
    return [] as string[];
  }

  return getConfirmedCommunityLabels({ title: originalTitle, body: originalBody, tags: [] }).filter(isCountryCommunityLabel);
}

export function readPublishDraft(
  value: Json,
  sourcePayloadPrivate?: Json,
  sourceStoryId?: string
): PublishDraft {
  const draft = readObject(value);
  const draftBody = readString(draft.body);
  const normalizedDraftBody = normalizeNarrativeBody(draftBody);
  const sourceCountryTags = readSourceCountryTags(sourcePayloadPrivate);
  const sourcePayload = readObject(sourcePayloadPrivate);
  const publicComments = readPublishedComments(draft.comments, sourcePayloadPrivate, sourceStoryId);
  const tags = sortCommunityLabels(
    Array.from(new Set([...readStringArray(draft.tags), ...sourceCountryTags]))
  );

  return {
    publicAuthorLabel: readString(draft.public_author_label) || "Haven_User_000",
    publicAuthorKey:
      readString(draft.public_author_key) ||
      buildImportedAuthorKey({
        authorName: sourcePayload.author_name,
        fallbackSeed: `${sourceStoryId || "unknown-story"}:post`
      }),
    title: readString(draft.title),
    body: normalizedDraftBody || buildFallbackBody(draft),
    tags,
    comments: publicComments.length > 0 ? publicComments : readSourceComments(sourcePayloadPrivate, sourceStoryId),
    publishReady: Boolean(draft.publish_ready),
    moderationFlags: readStringArray(draft.moderation_flags),
    privacyFlags: readStringArray(draft.privacy_flags)
  };
}
