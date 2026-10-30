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

import { CaseMemoryCard } from "@/components/app/case-memory-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { AdvisorStreamEvent, AdvisorUsage } from "@/lib/advisor/service";
import { trackEvent } from "@/lib/mixpanel";
import type { AdvisorAnswerPayload, AdvisorFirmContactOffer, AdvisorMessage } from "@/types/domain";
import { PENDING_QUESTION_KEY } from "@/lib/pending-question";
import { getFirmContactRequestStatusAction, sendFirmContactRequestAction } from "@/server/firm-contact-actions";
import {
  acknowledgeChatVisibilityAction,
  markClientMessagesReadAction,
  sendClientMessageAction
} from "@/server/message-actions";
import type { ClientConversation } from "@/lib/firms/client-messages";
import type { ConversationMessage } from "@/lib/firms/message-core";
import {
  aiAnswerLabel,
  isThreadVisibleToFirm,
  visibilityLineText,
  visibilityNoticeText
} from "@/lib/advisor/firm-visibility-copy";

/** Which firms see this person's chats, and when each started seeing them. */
export type AdvisorChatVisibility = {
  firms: { firmId: string; firmName: string; acknowledgedAt: string | null }[];
  needsNotice: boolean;
};

type AdvisorWorkspaceProps = {
  advisorUsage: AdvisorUsage;
  /** Rendered by the server, so the client does not re-fetch the same rows on mount. */
  initialThreads: AdvisorThreadSummary[];
  suggestedPrompts: string[];
  welcomeMessage: AdvisorAnswerPayload;
  /** Set for a firm's client: their lawyer sees chats started after they agree. */
  chatVisibility?: AdvisorChatVisibility | null;
  /** Ongoing conversations with connected law firms. */
  initialConversations?: ClientConversation[];
  /** Selected firm id from ?firm=... query param. */
  initialFirmId?: string | null;
  /** Shared AI messages across the client's visible threads, for hydrating the unified timeline. */
  initialSharedMessages?: AdvisorMessage[];
  /** Open this chat on arrival, from a lawyer's reply that quotes it. */
  initialThreadId?: string | null;
  /** ID of the signed-in user, for scoping background streams and stored preferences. */
  userId?: string | null;
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
  createdAt?: string;
  messageCount: number;
};

import type { RememberedFact } from "@/lib/advisor/memory";

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

interface InFlightAdvisorState {
  userId: string | null;
  isPending: boolean;
  streamingId: string | null;
  conversationId: string | null;
  messages: AdvisorMessage[];
  stoppedIds: string[];
  error: string | null;
  abortController: AbortController | null;
}

const backgroundStore: InFlightAdvisorState = {
  userId: null,
  isPending: false,
  streamingId: null,
  conversationId: null,
  messages: [],
  stoppedIds: [],
  error: null,
  abortController: null,
};

const storeListeners = new Set<(state: InFlightAdvisorState) => void>();

function notifyStoreListeners() {
  for (const listener of storeListeners) {
    try {
      listener(backgroundStore);
    } catch {}
  }
}

