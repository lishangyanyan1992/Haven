import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_INTAKE_QUESTION_KEYS,
  findPresetIntakeQuestion,
  getDefaultIntakeQuestions,
  isCustomQuestionKey,
  PRESET_INTAKE_QUESTIONS,
  slugifyCustomQuestionKey,
  validateIntakeQuestionList,
  type IntakeQuestionGroup,
  type PresetIntakeQuestion
} from "@/lib/firms/intake-question-catalog";
import type { IntakeQuestionItem } from "@/lib/firms/types";

export {
  DEFAULT_INTAKE_QUESTION_KEYS,
  findPresetIntakeQuestion,
  getDefaultIntakeQuestions,
  isCustomQuestionKey,
  PRESET_INTAKE_QUESTIONS,
  slugifyCustomQuestionKey,
  validateIntakeQuestionList,
  type IntakeQuestionGroup,
  type PresetIntakeQuestion
};

function admin() {
  return createSupabaseAdminClient() as any;
}

/**
 * Returns the firm's configured intake questions list, or the default
 * intake questions when the lawyer has not customized them yet.
 */
export async function getFirmIntakeQuestions(firmId: string): Promise<IntakeQuestionItem[]> {
  const { data, error } = await admin()
    .from("firms")
    .select("intake_questions")
    .eq("id", firmId)
    .maybeSingle();

  if (error) {
    throw new Error(`Could not load firm intake questions: ${error.message}`);
  }

  const list = data?.intake_questions;
  if (!Array.isArray(list) || list.length === 0) {
    return getDefaultIntakeQuestions();
  }
  return list as IntakeQuestionItem[];
}

/**
 * Validates and saves the firm's intake questions list.
 * Scoped strictly to the provided firmId.
 */
export async function saveFirmIntakeQuestions(
  firmId: string,
  rawItems: unknown
): Promise<IntakeQuestionItem[]> {
  const validation = validateIntakeQuestionList(rawItems);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  const { error } = await admin()
    .from("firms")
    .update({ intake_questions: validation.items })
    .eq("id", firmId);

  if (error) {
    throw new Error(`Could not save firm intake questions: ${error.message}`);
  }

  return validation.items;
}
