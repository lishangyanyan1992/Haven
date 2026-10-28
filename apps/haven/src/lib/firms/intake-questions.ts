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

/**
 * Unions intake question lists across multiple connected law firms.
 * Deduplicates shared preset questions by key, and deduplicates custom questions
 * when both key and normalized label match. If two firms define different custom
 * questions whose slug keys collide, assigns a firm-scoped key to keep them distinct.
 *
 * @param firmLists - Array of firm IDs with their respective intake question lists
 * @returns Deduplicated and collision-disambiguated list of intake questions
 */
export function unionIntakeQuestions(
  firmLists: Array<{ firmId: string; questions: IntakeQuestionItem[] }>
): IntakeQuestionItem[] {
  const seenIdentities = new Set<string>();
  const unioned: IntakeQuestionItem[] = [];

  for (const { firmId, questions } of firmLists) {
    for (const q of questions) {
      const qIdentity = q.isCustom ? `${q.key}:${q.label.toLowerCase().trim()}` : q.key;
      if (!seenIdentities.has(qIdentity)) {
        seenIdentities.add(qIdentity);
        let finalItem = q;
        if (q.isCustom && unioned.some((existing) => existing.key === q.key && existing.label !== q.label)) {
          finalItem = { ...q, key: `${q.key}_${firmId.slice(0, 8)}` };
        }
        unioned.push(finalItem);
      }
    }
  }

  return unioned;
}
