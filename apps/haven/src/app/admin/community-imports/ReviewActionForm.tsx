"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reviewCommunityImportAction, type ReviewCommunityImportActionState } from "@/server/community-import-actions";

const initialState: ReviewCommunityImportActionState = {
  message: "",
  status: "idle"
};

function SubmitButton({
  children,
  intent,
  variant
}: {
  children: ReactNode;
  intent: "approve" | "reject" | "unpublish";
  variant?: "default" | "destructive" | "outline";
}) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} name="intent" type="submit" value={intent} variant={variant}>
      {pending && intent === "approve" ? "Working..." : children}
    </Button>
  );
}

export function ReviewActionForm({
  itemId,
  moderationNotes,
  publishedPostId
}: {
  itemId: string;
  moderationNotes: string | null;
  publishedPostId: string | null;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(reviewCommunityImportAction, initialState);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form action={formAction} className="space-y-3">
      <input name="itemId" type="hidden" value={itemId} />
      <Textarea
        defaultValue={moderationNotes ?? ""}
        name="moderationNotes"
        placeholder="Internal notes for this review"
      />
      {state.message ? (
        <p className={state.status === "error" ? "text-body-sm text-[var(--haven-blush-ink)]" : "text-body-sm text-[var(--haven-sage-strong)]"}>
          {state.message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <SubmitButton intent="approve">
          {publishedPostId ? "Republish update" : "Approve and publish"}
        </SubmitButton>
        {publishedPostId ? (
          <SubmitButton intent="unpublish" variant="outline">
            Unpublish
          </SubmitButton>
        ) : (
          <SubmitButton intent="reject" variant="destructive">
            Reject
          </SubmitButton>
        )}
      </div>
    </form>
  );
}
