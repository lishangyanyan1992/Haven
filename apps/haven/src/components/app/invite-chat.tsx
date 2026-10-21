"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RegisterForm } from "@/app/register/RegisterForm";
import { checkInviteAction, submitWaitlistAction } from "@/server/actions";
import { cn } from "@/lib/utils";

/**
 * Haven is invitation only. Every "get started" button lands here.
 *
 * A short scripted chat (no AI) sorts people into three paths:
 * - lawyers request access for their firm
 * - clients whose lawyer invited them check their email and sign up
 * - everyone else is told to ask their lawyer, and can leave an email
 */

type Path = "lawyer" | "client" | "individual";

type Message = { from: "haven" | "you"; body: ReactNode };

const OPENING: Message = {
  from: "haven",
  body: (
    <>
      Hi, I&apos;m Haven. Haven is <strong>invitation only</strong>{" "}right now. It&apos;s built for immigration law
      firms, who invite their clients to upload documents and get their questions answered.
      <br />
      <br />
      Which of these is you?
    </>
  )
};

const CHOICES: { path: Path; label: string }[] = [
  { path: "lawyer", label: "I'm an immigration lawyer" },
  { path: "client", label: "My lawyer invited me" },
  { path: "individual", label: "I'm looking for help myself" }
];

export function InviteChat({ notInvited = false }: { notInvited?: boolean }) {
  const [messages, setMessages] = useState<Message[]>(() =>
    notInvited
      ? [
          {
            from: "haven",
            body: (
              <>
                Haven is now <strong>invitation only</strong>, and your account doesn&apos;t have an invite yet. If
                your immigration lawyer uses Haven, ask them to invite the email you signed up with.
              </>
            )
          },
          OPENING
        ]
      : [OPENING]
  );
  const [path, setPath] = useState<Path | null>(null);
  const [step, setStep] = useState<"choose" | "form" | "signup" | "done">("choose");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [firm, setFirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, step]);

  function say(next: Message[]) {
    setMessages((current) => [...current, ...next]);
  }

  function choose(nextPath: Path, label: string) {
    setPath(nextPath);
    setStep("form");
    setError(null);
    const reply: Record<Path, ReactNode> = {
      lawyer: (
        <>
          Great. Haven gives your clients one place to upload their documents and ask questions between
          appointments, and you see what they shared. Leave your details and we&apos;ll set up your firm.
        </>
      ),
      client: <>Welcome. What email did your lawyer invite?</>,
      individual: (
        <>
          Haven now works through immigration lawyers, so you&apos;ll need an invite from yours. If your lawyer
          doesn&apos;t use Haven yet, leave your email and we&apos;ll let you know if that changes. Our{" "}
          <Link className="underline underline-offset-2" href="/resources">
            free guides
          </Link>{" "}
          stay open to everyone.
        </>
      )
    };
    say([
      { from: "you", body: label },
      { from: "haven", body: reply[nextPath] }
    ]);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!path || isPending) return;
    setError(null);

    startTransition(async () => {
      if (path === "client") {
        const result = await checkInviteAction({ email });
        if (result.status === "invalid") {
          setError("That doesn't look like an email address.");
          return;
        }
        say([{ from: "you", body: email }]);
        if (result.status === "invited") {
          say([{ from: "haven", body: <>You&apos;re on the list. Create your account below.</> }]);
          setStep("signup");
        } else {
          say([
            {
              from: "haven",
              body: (
                <>
                  I couldn&apos;t find an invite for that email. Check with your lawyer which email they used, or ask
                  them to send one.
                </>
              )
            }
          ]);
        }
        return;
      }

      const result = await submitWaitlistAction({
        fullName: name,
        email,
        interestKey: path === "lawyer" ? "lawyer_access" : "individual_access",
        interestLabel: path === "lawyer" ? "Haven for law firms" : "Haven without a lawyer",
        sourcePath: "/register",
        metadata: path === "lawyer" ? { firm, role: "lawyer" } : { role: "individual" }
      });

      if (result.status !== "success") {
        setError(result.message);
        return;
      }

      say([
        { from: "you", body: path === "lawyer" ? `${name}, ${firm}, ${email}` : `${name}, ${email}` },
        {
          from: "haven",
          body:
            path === "lawyer" ? (
              <>Thanks, {name.split(" ")[0]}. We&apos;ll email you at {email} to set up your firm.</>
            ) : (
              <>Thanks. We&apos;ll email you at {email} if Haven opens up.</>
            )
        }
      ]);
      setStep("done");
    });
  }

  return (
    <div className="rounded-[var(--radius-2xl)] border border-[var(--color-border)] bg-[var(--haven-white)] shadow-[0_12px_48px_-16px_rgba(44,54,48,0.18)]">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-5 py-3">
        <span className="h-2 w-2 rounded-full bg-[var(--haven-sage)]" />
        <p className="text-body-sm font-medium text-[var(--haven-ink)]">Haven · invitation only</p>
      </div>

      <div aria-live="polite" className="max-h-[60vh] space-y-3 overflow-y-auto px-4 py-5 sm:px-5">
        {messages.map((message, index) => (
          <div className={cn("flex", message.from === "you" ? "justify-end" : "justify-start")} key={index}>
            <div
              className={cn(
                "max-w-[85%] rounded-[var(--radius-xl)] px-4 py-3 text-[15px] leading-relaxed",
                message.from === "you"
                  ? "bg-[var(--haven-ink)] text-[var(--haven-cream)]"
                  : "bg-[var(--haven-cream)] text-[var(--haven-ink)]"
              )}
            >
              {message.body}
            </div>
          </div>
        ))}

        {step === "choose" ? (
          <div className="flex flex-col items-end gap-2 pt-1">
            {CHOICES.map((choice) => (
              <button
                className="rounded-full border border-[var(--haven-ink)] px-4 py-2 text-body-sm font-medium text-[var(--haven-ink)] transition-colors hover:bg-[var(--haven-ink)] hover:text-[var(--haven-cream)]"
                key={choice.path}
                onClick={() => choose(choice.path, choice.label)}
                type="button"
              >
                {choice.label}
              </button>
            ))}
          </div>
        ) : null}

        {step === "signup" ? (
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] p-4">
            <RegisterForm defaultEmail={email} />
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      {step === "form" && path ? (
        <form className="space-y-3 border-t border-[var(--color-border)] px-4 py-4 sm:px-5" onSubmit={submit}>
          {path !== "client" ? (
            <Input
              aria-label="Your name"
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              required
              value={name}
            />
          ) : null}
          {path === "lawyer" ? (
            <Input
              aria-label="Firm name"
              autoComplete="organization"
              onChange={(event) => setFirm(event.target.value)}
              placeholder="Firm name"
              required
              value={firm}
            />
          ) : null}
          <div className="flex gap-2">
            <Input
              aria-label="Email"
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder={path === "lawyer" ? "Work email" : "you@example.com"}
              required
              type="email"
              value={email}
            />
            <Button aria-label="Send" disabled={isPending} type="submit">
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
          {error ? <p className="text-body-sm text-[#7a3030]">{error}</p> : null}
          <button
            className="text-caption text-[var(--haven-ink-mid)] underline underline-offset-2"
            onClick={() => {
              setStep("choose");
              setPath(null);
              setError(null);
            }}
            type="button"
          >
            Start over
          </button>
        </form>
      ) : null}
    </div>
  );
}
