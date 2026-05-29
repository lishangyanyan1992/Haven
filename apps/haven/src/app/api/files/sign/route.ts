import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  HAVEN_VAULT_BUCKET,
  MAX_DOCUMENT_BYTES,
  inferDocumentMetadata,
  isAllowedMimeType,
  sanitizeFilename
} from "@/lib/document-vault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AuthenticatedUser = NonNullable<Awaited<ReturnType<typeof requireUser>>>;

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return user;
}

async function ensureUserProfile(user: AuthenticatedUser) {
  const admin = createSupabaseAdminClient();
  const { data: existingProfile, error: profileLookupError } = await admin
    .from("user_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileLookupError) {
    console.error("[files/sign] profile lookup error:", profileLookupError.message);
    throw new Error("Failed to verify your Haven profile.");
  }

  if (existingProfile) {
    return admin;
  }

  const fallbackName = typeof user.email === "string" && user.email.includes("@") ? user.email.split("@")[0] : "New Haven user";
  const fullName =
    typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim().length > 0
      ? user.user_metadata.full_name.trim()
      : fallbackName;

  const { error: profileInsertError } = await admin.from("user_profiles").upsert({
    id: user.id,
    full_name: fullName,
    email: user.email ?? "",
    visa_type: "H1B",
    country_of_birth: "",
    perm_stage: "not_started",
    preference_category: "Not sure",
    i485_filed: false,
    i140_approved: false,
    employment_status: "employed",
    spouse_visa_status: "none",
    primary_goal: "not_sure",
    top_concerns: ["layoffs"]
  });

  if (profileInsertError) {
    console.error("[files/sign] profile bootstrap error:", profileInsertError.message);
    throw new Error("Failed to initialize your Haven profile.");
  }

  const { error: derivedSignalsError } = await admin.from("derived_signals").upsert({
    user_id: user.id,
    layoff_readiness_score: "low",
    layoff_readiness_reasoning: ["Complete onboarding to calculate personalized readiness."]
  });

  if (derivedSignalsError) {
    console.error("[files/sign] derived signals bootstrap error:", derivedSignalsError.message);
  }

  return admin;
}

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get("documentId");
  if (!documentId) {
    return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: document, error: documentError } = await admin
    .from("user_documents")
    .select("id, original_name, storage_path")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (documentError) {
    console.error("[files/sign] document lookup error:", documentError.message);
    return NextResponse.json({ error: "Failed to retrieve document." }, { status: 500 });
  }

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { data, error } = await admin.storage
    .from(HAVEN_VAULT_BUCKET)
    .createSignedUrl(document.storage_path, 60 * 5, { download: document.original_name });

  if (error || !data?.signedUrl) {
    console.error("[files/sign] signed URL error:", error?.message);
    return NextResponse.json({ error: "Unable to create download URL." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const customLabel = String(formData.get("label") ?? "").trim();
    const notes = String(formData.get("notes") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file upload." }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Empty files cannot be uploaded." }, { status: 400 });
    }

    if (file.size > MAX_DOCUMENT_BYTES) {
      return NextResponse.json(
        { error: "Files must be 15 MB or smaller for Haven V1." },
        { status: 400 }
      );
    }

    const contentType = file.type || "application/octet-stream";
    if (!isAllowedMimeType(contentType)) {
      return NextResponse.json(
        { error: "File type not supported. Please upload a PDF, Word document, or image." },
        { status: 415 }
      );
    }

    const inferred = inferDocumentMetadata(file.name, file.type, customLabel);
    const extensionSafeName = sanitizeFilename(file.name || "document");
    const storagePath = `${user.id}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}-${extensionSafeName}`;
    const admin = await ensureUserProfile(user);
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await admin.storage.from(HAVEN_VAULT_BUCKET).upload(storagePath, fileBuffer, {
      contentType,
      upsert: false
    });

    if (uploadError) {
      console.error("[files/sign] upload error:", uploadError.message);
      return NextResponse.json({ error: "File upload failed." }, { status: 500 });
    }

    const metadata = {
      extension: file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() : null
    };

    const { data: document, error: insertError } = await admin
      .from("user_documents")
      .insert({
        user_id: user.id,
        storage_path: storagePath,
        original_name: file.name,
        display_label: inferred.displayLabel,
        document_kind: inferred.documentKind,
        source_kind: "manual_upload",
        file_size_bytes: file.size,
        mime_type: contentType,
        crisis_critical: inferred.crisisCritical,
        notes: notes || null,
        metadata
      })
      .select("id, display_label, document_kind, crisis_critical")
      .single();

    if (insertError) {
      console.error("[files/sign] document record insert error:", insertError.message);
      await admin.storage.from(HAVEN_VAULT_BUCKET).remove([storagePath]);
      return NextResponse.json({ error: "Failed to save document record." }, { status: 500 });
    }

    revalidatePath("/inbox");
    revalidatePath("/dashboard");
    revalidatePath("/planner");

    return NextResponse.json({
      id: document.id,
      displayLabel: document.display_label,
      documentKind: document.document_kind,
      crisisCritical: document.crisis_critical
    });
  } catch (error) {
    console.error("[files/sign] unexpected error:", error);
    return NextResponse.json({ error: "Unable to upload document." }, { status: 500 });
  }
}
