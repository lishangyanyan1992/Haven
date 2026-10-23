/** Rows of the firm tables (migration 0033_firms.sql). */

export type RequiredDocumentItem = {
  key: string;
  label: string;
  isCustom?: boolean;
};

export type IntakeQuestionItem = {
  key: string;
  label: string;
  isCustom?: boolean;
};

export type FirmRow = {
  id: string;
  name: string;
  is_demo: boolean;
  required_documents: RequiredDocumentItem[] | null;
  intake_questions: IntakeQuestionItem[] | null;
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

export type FirmPipelineStatus =
  | "new_lead"
  | "contacted"
  | "consultation_scheduled"
  | "consultation_completed"
  | "contract_sent"
  | "contract_signed"
  | "archived";

export const FIRM_PIPELINE_STATUS_LABEL: Record<FirmPipelineStatus, string> = {
  new_lead: "New lead",
  contacted: "Contacted",
  consultation_scheduled: "Consultation scheduled",
  consultation_completed: "Consultation completed",
  contract_sent: "Contract sent",
  contract_signed: "Contract signed",
  archived: "Archived"
};

export type FirmClientRow = {
  id: string;
  firm_id: string;
  normalized_email: string;
  phone?: string | null;
  full_name?: string | null;
  pipeline_status?: FirmPipelineStatus;
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
