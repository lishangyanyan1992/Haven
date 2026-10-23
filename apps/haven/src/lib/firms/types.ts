/** Rows of the firm tables (migration 0033_firms.sql). */

export type RequiredDocumentItem = {
  key: string;
  label: string;
  isCustom?: boolean;
};

export type FirmRow = {
  id: string;
  name: string;
  is_demo: boolean;
  required_documents: RequiredDocumentItem[] | null;
  created_at: string;
};

export type FirmMemberRow = {
  firm_id: string;
  user_id: string;
  email: string;
  created_at: string;
};

export type FirmIntakeLinkRow = {
  id: string;
  firm_id: string;
  token: string;
  is_active: boolean;
  revoked_at: string | null;
  created_at: string;
};

export type FirmClientRow = {
  id: string;
  firm_id: string;
  normalized_email: string;
  user_id: string | null;
  link_id: string | null;
  email_sent_at: string;
  consented_at: string;
  joined_at: string | null;
  completed_at: string | null;
  reviewed_at: string | null;
  claim_token_hash: string | null;
  previous_claim_token_hash: string | null;
  shared_answers: Record<string, string | string[]>;
  created_at: string;
};

export type FirmClientStatus = "email_sent" | "signed_up" | "in_progress" | "finished";

export type FirmPilotRequestRow = {
  id: string;
  full_name: string;
  firm_name: string;
  email: string;
  normalized_email: string;
  note: string | null;
  source_path: string;
  created_at: string;
  updated_at: string;
};
