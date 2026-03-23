"use client";

import { useState } from "react";
import { Send, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const tags = ["AC21", "Layoffs", "Visa Bulletin", "H1B", "EB-2", "EB-3", "Job Change", "Timeline", "H4 EAD"];

export function CommunityComposer({
  profile
}: {
  profile: {
    visaType: string;
    preferenceCategory: string;
    countryOfBirth: string;
  }
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const authorLabel = `${profile.visaType} · ${profile.preferenceCategory} · ${profile.countryOfBirth}`;

  const toggleTag = (tag: string) => {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag].slice(0, 3)
    );
  };

  const handleSubmit = () => {
    if (!title.trim() || !body.trim()) return;
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setTitle("");
      setBody("");
      setSelectedTags([]);
      setIsExpanded(false);
    }, 2500);
  };

  if (submitted) {
    return (
      <div className="rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-5">
        <div className="flex items-center gap-3">
          <div className="avatar avatar-md">P</div>
          <div>
            <p className="text-h3">Post shared with your cohort.</p>
            <p className="text-body-sm mt-1">Members with matching profiles will see your post.</p>
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
            Share something with your cohort...
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
            <p className="text-label">Add up to 3 tags</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12px] transition-colors",
                    selectedTags.includes(tag)
                      ? "border-[var(--haven-sky-mid)] bg-[var(--haven-sky-light)] text-[var(--haven-sky-ink)]"
                      : "border-[var(--color-border)] bg-[var(--haven-white)] text-[var(--color-text-secondary)] hover:bg-[var(--haven-cream)]"
                  )}
                  onClick={() => toggleTag(tag)}
                  type="button"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-caption">Share experiences, not legal advice.</p>
            <Button disabled={!title.trim() || !body.trim()} onClick={handleSubmit} variant="accent">
              <Send className="h-4 w-4" />
              Post to cohort
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
