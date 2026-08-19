"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

import { PENDING_QUESTION_KEY } from "@/lib/pending-question";

/**
 * Reassures someone who typed a question on the home page that it wasn't lost
 * when we asked them to sign up first.
 */
export function PendingQuestionNote() {
  const [question, setQuestion] = useState<string | null>(null);

  useEffect(() => {
    try {
      setQuestion(window.sessionStorage.getItem(PENDING_QUESTION_KEY));
    } catch {
      // Storage unavailable — show nothing rather than a broken promise.
    }
  }, []);

  if (!question) return null;

  return (
    <div className="mb-6 rounded-[var(--radius-xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-4">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-[var(--haven-ink)]" />
        <p className="text-body-sm font-medium text-[var(--haven-ink)]">Your question is saved</p>
      </div>
      <p className="text-body-sm mt-2 italic text-[var(--haven-ink-mid)]">&ldquo;{question}&rdquo;</p>
      <p className="text-caption mt-2">
        A few quick questions about your case first — that&apos;s what makes the answer yours instead of generic.
      </p>
    </div>
  );
}
