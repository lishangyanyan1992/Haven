"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageSquare,
  Plus,
  SendHorizonal,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User2,
  X
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { splitAnswer } from "@/lib/advisor/answer-shape";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AdvisorStreamEvent, AdvisorUsage } from "@/lib/advisor/service";
import { trackEvent } from "@/lib/mixpanel";
import type { AdvisorAnswerPayload, AdvisorMessage } from "@/types/domain";
import { PENDING_QUESTION_KEY } from "@/lib/pending-question";

type AdvisorWorkspaceProps = {
  advisorUsage: AdvisorUsage;
  /** Rendered by the server, so the client does not re-fetch the same rows on mount. */
  initialThreads: AdvisorThreadSummary[];
  suggestedPrompts: string[];
  welcomeMessage: AdvisorAnswerPayload;
};

// Server-side limits, mirrored so the user learns about them before pressing send
// rather than after. advisorRespondSchema rejects (not truncates) more than
// HISTORY_LIMIT history entries, so sending the whole thread made the advisor
// hard-fail after ~6 exchanges with a misleading validation error.
const MESSAGE_CHAR_LIMIT = 4000;
const HISTORY_LIMIT = 12;

type AdvisorThreadSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};

type RememberedFact = {
  id: string;
  kind: string;
  quote: string;
  createdAt: string;
};

/** "3 days ago" — enough for a sidebar, no dependency needed. */
function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";

  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;

  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso));
}