export function AdvisorWorkspace({
  advisorUsage,
  initialThreads,
  suggestedPrompts,
  welcomeMessage,
  chatVisibility = null,
  initialConversations = [],
  initialFirmId = null,
  initialSharedMessages = [],
  initialThreadId = null,
  userId = null
}: AdvisorWorkspaceProps) {
  // If the user changed (e.g. sign-out or switched user), clear background store
  if (backgroundStore.userId && backgroundStore.userId !== userId) {
    backgroundStore.userId = userId;
    backgroundStore.isPending = false;
    backgroundStore.streamingId = null;
    backgroundStore.conversationId = null;
    backgroundStore.messages = [];
    backgroundStore.stoppedIds = [];
    backgroundStore.error = null;
    backgroundStore.abortController?.abort();
    backgroundStore.abortController = null;
  } else if (!backgroundStore.userId && userId) {
    backgroundStore.userId = userId;
  }

  const [sharedMessages, setSharedMessages] = useState<AdvisorMessage[]>(initialSharedMessages);
  const [visibility, setVisibility] = useState<AdvisorChatVisibility | null>(chatVisibility);
  const [acknowledging, setAcknowledging] = useState(false);
  const [firmConversations, setFirmConversations] = useState<ClientConversation[]>(initialConversations);
  const [activeFirmId, setActiveFirmId] = useState<string>(
    initialFirmId && initialConversations.some((c) => c.firmId === initialFirmId)
      ? initialFirmId
      : initialConversations[0]?.firmId ?? ""
  );
  const activeFirmConversation =
    firmConversations.find((c) => c.firmId === activeFirmId) ?? firmConversations[0] ?? null;
  const hasFirm = Boolean((visibility && visibility.firms.length > 0) || firmConversations.length > 0);
  const needsNotice = Boolean(hasFirm && visibility?.needsNotice);
  const firmNames =
    visibility && visibility.firms.length > 0
      ? visibility.firms.map((f) => f.firmName)
      : firmConversations.map((c) => c.firmName);
  const answerLabel = aiAnswerLabel(hasFirm);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [aiPreference, setAiPreferenceState] = useState<"unasked" | "yes" | "no">("unasked");
  const [messages, setMessages] = useState<AdvisorMessage[]>(() => {
    return backgroundStore.isPending && backgroundStore.messages.length > 0
      ? backgroundStore.messages
      : [];
  });
  const [conversationId, setConversationId] = useState<string | null>(() => {
    return backgroundStore.isPending ? backgroundStore.conversationId : null;
  });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(() => backgroundStore.error);
  const [isPending, setIsPending] = useState(() => backgroundStore.isPending);
  const [streamingId, setStreamingId] = useState<string | null>(() => backgroundStore.streamingId);
  const [stoppedIds, setStoppedIds] = useState<string[]>(() => backgroundStore.stoppedIds);
  const [threads, setThreads] = useState<AdvisorThreadSummary[]>(initialThreads);
  const [facts, setFacts] = useState<RememberedFact[]>([]);
  const [openingThreadId, setOpeningThreadId] = useState<string | null>(null);
  const [isDeletingThread, setIsDeletingThread] = useState(false);
  // Start time of a chat opened from a link but missing from the list (it only shows the latest 30).
  const [openedThreadCreatedAt, setOpenedThreadCreatedAt] = useState<{ id: string; createdAt: string | null } | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(backgroundStore.abortController);

  // Subscribe to in-flight background stream updates across route changes
  useEffect(() => {
    const listener = (state: InFlightAdvisorState) => {
      setIsPending(state.isPending);
      setStreamingId(state.streamingId);
      if (state.conversationId) setConversationId(state.conversationId);
      if (state.messages.length > 0) setMessages(state.messages);
      setStoppedIds(state.stoppedIds);
      if (state.error) setError(state.error);
    };
    storeListeners.add(listener);
    if (backgroundStore.isPending || backgroundStore.messages.length > 0) {
      listener(backgroundStore);
    }
    return () => {
      storeListeners.delete(listener);
    };
  }, []);

  // Restore persisted AI preference from localStorage or active firm ack
  useEffect(() => {
    const noticePending = Boolean(chatVisibility?.needsNotice);
    const prefKey = userId ? `haven_ai_preference_${userId}` : "haven_ai_preference";
    try {
      const stored = window.localStorage.getItem(prefKey);
      if (stored === "no" || (stored === "yes" && !noticePending)) {
        setAiPreferenceState(stored);
        setPreferenceLoaded(true);
        return;
      }
    } catch {}
    if (!noticePending && chatVisibility?.firms.some((f) => f.acknowledgedAt)) {
      setAiPreferenceState("yes");
    }
    setPreferenceLoaded(true);
  }, [chatVisibility, userId]);

  // Viewing the active lawyer conversation clears its unread marker.
  useEffect(() => {
    if (!activeFirmConversation?.hasUnread) return;
    const firmId = activeFirmConversation.firmId;
    setFirmConversations((current) =>
      current.map((c) => (c.firmId === firmId ? { ...c, hasUnread: false } : c))
    );
    void markClientMessagesReadAction(firmId);
  }, [activeFirmConversation?.firmId, activeFirmConversation?.hasUnread]);

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
    if (isDeletingThread) return;
    setOpeningThreadId(threadId);
    setError(null);
    try {
      const response = await fetch(`/api/advisor/threads/${threadId}`);
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Unable to open that conversation.");
      }
      const body = (await response.json()) as { messages: AdvisorMessage[]; createdAt?: string | null };
      setMessages(body.messages);
      setOpenedThreadCreatedAt({ id: threadId, createdAt: body.createdAt ?? null });
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
  }, [isDeletingThread]);

  const startNewConversation = useCallback(() => {
    backgroundStore.isPending = false;
    backgroundStore.streamingId = null;
    backgroundStore.conversationId = null;
    backgroundStore.messages = [];
    backgroundStore.error = null;
    notifyStoreListeners();
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

      setIsDeletingThread(true);
      if (conversationId === thread.id || backgroundStore.conversationId === thread.id) {
        if (backgroundStore.isPending) {
          abortRef.current?.abort();
        }
      }

      // Optimistic: the row disappears immediately and comes back if the delete
      // fails, rather than the user clicking again because nothing happened.
      const previous = threads;
      setThreads((current) => current.filter((item) => item.id !== thread.id));

      try {
        const response = await fetch(`/api/advisor/threads/${thread.id}`, { method: "DELETE" });
        if (!response.ok) throw new Error("delete failed");
        setSharedMessages((current) => current.filter((m) => m.threadId !== thread.id));
        if (backgroundStore.conversationId === thread.id) {
          backgroundStore.conversationId = null;
          backgroundStore.messages = [];
          backgroundStore.isPending = false;
          backgroundStore.streamingId = null;
          notifyStoreListeners();
        }
        if (conversationId === thread.id) {
          setMessages([]);
          setConversationId(null);
          setStoppedIds([]);
        }
      } catch {
        setThreads(previous);
        setError("Haven couldn't delete that conversation. Try again in a moment.");
      } finally {
        setIsDeletingThread(false);
      }
    },
    [conversationId, threads]
  );

  // Which firms see the open chat. A new chat is shared with every firm the
  // client has agreed to; an older one only with firms they agreed to before it began.
  // An open chat uses its start time. When that time isn't known yet, the line
  // makes no claim either way (undefined hides it).
  const activeCreatedAt: string | null | undefined = !conversationId
    ? null
    : threads.find((t) => t.id === conversationId)?.createdAt ??
      (openedThreadCreatedAt?.id === conversationId ? openedThreadCreatedAt.createdAt ?? undefined : undefined);
  const seeingFirms: string[] | undefined = !hasFirm
    ? []
    : activeCreatedAt === undefined
      ? undefined
      : activeCreatedAt === null
        ? (visibility?.firms ?? []).filter((f) => f.acknowledgedAt).map((f) => f.firmName)
        : (visibility?.firms ?? [])
            .filter((f) => isThreadVisibleToFirm(activeCreatedAt, f.acknowledgedAt))
            .map((f) => f.firmName);
  const viewingPrivateThread = Boolean(hasFirm && conversationId && seeingFirms !== undefined && seeingFirms.length === 0);

  const acknowledgeNotice = useCallback(async () => {
    setAcknowledging(true);
    setError(null);
    try {
      // Only the firms this notice named; a firm joined since then gets its own notice.
      const next = await acknowledgeChatVisibilityAction(visibility?.firms.map((f) => f.firmId) ?? []);
      setVisibility({
        firms: next.firms.map((f) => ({ firmId: f.firmId, firmName: f.firmName, acknowledgedAt: f.acknowledgedAt })),
        needsNotice: next.needsNotice
      });
    } catch {
      setError("Haven couldn't save that just now. Try again in a moment.");
    } finally {
      setAcknowledging(false);
    }
    // Re-created when the notice's firm list changes, so "Got it" sends the firms on screen.
  }, [visibility]);

  const chooseAiPreference = useCallback(
    async (choice: "yes" | "no") => {
      setAiPreferenceState(choice);
      const prefKey = userId ? `haven_ai_preference_${userId}` : "haven_ai_preference";
      try {
        window.localStorage.setItem(prefKey, choice);
      } catch {}
      setError(null);
      if (choice === "yes" && needsNotice) {
        await acknowledgeNotice();
      }
    },
    [acknowledgeNotice, needsNotice, userId]
  );

  useEffect(() => {
    if (initialThreadId) void openThread(initialThreadId);
    // Only on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draftLength = draft.trim().length;
  const overLimit = draftLength > MESSAGE_CHAR_LIMIT;
  const nearLimit = draftLength > MESSAGE_CHAR_LIMIT * 0.8;
  const historyTrimmed = messages.length > HISTORY_LIMIT;
  const needsAiChoice = Boolean(hasFirm && !viewingPrivateThread && preferenceLoaded && aiPreference === "unasked");

  function stopAnswer() {
    backgroundStore.abortController?.abort();
    backgroundStore.abortController = null;
    abortRef.current?.abort();
    abortRef.current = null;
  }

  // Merge lawyer conversation messages (client + lawyer) with AI conversation turns
  // in chronological order when viewing the ongoing lawyer conversation.
  const unifiedItems = useMemo(() => {
    if (!hasFirm || viewingPrivateThread) {
      return messages.map((m) => ({ kind: "advisor" as const, createdAt: m.createdAt, message: m }));
    }
    const lawyerMessages = activeFirmConversation?.messages ?? [];
    const clientFirmTimes = lawyerMessages
      .filter((m) => m.senderRole === "client")
      .map((m) => ({ body: m.body.trim(), time: new Date(m.createdAt).getTime() }));

    const items: (
      | { kind: "advisor"; createdAt: string; message: AdvisorMessage }
      | { kind: "firm"; createdAt: string; message: ConversationMessage }
    )[] = [];

    for (const fm of lawyerMessages) {
      items.push({ kind: "firm", createdAt: fm.createdAt, message: fm });
    }

    const selectedFirmAck = visibility?.firms.find(
      (f) => f.firmId === activeFirmConversation?.firmId
    )?.acknowledgedAt;

    const visibleSharedMessages = sharedMessages.filter((am) => {
      if (!selectedFirmAck) return false;
      const threadCreatedAt =
        threads.find((t) => t.id === am.threadId)?.createdAt ??
        (openedThreadCreatedAt?.id === am.threadId ? openedThreadCreatedAt.createdAt : undefined) ??
        (am.threadId === "session" ? am.createdAt : undefined);
      if (!threadCreatedAt) return false;
      return isThreadVisibleToFirm(threadCreatedAt, selectedFirmAck);
    });

    const combinedAdvisorMessages = [...visibleSharedMessages];
    for (const m of messages) {
      const isDuplicate = visibleSharedMessages.some((existing) => {
        if (existing.id === m.id) return true;
        if (existing.traceId && m.traceId && existing.traceId === m.traceId) return true;
        if (
          existing.role === m.role &&
          existing.content.trim() === m.content.trim() &&
          Math.abs(new Date(existing.createdAt).getTime() - new Date(m.createdAt).getTime()) < 60_000
        ) {
          return true;
        }
        return false;
      });
      if (!isDuplicate) {
        combinedAdvisorMessages.push(m);
      }
    }

    for (const am of combinedAdvisorMessages) {
      if (am.role === "user") {
        const amTime = new Date(am.createdAt).getTime();
        const isDuplicateOfFirmMessage = clientFirmTimes.some(
          (u) => u.body === am.content.trim() && Math.abs(u.time - amTime) < 60_000
        );
        if (isDuplicateOfFirmMessage) continue;
      }
      items.push({ kind: "advisor", createdAt: am.createdAt, message: am });
    }

    return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [
    activeFirmConversation?.firmId,
    activeFirmConversation?.messages,
    hasFirm,
    messages,
    sharedMessages,
    threads,
    viewingPrivateThread,
    visibility?.firms,
  ]);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [unifiedItems, isPending]);

  async function sendMessage(rawMessage?: string) {
    const content = (rawMessage ?? draft).trim();
    if (!content || isPending || isDeletingThread || needsAiChoice || openingThreadId !== null) return;

    if (content.length > MESSAGE_CHAR_LIMIT) {
      setError(
        `That message is ${content.length.toLocaleString()} characters and the limit is ${MESSAGE_CHAR_LIMIT.toLocaleString()}. Your text is still here — try sending the most important part first, then add the rest as a follow-up.`
      );
      return;
    }

    setError(null);
    setDraft("");
    setIsPending(true);

    const nowIso = new Date().toISOString();

    if (hasFirm && !viewingPrivateThread && !activeFirmConversation) {
      setError("Your lawyer conversation could not be loaded. Try reloading the page.");
      setIsPending(false);
      setDraft(content);
      return;
    }

    // When messaging the lawyer with AI answers OFF, send directly to the lawyer conversation.
    if (hasFirm && !viewingPrivateThread && aiPreference === "no" && activeFirmConversation) {
      const targetFirmId = activeFirmConversation.firmId;
      const optimisticFirmMessage: ConversationMessage = {
        id: `tmp-firm-${Date.now()}`,
        senderRole: "client",
        senderName: "You",
        body: content,
        source: "dashboard",
        createdAt: nowIso,
        aiAnswerQuote: null
      };
      setFirmConversations((current) =>
        current.map((c) =>
          c.firmId === targetFirmId ? { ...c, messages: [...c.messages, optimisticFirmMessage] } : c
        )
      );
      try {
        const result = await sendClientMessageAction({ firmId: targetFirmId, body: content });
        if (result.status !== "sent" && result.status !== "already_sent") {
          setFirmConversations((current) =>
            current.map((c) =>
              c.firmId === targetFirmId
                ? { ...c, messages: c.messages.filter((m) => m.id !== optimisticFirmMessage.id) }
                : c
            )
          );
          setDraft(content);
          setError(result.status === "invalid" ? result.error : "That didn't send. Try again in a moment.");
        }
      } catch {
        setFirmConversations((current) =>
          current.map((c) =>
            c.firmId === targetFirmId
              ? { ...c, messages: c.messages.filter((m) => m.id !== optimisticFirmMessage.id) }
              : c
          )
        );
        setDraft(content);
        setError("That didn't send. Try again in a moment.");
      } finally {
        setIsPending(false);
      }
      return;
    }

    let lawyerMessageDelivered = false;

    // When AI answers are ON for a firm client, ensure visibility is acknowledged and
    // record the message in the lawyer's conversation so the lawyer gets alerted.
    if (hasFirm && !viewingPrivateThread && activeFirmConversation) {
      if (needsNotice) {
        try {
          const next = await acknowledgeChatVisibilityAction(visibility?.firms.map((f) => f.firmId) ?? []);
          setVisibility({
            firms: next.firms.map((f) => ({ firmId: f.firmId, firmName: f.firmName, acknowledgedAt: f.acknowledgedAt })),
            needsNotice: next.needsNotice
          });
        } catch {
          setDraft(content);
          setIsPending(false);
          setError("Haven couldn't save that just now. Try again in a moment.");
          return;
        }
      }

      const targetFirmId = activeFirmConversation.firmId;
      const optimisticFirmMessage: ConversationMessage = {
        id: `tmp-firm-${Date.now()}`,
        senderRole: "client",
        senderName: "You",
        body: content,
        source: "dashboard",
        createdAt: nowIso,
        aiAnswerQuote: null
      };
      setFirmConversations((current) =>
        current.map((c) =>
          c.firmId === targetFirmId ? { ...c, messages: [...c.messages, optimisticFirmMessage] } : c
        )
      );

      try {
        const result = await sendClientMessageAction({ firmId: targetFirmId, body: content });
        if (result.status !== "sent" && result.status !== "already_sent") {
          setFirmConversations((current) =>
            current.map((c) =>
              c.firmId === targetFirmId
                ? { ...c, messages: c.messages.filter((m) => m.id !== optimisticFirmMessage.id) }
                : c
            )
          );
          setDraft(content);
          setIsPending(false);
          setError(result.status === "invalid" ? result.error : "That didn't send to your lawyer. Try again in a moment.");
          return;
        }
        lawyerMessageDelivered = true;
      } catch {
        setFirmConversations((current) =>
          current.map((c) =>
            c.firmId === targetFirmId
              ? { ...c, messages: c.messages.filter((m) => m.id !== optimisticFirmMessage.id) }
              : c
          )
        );
        setDraft(content);
        setIsPending(false);
        setError("That didn't send to your lawyer. Try again in a moment.");
        return;
      }
    }

    const optimisticUserMessage: AdvisorMessage = {
      id: `tmp-user-${Date.now()}`,
      threadId: conversationId ?? "session",
      role: "user",
      content,
      createdAt: nowIso,
    };

    const sid = `streaming-${Date.now()}`;
    const nextMessages = [...messages, optimisticUserMessage];
    const controller = new AbortController();
    abortRef.current = controller;

    backgroundStore.userId = userId;
    backgroundStore.isPending = true;
    backgroundStore.streamingId = sid;
    backgroundStore.conversationId = conversationId;
    backgroundStore.messages = nextMessages;
    backgroundStore.error = null;
    backgroundStore.abortController = controller;
    notifyStoreListeners();

    setStreamingId(sid);
    setMessages(nextMessages);
    setTimeout(() => {
      const messagesWithEmptyAssistant = [...nextMessages, {
        id: sid,
        threadId: "session",
        role: "assistant" as const,
        content: "",
        createdAt: new Date().toISOString(),
      }];
      backgroundStore.messages = messagesWithEmptyAssistant;
      notifyStoreListeners();
      setMessages(messagesWithEmptyAssistant);
    }, 0);

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
        const errorBody = (await response.json().catch(() => ({ error: "Unable to send message." }))) as {
          error?: string;
          firms?: AdvisorChatVisibility["firms"];
        };
        if (errorBody.error === "needs_notice") {
          // Joined a firm since this page loaded: show the notice for exactly
          // the firms the server listed, so "Got it" covers only those.
          setVisibility({ firms: errorBody.firms ?? [], needsNotice: true });
          backgroundStore.isPending = false;
          backgroundStore.streamingId = null;
          backgroundStore.messages = messages;
          notifyStoreListeners();
          setDraft(content);
          setMessages(messages);
          setStreamingId(null);
          return;
        }
        throw new Error(errorBody.error ?? "Unable to send message.");
      }

      if (!response.body) throw new Error("No response stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = "";
      let streamText = "";
      let streamFinished = false;

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
            backgroundStore.conversationId = event.conversationId;
            notifyStoreListeners();
            // A chat reserved just now: keep the server's start time, so the sharing line
            // stays right even if this first answer is stopped and never reaches the list.
            // Unknown time means the line claims no firm sees it.
            if (event.conversationId && event.createdAt) {
              setOpenedThreadCreatedAt({ id: event.conversationId, createdAt: event.createdAt });
            }
          } else if (event.type === "delta" || event.type === "replace") {
            // `replace` carries the whole reviewed answer, sent when a safety
            // correction or cleanup changed text already on screen.
            streamText = event.type === "replace" ? event.text : streamText + event.text;
            const updatedMessages = [...nextMessages, {
              id: sid,
              threadId: "session",
              role: "assistant" as const,
              content: streamText,
              createdAt: new Date().toISOString(),
            }];
            backgroundStore.messages = updatedMessages;
            notifyStoreListeners();
            setMessages(updatedMessages);
          } else if (event.type === "done") {
            streamFinished = true;
            const finalMessages = [...nextMessages, event.assistantMessage];
            backgroundStore.isPending = false;
            backgroundStore.streamingId = null;
            backgroundStore.conversationId = event.conversationId ?? null;
            backgroundStore.messages = finalMessages;
            notifyStoreListeners();

            setConversationId(event.conversationId ?? null);
            setMessages(finalMessages);
            const userMsgForShared: AdvisorMessage = {
              ...optimisticUserMessage,
              threadId: event.conversationId ?? conversationId ?? "session",
            };
            if (!viewingPrivateThread) {
              setSharedMessages((current) => {
                const withoutDupes = current.filter((existing) => {
                  if (existing.id === userMsgForShared.id || existing.id === event.assistantMessage.id) return false;
                  if (
                    event.assistantMessage.traceId &&
                    existing.traceId &&
                    existing.traceId === event.assistantMessage.traceId
                  ) {
                    return false;
                  }
                  return true;
                });
                return [...withoutDupes, userMsgForShared, event.assistantMessage];
              });
            }
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

      if (!streamFinished) {
        if (streamText) {
          const nextStopped = [...stoppedIds, sid];
          backgroundStore.stoppedIds = nextStopped;
          setStoppedIds(nextStopped);
          const retryMsg = "The connection closed before the answer finished. Try asking again to get the full response.";
          setError(retryMsg);
          backgroundStore.error = retryMsg;
        }
        setStreamingId(null);
        backgroundStore.streamingId = null;
        notifyStoreListeners();
      }
    } catch (caughtError) {
      // A user-initiated stop is not an error: keep whatever streamed, mark it
      // incomplete, and leave the disclaimer in place (CD-1.15).
      if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
        const nextStopped = [...stoppedIds, sid];
        backgroundStore.stoppedIds = nextStopped;
        backgroundStore.isPending = false;
        backgroundStore.streamingId = null;
        notifyStoreListeners();
        setStoppedIds(nextStopped);
        setStreamingId(null);
      } else {
        const raw = caughtError instanceof Error ? caughtError.message : "";
        const errorMsg = lawyerMessageDelivered
          ? "Haven couldn't reach the advisor for an instant AI answer just now. Your message was still sent to your lawyer, and they will respond once they see it."
          : raw && !/^Unable to send message\.?$/i.test(raw)
            ? raw
            : "Haven couldn't reach the advisor just now. Your question wasn't sent — try again in a moment, and if it keeps happening, reload the page.";
        backgroundStore.error = errorMsg;
        backgroundStore.messages = nextMessages;
        backgroundStore.isPending = false;
        backgroundStore.streamingId = null;
        notifyStoreListeners();
        setError(errorMsg);
        setMessages(nextMessages);
        setStreamingId(null);
      }
    } finally {
      abortRef.current = null;
      backgroundStore.abortController = null;
      backgroundStore.isPending = false;
      notifyStoreListeners();
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
                      disabled={isPending || openingThreadId !== null || isDeletingThread}
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
                      disabled={isPending || openingThreadId !== null || isDeletingThread}
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
          {hasFirm && !viewingPrivateThread ? (
            <div className="space-y-1">
              <h2 className="text-h3" id="messages-heading">
                Messages with your lawyer
              </h2>
              <p className="text-caption text-[var(--haven-ink-mid)]">
                You&apos;ll get an email when your lawyer replies.
              </p>
              {firmConversations.length > 1 ? (
                <div className="mt-2 flex flex-wrap gap-2" role="tablist" aria-label="Law firms">
                  {firmConversations.map((c) => (
                    <button
                      aria-selected={c.firmId === activeFirmConversation?.firmId}
                      className={`min-h-9 rounded-full border px-3.5 py-1.5 text-sm ${
                        c.firmId === activeFirmConversation?.firmId
                          ? "border-[var(--haven-sage)] bg-[var(--haven-sage-light)] text-[var(--haven-ink)]"
                          : "border-[var(--color-border)] bg-[var(--haven-white)] text-[var(--haven-ink-mid)]"
                      }`}
                      key={c.firmId}
                      onClick={() => setActiveFirmId(c.firmId)}
                      role="tab"
                      type="button"
                    >
                      {c.firmName}
                      {c.hasUnread && c.firmId !== activeFirmConversation?.firmId ? (
                        <span
                          className="ml-2 inline-block h-2 w-2 rounded-full bg-[var(--haven-blush-ink)]"
                          aria-label="new message"
                        />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : activeFirmConversation ? (
                <p className="text-body-sm text-[var(--haven-ink-mid)]">{activeFirmConversation.firmName}</p>
              ) : null}
            </div>
          ) : (
            <div />
          )}
          {/* Was "Reset", which read as "clear the screen" while actually
              abandoning a conversation the user had already paid for out of their
              daily five. Now that conversations are saved, this really does start a
              new one and the old one stays in the list above. */}
          {(!hasFirm || viewingPrivateThread || messages.length > 0) && (
            <Button
              disabled={isPending || (!viewingPrivateThread && messages.length === 0)}
              onClick={startNewConversation}
              size="sm"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              {hasFirm && viewingPrivateThread
                ? `Back to messages with ${activeFirmConversation?.firmName ?? "your lawyer"}`
                : "New conversation"}
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {hasFirm && viewingPrivateThread && (
            <p className="rounded-[var(--radius-lg)] bg-[var(--haven-sage-light)] px-4 py-2.5 text-body-sm text-[var(--haven-ink)]">
              This older chat is private to you. It started before you chose to share chats with your lawyer.
            </p>
          )}
          {hasFirm && !viewingPrivateThread && needsAiChoice && (
            <div
              className="rounded-[var(--radius-xl)] border border-[var(--haven-sage)] bg-[var(--haven-sage-light)] p-4"
              role="region"
              aria-label="Do you want AI answers?"
            >
              <p className="text-h3">Do you want AI answers?</p>
              <p className="text-body-sm mt-2 text-[var(--haven-ink)]">
                Would you like Haven&apos;s AI to answer your question first while you wait for{" "}
                {activeFirmConversation?.firmName ?? visibilityNoticeText(firmNames)}?
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={acknowledging} onClick={() => void chooseAiPreference("yes")} size="sm">
                  {acknowledging ? "Saving…" : "Yes"}
                </Button>
                <Button
                  disabled={acknowledging}
                  onClick={() => void chooseAiPreference("no")}
                  size="sm"
                  variant="outline"
                >
                  No, only message my lawyer
                </Button>
              </div>
            </div>
          )}
          {hasFirm && !viewingPrivateThread && preferenceLoaded && aiPreference === "yes" && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-lg)] bg-[var(--haven-sage-light)] px-4 py-2.5">
              <p className="text-body-sm text-[var(--haven-ink)]">
                The AI will answer first, but it may not be 100% accurate, and your lawyer will respond once they see your message.
              </p>
              <button
                className="text-caption font-medium text-[var(--haven-ink)] underline underline-offset-2"
                onClick={() => void chooseAiPreference("no")}
                type="button"
              >
                Turn off AI answers
              </button>
            </div>
          )}
          {hasFirm && !viewingPrivateThread && preferenceLoaded && aiPreference === "no" && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-lg)] bg-[var(--haven-sand)] px-4 py-2.5">
              <p className="text-body-sm text-[var(--haven-ink)]">
                AI answers are off. Your lawyer at {activeFirmConversation?.firmName ?? "your law firm"} will respond once they see your message.
              </p>
              <button
                className="text-caption font-medium text-[var(--haven-ink)] underline underline-offset-2"
                onClick={() => void chooseAiPreference("yes")}
                type="button"
              >
                Turn on AI answers
              </button>
            </div>
          )}
          <div ref={scrollerRef} className="max-h-[620px] space-y-4 overflow-y-auto pr-1">
            {unifiedItems.length === 0 ? (
              hasFirm && !viewingPrivateThread && aiPreference !== "yes" ? (
                <p className="text-body-sm text-[var(--haven-ink-mid)]">
                  No messages yet. Write to {activeFirmConversation?.firmName ?? "your lawyer"} below.
                </p>
              ) : (
                <AdvisorAnswerCard
                  aiLabel={answerLabel}
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
              )
            ) : (
              unifiedItems.map((item) =>
                item.kind === "firm" ? (
                  item.message.senderRole === "lawyer" ? (
                    <LawyerMessageCard
                      key={`firm-${item.message.id}`}
                      message={item.message}
                      onOpenChat={(chatId) => {
                        if (!isDeletingThread) void openThread(chatId);
                      }}
                    />
                  ) : (
                    <UserMessageCard
                      key={`firm-${item.message.id}`}
                      message={{
                        id: item.message.id,
                        threadId: "firm",
                        role: "user",
                        content: item.message.body,
                        createdAt: item.message.createdAt,
                      }}
                      subtitle={item.message.source === "onboarding" ? "sent during setup" : undefined}
                    />
                  )
                ) : item.message.role === "assistant" ? (
                  <AdvisorAnswerCard
                    aiLabel={answerLabel}
                    key={item.message.id}
                    isPending={item.message.id === streamingId}
                    message={item.message}
                    onFollowUp={needsAiChoice || openingThreadId !== null ? undefined : (question) => void sendMessage(question)}
                    stopped={stoppedIds.includes(item.message.id)}
                    traceId={item.message.traceId ?? null}
                  />
                ) : (
                  <UserMessageCard key={item.message.id} message={item.message} />
                )
              )
            )}
          </div>

          {error && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--haven-blush)] bg-[var(--haven-blush-light)] px-4 py-3 text-body-sm text-[var(--haven-blush-ink)]">
              {error}
            </div>
          )}

          {unifiedItems.length === 0 && (!hasFirm || aiPreference === "yes") && suggestedPrompts.length > 0 && (
            <div className="space-y-2">
              <p className="text-caption text-[var(--color-text-secondary)]">Not sure where to start?</p>
              <div className="flex flex-wrap gap-2">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    className="rounded-full border border-[var(--color-border)] bg-[var(--haven-white)] px-3 py-1.5 text-left text-caption transition-colors hover:border-[var(--haven-sage-mid)] hover:bg-[var(--haven-sage-light)] disabled:opacity-50"
                    disabled={isPending || needsAiChoice || openingThreadId !== null || isDeletingThread}
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
              aria-label={
                hasFirm && !viewingPrivateThread
                  ? `Message to ${activeFirmConversation?.firmName ?? "your lawyer"}`
                  : "Ask Haven a question"
              }
              className="min-h-[120px] bg-[var(--haven-white)]"
              disabled={needsAiChoice || openingThreadId !== null || isDeletingThread}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={
                hasFirm && !viewingPrivateThread
                  ? `Write to ${activeFirmConversation?.firmName ?? "your lawyer"}`
                  : "Ask about H-1B, PERM, I-140, I-485, the visa bulletin, or how your Haven timeline fits those rules."
              }
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
                {hasFirm && !viewingPrivateThread && aiPreference === "no" ? (
                  <>Sent directly to {activeFirmConversation?.firmName ?? "your lawyer"}. They get an email alert when you write.</>
                ) : (
                  <>
                    Official sources first, then your Haven profile, then community context as anecdotal backup. Your
                    question and the relevant parts of your profile are sent to an AI provider to produce the answer —{" "}
                    <a className="underline underline-offset-2" href="/privacy">
                      how Haven handles your data
                    </a>
                    .
                  </>
                )}
              </p>
              {isPending ? (
                <Button onClick={stopAnswer} size="sm" variant="outline">
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </Button>
              ) : (
                <Button
                  disabled={needsAiChoice || openingThreadId !== null || overLimit || draftLength === 0 || isDeletingThread}
                  onClick={() => void sendMessage()}
                  size="sm"
                >
                  <SendHorizonal className="h-4 w-4" />
                  {hasFirm && !viewingPrivateThread ? "Send" : "Ask Haven"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What Haven remembers & case memory, with ability to add/remove memories. */}
      <CaseMemoryCard
        initialFacts={facts}
        onFactAdded={(fact) => setFacts((prev) => [fact, ...prev.filter((f) => f.id !== fact.id)])}
        onFactForgotten={(factId) => setFacts((prev) => prev.filter((f) => f.id !== factId))}
      />

      <div className="px-1">
        {/* Counts conversations, not questions — follow-ups within a thread are
            unlimited and free. Saying "questions" both undersells the product and
            hides what Reset actually costs. */}
        <p className="text-caption text-[var(--color-text-secondary)]">
          {advisorUsage.unlimited
            ? "Unlimited conversations (admin account)"
            : `${advisorUsage.remaining} of ${advisorUsage.limit} conversations left · ${advisorUsage.renewalLabel} · follow-up questions in this conversation are unlimited`}
        </p>
      </div>
    </div>
  );
}

function formatMessageWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function UserMessageCard({ message, subtitle }: { message: AdvisorMessage; subtitle?: string }) {
  const when = formatMessageWhen(message.createdAt);
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-[var(--radius-xl)] bg-[var(--haven-ink)] px-5 py-4 text-white">
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] uppercase tracking-[0.08em] text-[rgba(253,250,246,0.72)]">
          <User2 className="h-3.5 w-3.5" />
          <span>You</span>
          {when ? <span className="normal-case tracking-normal">· {when}</span> : null}
          {subtitle ? <span className="normal-case tracking-normal">· {subtitle}</span> : null}
        </div>
        <p className="whitespace-pre-wrap text-body-sm text-white">{message.content}</p>
      </div>
    </div>
  );
}

function LawyerMessageCard({
  message,
  onOpenChat
}: {
  message: ConversationMessage;
  onOpenChat: (chatId: string) => void;
}) {
  const who = message.senderName || "Your lawyer";
  const when = formatMessageWhen(message.createdAt);
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-[var(--radius-xl)] border border-[var(--haven-sage)] bg-[var(--haven-white)] px-5 py-4 shadow-[0_6px_20px_rgba(37,44,39,0.04)]">
        <p className="text-caption text-[var(--haven-ink-mid)]">
          <span className="font-semibold text-[var(--haven-ink)]">{who}</span>
          {when ? ` · ${when}` : ""}
        </p>
        {message.aiAnswerQuote ? (
          "deleted" in message.aiAnswerQuote ? (
            <p className="mt-2 border-l-2 border-[var(--color-border)] pl-3 text-caption italic text-[var(--haven-ink-mid)]">
              The AI chat this refers to was deleted
            </p>
          ) : (
            <div className="mt-2 border-l-2 border-[var(--haven-sage)] pl-3">
              <p className="text-caption text-[var(--haven-ink-mid)]">About this Haven AI answer:</p>
              <p className="text-caption italic text-[var(--haven-ink)]">&ldquo;{message.aiAnswerQuote.excerpt}&rdquo;</p>
              <button
                className="text-caption underline underline-offset-2"
                onClick={() => onOpenChat(message.aiAnswerQuote && !("deleted" in message.aiAnswerQuote) ? message.aiAnswerQuote.chatId : "")}
                type="button"
              >
                Open that chat
              </button>
            </div>
          )
        ) : null}
        <p className="mt-2 whitespace-pre-wrap break-words text-body-sm text-[var(--haven-ink)]">{message.body}</p>
      </div>
    </div>
  );
}

