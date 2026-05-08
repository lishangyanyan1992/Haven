import { getConfirmedCommunityLabels, isCountryCommunityLabel, sortCommunityLabels } from "@/lib/community-labels";
import type { Json } from "@/types/database";

export type PublishedCommentDraft = {
  authorLabel: string;
  body: string;
};

export type PublishDraft = {
  publicAuthorLabel: string;
  title: string;
  body: string;
  tags: string[];
  comments: PublishedCommentDraft[];
  publishReady: boolean;
  moderationFlags: string[];
  privacyFlags: string[];
};

export function buildAnonymousCommentAuthor(index: number) {
  return `Haven_User_${String(index + 1).padStart(3, "0")}`;
}

function readObject(value: Json | undefined) {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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

function readPublishedComments(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as PublishedCommentDraft[];
  }

  return value
    .map((comment, index) => {
      if (typeof comment === "string") {
        const body = comment.trim();
        return body ? { authorLabel: `Community member ${index + 1}`, body } : null;
      }

      if (typeof comment !== "object" || comment === null) {
        return null;
      }

      const record = comment as Record<string, unknown>;
      const body = readString(record.body);

      if (!body) {
        return null;
      }

      return {
        authorLabel: buildAnonymousCommentAuthor(index),
        body
      };
    })
    .filter((comment): comment is PublishedCommentDraft => Boolean(comment));
}

function readSourceComments(value: Json | undefined) {
  const source = readObject(value);
  const comments = Array.isArray(source.comments) ? source.comments : [];

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
        authorLabel: buildAnonymousCommentAuthor(index),
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

export function readPublishDraft(value: Json, sourcePayloadPrivate?: Json): PublishDraft {
  const draft = readObject(value);
  const draftBody = readString(draft.body);
  const normalizedDraftBody = normalizeNarrativeBody(draftBody);
  const sourceCountryTags = readSourceCountryTags(sourcePayloadPrivate);
  const publicComments = readPublishedComments(draft.comments);
  const tags = sortCommunityLabels(
    Array.from(new Set([...readStringArray(draft.tags), ...sourceCountryTags]))
  );

  return {
    publicAuthorLabel: readString(draft.public_author_label) || "Haven_User_000",
    title: readString(draft.title),
    body: normalizedDraftBody || buildFallbackBody(draft),
    tags,
    comments: publicComments.length > 0 ? publicComments : readSourceComments(sourcePayloadPrivate),
    publishReady: Boolean(draft.publish_ready),
    moderationFlags: readStringArray(draft.moderation_flags),
    privacyFlags: readStringArray(draft.privacy_flags)
  };
}
