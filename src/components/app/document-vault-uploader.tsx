"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VAULT_ESSENTIALS } from "@/lib/document-vault";

export function DocumentVaultUploader() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setIsUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/files/sign", {
        method: "POST",
        body: formData
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Upload failed.");
      }

      setSuccess(`${payload.displayLabel} stored in your Haven vault.`);
      formRef.current?.reset();
      router.refresh();
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {VAULT_ESSENTIALS.map((item) => (
          <span
            key={item.kind}
            className="inline-flex rounded-full bg-[var(--haven-sky-light)] px-3 py-1 text-[12px] font-medium text-[var(--haven-sky-ink)]"
          >
            {item.title}
          </span>
        ))}
      </div>

      <form
        ref={formRef}
        action={handleSubmit}
        className="grid gap-4 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--haven-white)] p-5"
      >
        <div>
          <p className="text-label">Upload a document</p>
          <p className="mt-2 text-body-sm text-[var(--color-text-secondary)]">
            Haven auto-labels common immigration documents so they are easier to find under pressure.
          </p>
        </div>

        <Input accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" name="file" required type="file" />
        <Input name="label" placeholder="Optional custom label, like I-140 approval notice" type="text" />
        <Input name="notes" placeholder="Optional note for your future self or attorney" type="text" />

        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={isUploading} type="submit" variant="default">
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {isUploading ? "Uploading..." : "Store in vault"}
          </Button>
          <p className="text-caption">Private storage. 15 MB max per file.</p>
        </div>

        {success ? (
          <div className="rounded-[var(--radius-lg)] bg-[var(--haven-success-light)] px-4 py-3 text-body-sm text-[var(--haven-success-ink)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              <span>{success}</span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-[var(--radius-lg)] bg-[var(--haven-blush-light)] px-4 py-3 text-body-sm text-[var(--haven-blush-ink)]">
            {error}
          </div>
        ) : null}
      </form>
    </div>
  );
}
