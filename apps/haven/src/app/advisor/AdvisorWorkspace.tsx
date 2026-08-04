"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, ExternalLink, RotateCcw, SendHorizonal, Square, ThumbsDown, ThumbsUp, User2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AdvisorStreamEvent, AdvisorUsage } from "@/lib/advisor/service";
import { trackEvent } from "@/lib/mixpanel";
import type { AdvisorAnswerPayload, AdvisorMessage } from "@/types/domain";

type AdvisorWorkspaceProps = {
  advisorUsage: AdvisorUsage;
  suggestedPrompts: string[];
  welcomeMessage: AdvisorAnswerPayload;
};

// Server-side limits, mirrored so the user learns about them before pressing send
// rather than after. advisorRespondSchema rejects (not truncates) more than
// HISTORY_LIMIT history entries, so sending the whole thread made the advisor
// hard-fail after ~6 exchanges with a misleading validation error.
const MESSAGE_CHAR_LIMIT = 4000;
const HISTORY_LIMIT = 12;

export function AdvisorWorkspace({ advisorUsage, suggestedPrompts, welcomeMessage }: AdvisorWorkspaceProps) {
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [stoppedIds, setStoppedIds] = useState<string[]>([]);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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
          // Only the most recent turns: the server rejects longer histories
          // outright, which used to break the thread entirely.
          history: nextMessages.slice(-HISTORY_LIMIT).map((m) => ({
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

          if (event.type === "delta") {
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
      <Card>
        <CardHeader>
          <div />
          <Button
            disabled={isPending}
            onClick={() => {
              setMessages([]);
              setConversationId(null);
              setError(null);
              setStreamingId(null);
              setIsPending(false);
            }}
            size="sm"
            variant="outline"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
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
              <p className="text-caption">
                Haven uses official sources first, then your current Haven profile, then community context as anecdotal backup.
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

      <div className="px-1">
        <p className="text-caption text-[var(--color-text-secondary)]">
          {advisorUsage.remaining} of {advisorUsage.limit} questions left today · {advisorUsage.renewalLabel}
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
                  {citation.quote && <p className="mt-1 text-caption">{citation.quote}</p>}
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

        <div className="whitespace-pre-wrap text-body-sm leading-7">
          {displayText}
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