const REPORT_REASONS = ["Wrong facts", "Didn't fit my case", "Confusing", "Out of date"];

/**
 * "Let [firm] know", under a firm client's lawyer handoff.
 *
 * Shows exactly what the firm will receive before anything is sent, and sends
 * only the answer's trace id: the server reads the offer from the stored answer
 * and the firm from the person's own record, so nothing typed here or in the
 * conversation can reach the firm. Whether a request is already open is asked
 * on render, so a reloaded answer reflects what the firm has done since.
 */
function FirmContactOffer({ offer, traceId }: { offer: AdvisorFirmContactOffer; traceId: string }) {
  const [state, setState] = useState<"checking" | "idle" | "previewing" | "sending" | "sent" | "error">("checking");
  const [sentAt, setSentAt] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getFirmContactRequestStatusAction()
      .then((status) => {
        if (!live) return;
        setSentAt(status.sentAt);
        setState(status.sentAt ? "sent" : "idle");
      })
      .catch(() => live && setState("idle"));
    return () => {
      live = false;
    };
  }, []);

  const send = useCallback(async () => {
    setState("sending");
    try {
      const result = await sendFirmContactRequestAction(traceId);
      if (result.status === "sent" || result.status === "already_sent") {
        setSentAt(result.sentAt);
        setState("sent");
        trackEvent("advisor_firm_contact_requested", { alreadyOpen: result.status === "already_sent" });
        return;
      }
      setState("error");
    } catch {
      setState("error");
    }
  }, [traceId]);

  if (state === "checking") return null;

  if (state === "sent") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--haven-sage-mid)] bg-[var(--haven-sage-light)] px-4 py-3">
        <p className="text-body-sm text-[var(--haven-ink)]">
          {offer.firmName} has your request{sentAt ? ` (sent ${relativeTime(sentAt)})` : ""}. They see the dates and questions
          above, not this conversation.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-sand)] p-4">
      {state === "previewing" || state === "sending" ? (
        <>
          <p className="text-body-sm font-medium text-[var(--haven-ink)]">What {offer.firmName} will see</p>
          <p className="mt-1 text-caption text-[var(--color-text-secondary)]">
            Only this. Nothing you wrote here, and none of Haven&apos;s answer.
          </p>
          <div className="mt-3 space-y-2 text-body-sm text-[var(--haven-ink)]">
            <p>
              <span className="font-medium">About:</span> {offer.practiceArea}
            </p>
            {offer.dates.length > 0 && (
              <ul className="list-disc space-y-1 pl-5">
                {offer.dates.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
            <ul className="list-disc space-y-1 pl-5">
              {offer.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              className="rounded-full bg-[var(--haven-ink)] px-4 py-2 text-[13px] font-medium text-[var(--haven-cream)] transition-colors hover:bg-[var(--haven-ink-mid)] disabled:opacity-60"
              disabled={state === "sending"}
              onClick={() => void send()}
              type="button"
            >
              {state === "sending" ? "Sending…" : `Send to ${offer.firmName}`}
            </button>
            <button
              className="text-caption text-[var(--color-text-secondary)] transition-colors hover:text-[var(--haven-ink)]"
              disabled={state === "sending"}
              onClick={() => setState("idle")}
              type="button"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-full bg-[var(--haven-ink)] px-4 py-2 text-[13px] font-medium text-[var(--haven-cream)] transition-colors hover:bg-[var(--haven-ink-mid)]"
            onClick={() => setState("previewing")}
            type="button"
          >
            Let {offer.firmName} know
          </button>
          <p className="text-caption text-[var(--color-text-secondary)]">
            {state === "error" ? "That didn't go through. Try again in a moment." : "Ask them to get in touch. You'll see what they get first."}
          </p>
        </div>
      )}
    </div>
  );
}

function AdvisorAnswerCard({
  message,
  isPending,
  traceId,
  stopped = false,
  onFollowUp,
  aiLabel,
}: {
  message: AdvisorMessage;
  isPending: boolean;
  traceId: string | null;
  stopped?: boolean;
  onFollowUp?: (question: string) => void;
  /** Fixed "AI can make mistakes" line under every answer; never from the model. */
  aiLabel: string;
}) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);
  // A thumbs-down on its own only says an answer was bad, never what was wrong
  // with it, which is not enough to fix anything. Asking is the whole point.
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTags, setReportTags] = useState<string[]>([]);
  const [reportNote, setReportNote] = useState("");

  const send = useCallback(async (score: "up" | "down", comment?: string) => {
    if (!traceId) return;
    try {
      await fetch("/api/advisor/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(comment ? { traceId, score, comment } : { traceId, score }),
      });
    } catch {
      // Fire and forget — never surface observability errors to the user.
    }
  }, [traceId]);

  const submitFeedback = useCallback((score: "up" | "down") => {
    if (feedbackSent || !traceId || isPending) return;
    setFeedback(score);
    if (score === "down") {
      // Record the downvote now, so walking away from the form still counts.
      // The detail below upserts onto this same score rather than adding one.
      void send("down");
      setReportOpen(true);
      return;
    }
    setReportOpen(false);
    setFeedbackSent(true);
    void send("up");
  }, [feedbackSent, traceId, isPending, send]);

  const submitReport = useCallback(() => {
    const note = reportNote.trim();
    const parts = [...reportTags, ...(note ? [note] : [])];
    setFeedbackSent(true);
    setReportOpen(false);
    void send("down", parts.length ? parts.join(" — ").slice(0, 500) : undefined);
  }, [reportTags, reportNote, send]);

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

        {/* Fixed text from the page, not the model, so no answer can drop it
            (specs/advisor-chat-firm-visibility). */}
        {!isPending && (
          <p className="mt-3 text-caption font-medium text-[var(--haven-ink-mid)]" data-testid="ai-answer-label">
            {aiLabel}
          </p>
        )}

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

            {traceId && message.answerPayload.firm_contact_offer && (
              <FirmContactOffer offer={message.answerPayload.firm_contact_offer} traceId={traceId} />
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
              <div className="pt-1">
                <div className="flex items-center gap-3">
                  <p className="text-caption text-[var(--color-text-secondary)]">
                    Something wrong with this answer?
                  </p>
                  <button
                    aria-label="This answer was helpful"
                    className={`rounded-full p-1.5 transition-colors ${feedback === "up" ? "bg-[var(--haven-sage-light)] text-[var(--haven-ink)]" : "text-[var(--color-text-secondary)] hover:text-[var(--haven-ink)]"}`}
                    disabled={feedbackSent}
                    onClick={() => submitFeedback("up")}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    aria-label="Report a problem with this answer"
                    className={`rounded-full p-1.5 transition-colors ${feedback === "down" ? "bg-red-50 text-red-500" : "text-[var(--color-text-secondary)] hover:text-red-400"}`}
                    disabled={feedbackSent}
                    onClick={() => submitFeedback("down")}
                  >
                    <ThumbsDown className="h-3.5 w-3.5" />
                  </button>
                  {feedbackSent && (
                    <p className="text-caption text-[var(--color-text-secondary)]">
                      {feedback === "down" ? "Thanks — we'll look at this one." : "Thanks for the feedback."}
                    </p>
                  )}
                </div>

                {reportOpen && (
                  <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--haven-sand)] p-4">
                    <p className="text-body-sm font-medium text-[var(--haven-ink)]">What was off?</p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {REPORT_REASONS.map((reason) => {
                        const picked = reportTags.includes(reason);

                        return (
                          <button
                            aria-pressed={picked}
                            className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${picked ? "border-[var(--haven-ink)] bg-[var(--haven-ink)] text-[var(--haven-cream)]" : "border-[var(--color-border)] bg-[var(--haven-white)] text-[var(--haven-ink-mid)] hover:border-[var(--haven-ink)]"}`}
                            key={reason}
                            onClick={() =>
                              setReportTags((current) =>
                                current.includes(reason)
                                  ? current.filter((item) => item !== reason)
                                  : [...current, reason]
                              )
                            }
                            type="button"
                          >
                            {reason}
                          </button>
                        );
                      })}
                    </div>
                    <label className="sr-only" htmlFor={`report-note-${traceId}`}>
                      Anything else about what was wrong
                    </label>
                    <textarea
                      className="mt-3 min-h-[72px] w-full resize-none rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--haven-white)] p-3 text-body-sm text-[var(--haven-ink)] outline-none placeholder:text-[var(--color-text-secondary)]"
                      id={`report-note-${traceId}`}
                      maxLength={400}
                      onChange={(event) => setReportNote(event.target.value)}
                      placeholder="Optional: what did it get wrong?"
                      value={reportNote}
                    />
                    <div className="mt-3 flex items-center gap-3">
                      <button
                        className="rounded-full bg-[var(--haven-ink)] px-4 py-2 text-[13px] font-medium text-[var(--haven-cream)] transition-colors hover:bg-[var(--haven-ink-mid)]"
                        onClick={submitReport}
                        type="button"
                      >
                        Send report
                      </button>
                      <button
                        className="text-caption text-[var(--color-text-secondary)] transition-colors hover:text-[var(--haven-ink)]"
                        onClick={submitReport}
                        type="button"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
