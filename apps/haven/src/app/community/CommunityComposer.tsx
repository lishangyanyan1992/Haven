"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getConfirmedCommunityLabels } from "@/lib/community-labels";
import { Textarea } from "@/components/ui/textarea";
import { trackEvent } from "@/lib/mixpanel";
import type { PreferenceCategory, VisaType } from "@/types/domain";

export function CommunityComposer({
  profile
}: {
  profile: {
    visaType: VisaType;
    preferenceCategory: PreferenceCategory;
    countryOfBirth: string;
  }
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const confirmedLabels = getConfirmedCommunityLabels(
    { title, body, tags: [] },
    {
      countryOfBirth: profile.countryOfBirth,
      visaType: profile.visaType,
      preferenceCategory: profile.preferenceCategory
    }
  );
  const authorLabel = `${profile.visaType} · ${profile.preferenceCategory} · ${profile.countryOfBirth}`;

  const handleSubmit = () => {
    if (!title.trim() || !body.trim()) return;
    trackEvent("Conversion", {
      "Conversion Type": "community_post",
      "Conversion Value": confirmedLabels.length
    });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setTitle("");
      setBody("");
      setIsExpanded(false);
    }, 2500);
  };

  if (submitted) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-5">
        <div className="flex items-center gap-3">
          <div className="avatar avatar-md">P</div>
          <div>
            <p className="text-h3">Post shared with the forum.</p>
            <p className="text-body-sm mt-1">Haven will only show labels it can confirm from the post and your profile.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)]">
      {!isExpanded ? (
        <button className="flex w-full items-center gap-4 p-5 text-left" onClick={() => setIsExpanded(true)} type="button">
          <div className="avatar avatar-md avatar-community">{profile.countryOfBirth.charAt(0)}</div>
          <div className="flex-1 rounded-full border border-[var(--color-border)] bg-[var(--haven-cream)] px-4 py-3 text-body-sm text-[var(--color-text-tertiary)]">
            Share something with the community...
          </div>
        </button>
      ) : (
        <div className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-label">Posting as</p>
              <p className="text-h3 mt-2">{authorLabel}</p>
            </div>
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--haven-sand)] text-[var(--haven-ink-mid)]"
              onClick={() => setIsExpanded(false)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <label className="field-label">Title</label>
              <Input onChange={(event) => setTitle(event.target.value)} placeholder="What would you like to share or ask?" value={title} />
            </div>
            <div>
              <label className="field-label">More context</label>
              <Textarea
                onChange={(event) => setBody(event.target.value)}
                placeholder="Add your experience, what worked, or what feels unclear right now."
                rows={4}
                value={body}
              />
            </div>
          </div>

          <div className="mt-5">
            <p className="text-label">Confirmed labels</p>
            <p className="text-caption mt-2">Haven adds only labels it can verify from your profile or the text you shared.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {confirmedLabels.map((label) => (
                <span key={label} className="tag tag-community">
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-caption">Share experiences, not legal advice.</p>
            <Button disabled={!title.trim() || !body.trim()} onClick={handleSubmit} variant="accent">
              <Send className="h-4 w-4" />
              Post to forum
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
