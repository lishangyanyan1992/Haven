"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { PENDING_QUESTION_KEY } from "@/lib/pending-question";

/**
 * The one thing the home page asks people to do.
 *
 * The question is kept in session storage and handed to the advisor once the
 * person has an account, so nobody has to type it twice. Onboarding comes
 * first on purpose — the answer is only worth reading if it knows the case.
 */
const STARTERS = [
  "I didn't get picked in the H-1B lottery. What are my options?",
  "I was just laid off on an H-1B. What do I do first?",
  "My status runs out soon and I don't have a job yet.",
  "My H-1B transfer is taking forever. Can I start the new job?"
];

const QUESTION_LIMIT = 1000;

export function HomeQuestionBox() {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [question, setQuestion] = useState("");
  const [isLeaving, setIsLeaving] = useState(false);

  function handoff(raw: string) {
    const content = raw.trim().slice(0, QUESTION_LIMIT);
    if (!content || isLeaving) return;

    setIsLeaving(true);
    try {
      window.sessionStorage.setItem(PENDING_QUESTION_KEY, content);
    } catch {
      // Private browsing or storage disabled — the person can retype it.
    }
    router.push("/register");
  }

  return (
    <div className="w-full">
      <form
        className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-3 shadow-[0_12px_48px_-16px_rgba(44,54,48,0.18)] sm:p-4"
        onSubmit={(event) => {
          event.preventDefault();
          handoff(question);
        }}
      >
        <label className="sr-only" htmlFor="home-question">
          Your question
        </label>
        <textarea
          className="min-h-[104px] w-full resize-none bg-transparent px-2 pt-1 text-[16px] leading-relaxed text-[var(--haven-ink)] outline-none placeholder:text-[var(--color-text-secondary)]"
          id="home-question"
          maxLength={QUESTION_LIMIT}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              handoff(question);
            }
          }}
          placeholder="What's happening with your case? Write it the way you'd tell a friend."
          ref={inputRef}
          rows={3}
          value={question}
        />
        <div className="mt-2 flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3">
          <p className="text-caption">Free. Your details stay private.</p>
          <button
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--haven-ink)] bg-[var(--haven-ink)] px-5 text-[15px] font-medium text-[var(--haven-cream)] transition-colors",
              "hover:bg-[var(--haven-ink-mid)] hover:border-[var(--haven-ink-mid)]",
              "disabled:cursor-not-allowed disabled:opacity-40"
            )}
            disabled={!question.trim() || isLeaving}
            type="submit"
          >
            {isLeaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Get my answer
            {!isLeaving ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {STARTERS.map((starter) => (
          <button
            className="rounded-full border border-[var(--color-border)] bg-[var(--haven-white)] px-4 py-2 text-left text-[13px] text-[var(--haven-ink-mid)] transition-colors hover:border-[var(--haven-ink)] hover:text-[var(--haven-ink)]"
            key={starter}
            onClick={() => {
              setQuestion(starter);
              inputRef.current?.focus();
            }}
            type="button"
          >
            {starter}
          </button>
        ))}
      </div>
    </div>
  );
}
