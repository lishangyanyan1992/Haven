"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Bot, ExternalLink, RotateCcw, SendHorizonal, User2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AdvisorUsage } from "@/lib/advisor/service";
import { trackEvent } from "@/lib/mixpanel";
import type { AdvisorAnswerPayload, AdvisorMessage } from "@/types/domain";

type AdvisorWorkspaceProps = {
  advisorUsage: AdvisorUsage;
  suggestedPrompts: string[];
  welcomeMessage: AdvisorAnswerPayload;
};

export function AdvisorWorkspace({ advisorUsage, suggestedPrompts, welcomeMessage }: AdvisorWorkspaceProps) {
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [messages, streamingMessageId, isPending]);

  async function sendMessage(rawMessage?: string) {
    const content = (rawMessage ?? draft).trim();
    if (!content) return;

    setError(null);
    setDraft("");

    startTransition(async () => {
      const optimisticUserMessage: AdvisorMessage = {
        id: `tmp-user-${Date.now()}`,
        threadId: "session",
        role: "user",
        content,
        createdAt: new Date().toISOString()
      };

      const optimisticAssistantMessage: AdvisorMessage = {
        id: `tmp-assistant-${Date.now()}`,
        threadId: "session",
        role: "assistant",
        content: "Reading official sources and your Haven snapshot...",
        createdAt: new Date().toISOString(),
        answerPayload: {
          answer_markdown: "Reading official sources and your Haven snapshot...",
          confidence: "low",
          disclaimer: "Haven provides information, not legal advice. Check a qualified immigration attorney before making decisions.",
          external_citations: [],
          haven_context_used: [],
          community_context_used: [],
          follow_up_questions: []
        }
      };

      const nextMessages = [...messages, optimisticUserMessage];
      setMessages([...nextMessages, optimisticAssistantMessage]);

      try {
        const response = await fetch("/api/advisor/respond", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            conversationId: conversationId ?? undefined,
            history: nextMessages.map((message) => ({
              role: message.role,
              content: message.role === "assistant" ? message.answerPayload?.answer_markdown ?? message.content : message.content
            }))
          })
        });
        const body = await response.json();

        if (!response.ok) {
          throw new Error(body.error ?? "Unable to send advisor message.");
        }

        trackEvent("Search", {
          search_query: content,
          user_id: null,
          results_count: 1
        });
        setConversationId(body.conversationId ?? null);
        setMessages([...nextMessages, body.assistantMessage]);
        setStreamingMessageId(body.assistantMessage.id);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to send advisor message.");
        setMessages(nextMessages);
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[var(--radius-2xl)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] p-6 md:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-[72ch]">
            <p className="text-label">Haven Advisor</p>
            <h1 className="text-h1 mt-4">Ask visa and green card questions with source-backed answers.</h1>
            <p className="text-body mt-4">
              This version does not save conversation history. Haven answers from official sources plus your current Haven snapshot, and everything resets when you refresh.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="active">{advisorUsage.remaining} of {advisorUsage.limit} credits left</Badge>
              <Badge variant="pending">{advisorUsage.renewalLabel}</Badge>
            </div>
            <p className="text-caption mt-3">
              Limit: {advisorUsage.limit} new advisor conversations within 24 hours. Follow-up questions inside the same open conversation do not count again.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="active">Citations required</Badge>
            <Badge variant="pending">Session only</Badge>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              className="rounded-full border border-[var(--haven-sage-mid)] bg-[var(--haven-white)] px-4 py-2 text-left text-body-sm transition-colors hover:bg-[var(--haven-sand)]"
              onClick={() => {
                setDraft(prompt);
              }}
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <div>
            <p className="text-label">Conversation</p>
            <CardTitle className="mt-2">Current tab only</CardTitle>
          </div>
          <Button
            onClick={() => {
              setMessages([]);
              setConversationId(null);
              setError(null);
              setStreamingMessageId(null);
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
                animate={false}
                isPending={false}
                message={{
                  id: "welcome",
                  threadId: "session",
                  role: "assistant",
                  content: welcomeMessage.answer_markdown,
                  createdAt: new Date().toISOString(),
                  answerPayload: welcomeMessage
                }}
              />
            ) : (
              messages.map((message) =>
                message.role === "assistant" ? (
                  <AdvisorAnswerCard
                    key={message.id}
                    animate={streamingMessageId === message.id}
                    isPending={isPending && streamingMessageId === message.id}
                    message={message}
                    onAnimationComplete={() => {
                      setStreamingMessageId((current) => (current === message.id ? null : current));
                    }}
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

          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-sand)] p-4">
            <Textarea
              className="min-h-[120px] bg-[var(--haven-white)]"
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about H-1B, PERM, I-140, I-485, the visa bulletin, or how your Haven timeline fits those rules."
              value={draft}
            />
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-caption">
                Haven uses official sources first, then your current Haven profile, then community context as anecdotal backup.
              </p>
              <Button onClick={() => void sendMessage()} size="sm">
                <SendHorizonal className="h-4 w-4" />
                Ask Haven
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UserMessageCard({ message }: { message: AdvisorMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[var(--radius-xl)] bg-[var(--haven-ink)] px-5 py-4 text-[var(--haven-cream)]">
        <div className="mb-2 flex items-center gap-2 text-[12px] uppercase tracking-[0.08em] text-[rgba(253,250,246,0.72)]">
          <User2 className="h-3.5 w-3.5" />
          You
        </div>
        <p className="whitespace-pre-wrap text-body-sm">{message.content}</p>
      </div>
    </div>
  );
}

function AdvisorAnswerCard({
  message,
  animate,
  isPending,
  onAnimationComplete
}: {
  message: AdvisorMessage;
  animate: boolean;
  isPending: boolean;
  onAnimationComplete?: () => void;
}) {
  const [displayText, setDisplayText] = useState(message.answerPayload?.answer_markdown ?? message.content);
  const answerText = message.answerPayload?.answer_markdown ?? message.content;

  useEffect(() => {
    if (!animate) {
      setDisplayText(answerText);
      return;
    }

    setDisplayText("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 5;
      setDisplayText(answerText.slice(0, index));
      if (index >= answerText.length) {
        window.clearInterval(timer);
        onAnimationComplete?.();
      }
    }, 14);

    return () => window.clearInterval(timer);
  }, [animate, answerText, onAnimationComplete]);

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

        <div className="whitespace-pre-wrap text-body-sm leading-7">{displayText}</div>

        {message.answerPayload && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={message.answerPayload.confidence === "high" ? "active" : message.answerPayload.confidence === "medium" ? "pending" : "urgent"}>
                {message.answerPayload.confidence} confidence
              </Badge>
              {message.answerPayload.refusal_or_escalation_reason && <Badge variant="urgent">Needs caution</Badge>}
            </div>

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
                        <li key={item} className="text-body-sm">
                          {item}
                        </li>
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
                        <li key={item} className="text-body-sm">
                          {item}
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </details>

            {message.answerPayload.follow_up_questions.length > 0 && (
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-sand)] p-4">
                <p className="text-label">Suggested follow-ups</p>
                <ul className="mt-2 space-y-2">
                  {message.answerPayload.follow_up_questions.map((item) => (
                    <li key={item} className="text-body-sm">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-caption">{message.answerPayload.disclaimer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