export function AdvisorWorkspace({
  advisorUsage,
  initialThreads,
  suggestedPrompts,
  welcomeMessage
}: AdvisorWorkspaceProps) {
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [stoppedIds, setStoppedIds] = useState<string[]>([]);
  const [threads, setThreads] = useState<AdvisorThreadSummary[]>(initialThreads);
  const [facts, setFacts] = useState<RememberedFact[]>([]);
  const [openingThreadId, setOpeningThreadId] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshThreads = useCallback(async () => {
    try {
      const response = await fetch("/api/advisor/threads");
      if (!response.ok) return;
      const body = (await response.json()) as { threads?: AdvisorThreadSummary[] };
      setThreads(body.threads ?? []);
    } catch {
      // The conversation list is an affordance, not the product. If it cannot load,
      // asking a question still works, so this stays quiet rather than showing an
      // error above a chat box that is fine.
    }
  }, []);

  const refreshFacts = useCallback(async () => {
    try {
      const response = await fetch("/api/advisor/memory");
      if (!response.ok) return;
      const body = (await response.json()) as { facts?: RememberedFact[] };
      setFacts(body.facts ?? []);
    } catch {
      // Same reasoning as the conversation list: an affordance, not the product.
    }
  }, []);

  // Threads arrive from the server with the page, so only the facts are fetched
  // here — and only on the advisor itself, never on every page. Supabase egress is
  // the tightest budget in this project, and the conversation list is the largest
  // thing on this screen.
  useEffect(() => {
    void refreshFacts();
  }, [refreshFacts]);

  // A question typed on the home page waits in session storage while the person
  // signs up and finishes onboarding. Drop it into the composer — not sent
  // automatically, so they can add anything the setup questions missed.
  useEffect(() => {
    try {
      const pending = window.sessionStorage.getItem(PENDING_QUESTION_KEY);
      if (!pending) return;
      window.sessionStorage.removeItem(PENDING_QUESTION_KEY);
      setDraft(pending);
    } catch {
      // Storage unavailable — nothing to restore.
    }
  }, []);

  const forgetFact = useCallback(
    async (fact: RememberedFact) => {
      const previous = facts;
      setFacts((current) => current.filter((item) => item.id !== fact.id));
      try {
        const response = await fetch("/api/advisor/memory", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ factId: fact.id })
        });
        if (!response.ok) throw new Error("forget failed");
      } catch {
        setFacts(previous);
        setError("Haven couldn't forget that just now. Try again in a moment.");
      }
    },
    [facts]
  );

  const openThread = useCallback(async (threadId: string) => {
    setOpeningThreadId(threadId);
    setError(null);
    try {
      const response = await fetch(`/api/advisor/threads/${threadId}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Unable to open that conversation.");
      }
      const body = (await response.json()) as { messages: AdvisorMessage[] };
      setMessages(body.messages);
      setConversationId(threadId);
      setStoppedIds([]);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Haven couldn't open that conversation. Try again in a moment."
      );
    } finally {
      setOpeningThreadId(null);
    }
  }, []);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setError(null);
    setStreamingId(null);
    setStoppedIds([]);
    setIsPending(false);
    void refreshThreads();
  }, [refreshThreads]);

  const removeThread = useCallback(
    async (thread: AdvisorThreadSummary) => {
      const confirmed = window.confirm(
        `Delete "${thread.title}"?\n\nThis removes the whole conversation and everything in it. It can't be undone.`
      );
      if (!confirmed) return;

      // Optimistic: the row disappears immediately and comes back if the delete
      // fails, rather than the user clicking again because nothing happened.
      const previous = threads;
      setThreads((current) => current.filter((item) => item.id !== thread.id));

      try {
        const response = await fetch(`/api/advisor/threads/${thread.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("delete failed");
        if (conversationId === thread.id) {
          setMessages([]);
          setConversationId(null);
          setStoppedIds([]);
        }
      } catch {
        setThreads(previous);
        setError("Haven couldn't delete that conversation. Try again in a moment.");
      }
    },
    [conversationId, threads]
  );

  const draftLength = draft.trim().length;
  const overLimit = draftLength > MESSAGE_CHAR_LIMIT;
  const nearLimit = draftLength > MESSAGE_CHAR_LIMIT * 0.8;
  const historyTrimmed = messages.length > HISTORY_LIMIT;

  function stopAnswer() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [messages, isPending]);

  async function sendMessage(rawMessage?: string) {
    const content = (rawMessage ?? draft).trim();
    if (!content || isPending) return;

    if (content.length > MESSAGE_CHAR_LIMIT) {
      setError(
        `That message is ${content.length.toLocaleString()} characters and the limit is ${MESSAGE_CHAR_LIMIT.toLocaleString()}. Your text is still here — try sending the most important part first, then add the rest as a follow-up.`
      );
      return;
    }

    setError(null);
    setDraft("");
    setIsPending(true);

    const optimisticUserMessage: AdvisorMessage = {
      id: `tmp-user-${Date.now()}`,
      threadId: "session",
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };

    const sid = `streaming-${Date.now()}`;
    setStreamingId(sid);
    const nextMessages = [...messages, optimisticUserMessage];
    // Show user message immediately, then append the streaming bubble in the next tick
    // so React commits the user message before the empty assistant card.
    setMessages(nextMessages);
    setTimeout(() => {
      setMessages([...nextMessages, {
        id: sid,
        threadId: "session",
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      }]);
    }, 0);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/advisor/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          content,
          conversationId: conversationId ?? undefined,
          // The turns *before* this one. This used to send `nextMessages`, which
          // includes the message being asked, so the server saw the current
          // question inside its own history — the first unrecognised question
          // then counted as two misses and skipped straight to the "I've asked
          // twice" handoff, and the one-turn topic lookback only ever saw the
          // current turn. The server also normalises this, so an older client
          // cannot reintroduce it.
          //
          // Only the most recent turns: the server rejects longer histories
          // outright, which used to break the thread entirely.
          history: messages.slice(-HISTORY_LIMIT).map((m) => ({
            role: m.role,
            content: m.answerPayload?.answer_markdown ?? m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: "Unable to send message." }));
        throw new Error((errorBody as { error?: string }).error ?? "Unable to send message.");
      }

      if (!response.body) throw new Error("No response stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let streamText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split("\n");
        sseBuffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let event: AdvisorStreamEvent;
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === "start") {
            // Claim the thread as soon as the server reserves it. If the user stops
            // this answer or it errors, the next question continues this conversation
            // instead of opening a second one against their daily limit.
            setConversationId(event.conversationId);
          } else if (event.type === "delta") {
            streamText += event.text;
            setMessages([...nextMessages, {
              id: sid,
              threadId: "session",
              role: "assistant",
              content: streamText,
              createdAt: new Date().toISOString(),
            }]);
          } else if (event.type === "done") {
            setConversationId(event.conversationId ?? null);
            setMessages([...nextMessages, event.assistantMessage]);
            setStreamingId(null);
            setIsPending(false);
            trackEvent("Search", { search_query: content, user_id: null, results_count: 1 });
            // The exchange is saved by now, so a brand-new conversation appears in
            // the list and an existing one moves to the top. Facts are extracted in
            // the same step, so anything newly remembered shows up immediately —
            // the user should learn that Haven kept something at the moment it
            // keeps it, not weeks later when it surfaces in an answer.
            void refreshThreads();
            void refreshFacts();
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (caughtError) {
      // A user-initiated stop is not an error: keep whatever streamed, mark it
      // incomplete, and leave the disclaimer in place (CD-1.15).
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
        setStoppedIds((previous) => [...previous, sid]);
        setStreamingId(null);
      } else {
        const raw = caughtError instanceof Error ? caughtError.message : "";
        setError(
          raw && !/^Unable to send message\.?$/i.test(raw)
            ? raw
            : "Haven couldn't reach the advisor just now. Your question wasn't sent — try again in a moment, and if it keeps happening, reload the page."
        );
        setMessages(nextMessages);
        setStreamingId(null);
      }
    } finally {
      abortRef.current = null;
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-6">
      {threads.length > 0 && (
        <Card>
          <CardContent className="space-y-2 py-4">
            <p className="text-caption text-[var(--color-text-secondary)]">Your conversations</p>
            <ul className="space-y-1">
              {threads.map((thread) => {
                const isOpen = conversationId === thread.id;
                return (
                  <li key={thread.id} className="flex items-center gap-2">
                    <button
                      className={`flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left transition-colors ${
                        isOpen
                          ? "bg-[var(--haven-sage-light)]"
                          : "hover:bg-[var(--haven-sand)] disabled:opacity-50"
                      }`}
                      disabled={isPending || openingThreadId !== null}
                      onClick={() => void openThread(thread.id)}
                      type="button"
                    >
                      <MessageSquare className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-secondary)]" />
                      <span className="min-w-0 flex-1 truncate text-body-sm">{thread.title}</span>
                      <span className="shrink-0 text-caption text-[var(--color-text-secondary)]">
                        {openingThreadId === thread.id ? "opening…" : relativeTime(thread.updatedAt)}
                      </span>
                    </button>
                    <button
                      aria-label={`Delete conversation: ${thread.title}`}
                      className="shrink-0 rounded-full p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--haven-blush-light)] hover:text-[var(--haven-blush-ink)] disabled:opacity-50"
                      disabled={isPending || openingThreadId !== null}
                      onClick={() => void removeThread(thread)}
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div />
          {/* Was "Reset", which read as "clear the screen" while actually
              abandoning a conversation the user had already paid for out of their
              daily five. Now that conversations are saved, this really does start a
              new one and the old one stays in the list above. */}
          <Button
            disabled={isPending || messages.length === 0}
            onClick={startNewConversation}
            size="sm"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            New conversation
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div ref={scrollerRef} className="max-h-[620px] space-y-4 overflow-y-auto pr-1">
            {messages.length === 0 ? (
              <AdvisorAnswerCard
                isPending={false}
                traceId={null}
                message={{
                  id: "welcome",
                  threadId: "session",
                  role: "assistant",
                  content: welcomeMessage.answer_markdown,
                  createdAt: new Date().toISOString(),
                  answerPayload: welcomeMessage,
                }}
              />
            ) : (
              messages.map((message) =>
                message.role === "assistant" ? (
                  <AdvisorAnswerCard
                    key={message.id}
                    isPending={message.id === streamingId}
                    message={message}
                    onFollowUp={(question) => void sendMessage(question)}
                    stopped={stoppedIds.includes(message.id)}
                    traceId={message.traceId ?? null}
                  />
                ) : (
                  <UserMessageCard key={message.id} message={message} />
                )
              )
            )}
          </div>

          {error && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] px-4 py-3 text-body-sm text-[var(--haven-blush-ink)]">
              {error}
            </div>
          )}

          {messages.length === 0 && suggestedPrompts.length > 0 && (
            <div className="space-y-2">
              <p className="text-caption text-[var(--color-text-secondary)]">Not sure where to start?</p>
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--haven-white)] px-3 py-1.5 text-left text-caption transition-colors hover:border-[var(--haven-sage-mid)] hover:bg-[var(--haven-sage-light)] disabled:opacity-50"
                    disabled={isPending}
                    onClick={() => void sendMessage(prompt)}
                    type="button"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {historyTrimmed && (
            <p className="text-caption text-[var(--color-text-secondary)]">
              Only the last {HISTORY_LIMIT} messages of this conversation are sent with each question. If something you
              said earlier still matters, mention it again.
            </p>
          )}

          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-sand)] p-4">
            <Textarea
              className="min-h-[120px] bg-[var(--haven-white)]"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about H-1B, PERM, I-140, I-485, the visa bulletin, or how your Haven timeline fits those rules."
              value={draft}
            />
            <div className="mt-2 flex items-center justify-end">
              {nearLimit && (
                <p className={`text-caption ${overLimit ? "text-[var(--haven-blush-ink)]" : "text-[var(--color-text-secondary)]"}`}>
                  {draftLength.toLocaleString()} / {MESSAGE_CHAR_LIMIT.toLocaleString()} characters
                  {overLimit ? " — too long to send" : ""}
                </p>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* The old copy described precedence — official sources, then profile,
                  then community — and never mentioned that the question and the
                  relevant profile fields are sent to an AI provider to be answered.
                  Describing the ordering of inputs is not the same as disclosing
                  where they go, and the second is the one a user handing over their
                  immigration history is entitled to know without hunting for it. */}
              <p className="text-caption">
                Official sources first, then your Haven profile, then community context as anecdotal backup. Your
                question and the relevant parts of your profile are sent to an AI provider to produce the answer —{" "}
                <a className="underline underline-offset-2" href="/privacy">
                  how Haven handles your data
                </a>
                .
              </p>
              {isPending ? (
                <Button onClick={stopAnswer} size="sm" variant="outline">
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </Button>
              ) : (
                <Button disabled={overLimit || draftLength === 0} onClick={() => void sendMessage()} size="sm">
                  <SendHorizonal className="h-4 w-4" />
                  Ask Haven
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What Haven remembers, in the user's own words, with a way to remove any of
          it. This panel is the feature's honesty mechanism rather than a
          convenience: recalling something somebody knows they said is helpful,
          recalling something they did not realise was kept is unsettling, and on
          immigration history that is a trust failure. If it is remembered, it is
          shown here. */}
      {facts.length > 0 && (
        <Card>
          <CardContent className="space-y-3 py-4">
            <div>
              <p className="text-caption text-[var(--color-text-secondary)]">What Haven remembers</p>
              <p className="mt-1 text-caption text-[var(--color-text-secondary)]">
                Things you told Haven in earlier conversations, so you don&apos;t have to repeat them. Haven treats
                these as what you said, not as verified facts — remove anything that&apos;s out of date or you&apos;d
                rather it forgot.
              </p>
            </div>
            <ul className="space-y-1">
              {facts.map((fact) => (
                <li key={fact.id} className="flex items-start gap-2 rounded-[var(--radius-md)] bg-[var(--haven-sand)] px-3 py-2">
                  <BrainCircuit className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-secondary)]" />
                  <span className="min-w-0 flex-1 text-body-sm">
                    &ldquo;{fact.quote}&rdquo;
                    <span className="ml-2 text-caption text-[var(--color-text-secondary)]">
                      {relativeTime(fact.createdAt)}
                    </span>
                  </span>
                  <button
                    aria-label={`Forget: ${fact.quote}`}
                    className="shrink-0 rounded-full p-1.5 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--haven-blush-light)] hover:text-[var(--haven-blush-ink)]"
                    onClick={() => void forgetFact(fact)}
                    type="button"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="px-1">
        {/* Counts conversations, not questions — follow-ups within a thread are
            unlimited and free. Saying "questions" both undersells the product and
            hides what Reset actually costs. */}
        <p className="text-caption text-[var(--color-text-secondary)]">
          {advisorUsage.remaining} of {advisorUsage.limit} conversations left · {advisorUsage.renewalLabel} · follow-up
          questions in this conversation are unlimited
        </p>
      </div>
    </div>
  );
}

function UserMessageCard({ message }: { message: AdvisorMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[var(--radius-xl)] bg-[var(--haven-ink)] px-5 py-4 text-white">
        <div className="mb-2 flex items-center gap-2 text-[12px] uppercase tracking-[0.08em] text-[rgba(253,250,246,0.72)]">
          <User2 className="h-3.5 w-3.5" />
          You
        </div>
        <p className="whitespace-pre-wrap text-body-sm text-white">{message.content}</p>
      </div>
    </div>
  );
}

function AdvisorAnswerCard({
  message,
  isPending,
  traceId,
  stopped = false,
  onFollowUp,
}: {
  message: AdvisorMessage;
  isPending: boolean;
  traceId: string | null;
  stopped?: boolean;
  onFollowUp?: (question: string) => void;
}) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const submitFeedback = useCallback(async (score: "up" | "down") => {
    if (feedbackSent || !traceId || isPending) return;
    setFeedback(score);
    setFeedbackSent(true);
    try {
      await fetch("/api/advisor/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traceId, score }),
      });
    } catch {
      // Fire and forget — never surface observability errors to the user.
    }
  }, [feedbackSent, traceId, isPending]);

  const displayText = message.answerPayload?.answer_markdown ?? message.content;

  // Long answers are shown as a lead plus a toggle rather than a wall.
  //
  // Not applied while the answer is still streaming: a split that moves as tokens
  // arrive would make text jump between two places on the screen, and somebody
  // reading a deadline as it appears should not have it relocate under a button.
  // Until it finishes, this renders exactly as it always did.
  const shaped = useMemo(
    () => (isPending ? null : splitAnswer(displayText)),
    [displayText, isPending]
  );
  const [detailsOpen, setDetailsOpen] = useState(false);

  const sourcesPanel = traceId && message.answerPayload ? (
    <details className="rounded-[var(--radius-lg)] bg-[var(--haven-sand)] p-4">
      <summary className="cursor-pointer list-none text-body-sm font-medium">Sources and context</summary>
      <div className="mt-4 space-y-4">
        <div>
          <p className="text-label">Official citations</p>
          <div className="mt-2 space-y-3">
            {message.answerPayload.external_citations.length === 0 ? (
              <p className="text-body-sm">No external citations were needed for this message.</p>
            ) : (
              message.answerPayload.external_citations.map((citation) => (
                <div key={`${citation.label}-${citation.citationIndex}`} className="rounded-[var(--radius-md)] bg-[var(--haven-white)] p-3">
                  <p className="text-body-sm font-medium">{citation.label}</p>
                  {/* The excerpt is labelled by where its words came from, and a
                      summary is never wrapped in quotation marks. Previously this
                      rendered Haven's own paraphrase directly under the agency's
                      name, next to a link to that agency — so a user forwarding it
                      to their attorney reasonably read Haven's wording as USCIS's.
                      Only a verbatim excerpt is presented as a quotation. */}
                  {citation.excerpt && (
                    <>
                      <p className="mt-1 text-caption text-[var(--color-text-secondary)]">
                        {citation.attribution === "verbatim" ? "Quoted from the source" : "Haven's summary of this source"}
                      </p>
                      <p className="mt-0.5 text-caption">
                        {citation.attribution === "verbatim" ? `“${citation.excerpt}”` : citation.excerpt}
                      </p>
                    </>
                  )}
                  {citation.url && (
                    <a
                      className="mt-2 inline-flex items-center gap-1 text-caption underline underline-offset-2"
                      href={citation.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Open source
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        <div>
          <p className="text-label">Used your Haven data</p>
          <ul className="mt-2 space-y-2">
            {message.answerPayload.haven_context_used.length === 0 ? (
              <li className="text-body-sm">No personalized Haven fields materially changed the answer.</li>
            ) : (
              message.answerPayload.haven_context_used.map((item) => (
                <li key={item} className="text-body-sm">{item}</li>
              ))
            )}
          </ul>
        </div>
        <div>
          <p className="text-label">Community context</p>
          <ul className="mt-2 space-y-2">
            {message.answerPayload.community_context_used.length === 0 ? (
              <li className="text-body-sm">No community anecdotes were used.</li>
            ) : (
              message.answerPayload.community_context_used.map((item) => (
                <li key={item} className="text-body-sm">{item}</li>
              ))
            )}
          </ul>
        </div>
      </div>
    </details>
  ) : null;

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] px-5 py-5 shadow-[0_10px_30px_rgba(37,44,39,0.05)]">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--haven-sage-light)] text-[var(--haven-ink)]">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <p className="text-body-sm font-medium">Haven Advisor</p>
            <p className="text-caption">{isPending ? "Working through official sources..." : "Official sources + current Haven data"}</p>
          </div>
        </div>

        {/* The system prompt asks for markdown, so it has to be rendered — otherwise
            users read literal ** and ### characters. This matters most on the safety
            addenda, which are themselves emitted with **bold** markers, so the most
            important sentences were the ones displaying raw syntax. react-markdown
            does not render embedded HTML by default, which is what we want for text
            that originates from a model. */}
        <div className="text-body-sm leading-7 [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-[var(--haven-sand)] [&_code]:px-1 [&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_strong]:font-semibold [&_table]:my-2 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-[var(--color-border)] [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-[var(--color-border)] [&_th]:px-2 [&_th]:py-1 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5">
          {displayText && !shaped?.details && (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ ...props }) => <a {...props} rel="noreferrer" target="_blank" />
              }}
            >
              {displayText}
            </ReactMarkdown>
          )}

          {shaped?.details && (
            <>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{ a: ({ ...props }) => <a {...props} rel="noreferrer" target="_blank" /> }}
              >
                {shaped.lead}
              </ReactMarkdown>

              <button
                aria-expanded={detailsOpen}
                className="my-3 flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--haven-sand)] px-3 py-1.5 text-caption transition-colors hover:border-[var(--haven-sage-mid)] hover:bg-[var(--haven-sage-light)]"
                onClick={() => setDetailsOpen((open) => !open)}
                type="button"
              >
                {detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {detailsOpen ? "Hide the detail" : "Show how this works, and the conditions"}
              </button>

              {detailsOpen && (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{ a: ({ ...props }) => <a {...props} rel="noreferrer" target="_blank" /> }}
                >
                  {shaped.details}
                </ReactMarkdown>
              )}

              {/* Appended safety text and the attorney handoff. Never collapsed —
                  these are the sentences most likely to change what somebody does,
                  and hiding one behind a toggle would be worse than the wall of
                  text this replaces. */}
              {shaped.appended && (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{ a: ({ ...props }) => <a {...props} rel="noreferrer" target="_blank" /> }}
                >
                  {shaped.appended}
                </ReactMarkdown>
              )}
            </>
          )}
          {isPending && !displayText && (
            <span className="flex gap-1.5 py-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--haven-sage-mid)] [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--haven-sage-mid)] [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--haven-sage-mid)] [animation-delay:300ms]" />
            </span>
          )}
          {isPending && displayText && (
            <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-current align-middle" />
          )}
        </div>

        {/* An interrupted answer must never read as a finished one, and the legal
            disclaimer has to survive the interruption (CD-1.12, CD-1.15). */}
        {stopped && (
          <div className="mt-3 space-y-2 rounded-[var(--radius-lg)] border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] px-4 py-3">
            <p className="text-body-sm text-[var(--haven-blush-ink)]">
              You stopped this answer, so it is incomplete and may be missing safety guidance. Ask again to get the
              full response.
            </p>
            <p className="text-caption text-[var(--haven-blush-ink)]">
              Haven provides information, not legal advice. Check a qualified immigration attorney before making
              decisions.
            </p>
          </div>
        )}

        {message.answerPayload && !isPending && !stopped && (
          <div className="mt-4 space-y-3">
            {message.answerPayload.refusal_or_escalation_reason && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="urgent">Needs caution</Badge>
              </div>
            )}

            {sourcesPanel}

            <p className="text-caption">{message.answerPayload.disclaimer}</p>

            {onFollowUp && message.answerPayload.follow_up_questions.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-caption text-[var(--color-text-secondary)]">Ask next</p>
                <div className="flex flex-wrap gap-2">
                  {message.answerPayload.follow_up_questions.map((question) => (
                    <button
                      key={question}
                      className="rounded-full border border-[var(--color-border)] bg-[var(--haven-sand)] px-3 py-1.5 text-left text-caption transition-colors hover:border-[var(--haven-sage-mid)] hover:bg-[var(--haven-sage-light)]"
                      onClick={() => onFollowUp(question)}
                      type="button"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {traceId && (
              <div className="flex items-center gap-3 pt-1">
                <p className="text-caption text-[var(--color-text-secondary)]">Was this helpful?</p>
                <button
                  aria-label="Helpful"
                  className={`rounded-full p-1.5 transition-colors ${feedback === "up" ? "bg-[var(--haven-sage-light)] text-[var(--haven-ink)]" : "text-[var(--color-text-secondary)] hover:text-[var(--haven-ink)]"}`}
                  disabled={feedbackSent}
                  onClick={() => void submitFeedback("up")}
                >
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button
                  aria-label="Not helpful"
                  className={`rounded-full p-1.5 transition-colors ${feedback === "down" ? "bg-red-50 text-red-500" : "text-[var(--color-text-secondary)] hover:text-red-400"}`}
                  disabled={feedbackSent}
                  onClick={() => void submitFeedback("down")}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
                {feedbackSent && (
                  <p className="text-caption text-[var(--color-text-secondary)]">Thanks for the feedback.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
