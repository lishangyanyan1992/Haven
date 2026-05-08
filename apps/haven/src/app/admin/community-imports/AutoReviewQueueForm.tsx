"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { autoReviewPendingCommunityImportsAction, type ReviewCommunityImportActionState } from "@/server/community-import-actions";

const initialState: ReviewCommunityImportActionState = {
  message: "",
  status: "idle"
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} type="submit" variant="accent">
      {pending ? "Reviewing pending posts..." : "Run auto-review agent"}
    </Button>
  );
}

export function AutoReviewQueueForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(autoReviewPendingCommunityImportsAction, initialState);

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form action={formAction} className="mt-6 space-y-3">
      {state.message ? (
        <p className={state.status === "error" ? "text-body-sm text-[var(--haven-blush-ink)]" : "text-body-sm text-[var(--haven-sage-strong)]"}>
          {state.message}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
