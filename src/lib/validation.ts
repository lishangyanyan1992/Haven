import { z } from "zod";

export const onboardingStepOneSchema = z.object({
  visaType: z.enum(["OPT", "STEM OPT", "H1B", "H4", "O-1", "GC", "Citizen"]),
  countryOfBirth: z.string().min(2),
  primaryGoal: z.enum(["get_gc", "job_stability", "explore_options", "stay_flexible", "not_sure"])
});

export const onboardingStepTwoSchema = z.object({
  employerName: z.string().default(""),
  jobTitle: z.string().default(""),
  h1bStartDate: z.string().optional(),
  employerSize: z.enum(["startup", "mid-size", "enterprise"])
});

export const onboardingStepThreeSchema = z.object({
  greenCardStage: z.enum(["not_started", "perm_in_progress", "perm_certified", "i140_filed", "i140_approved", "i485_filed"]),
  priorityDate: z.string().optional(),
  preferenceCategory: z.enum(["EB-1", "EB-2", "EB-3", "EB-2 NIW", "Not sure"]),
  i140Approved: z.boolean()
});

export const onboardingStepFourSchema = z.object({
  spouseVisaStatus: z.enum(["none", "H1B", "H4", "H4 EAD", "GC", "other"]),
  topConcerns: z.array(z.enum(["layoffs", "visa_expiry", "gc_timeline", "job_change", "other"])).min(1)
});

export const emailIngestConfirmationSchema = z.object({
  recordId: z.string().min(1),
  acceptedFieldLabels: z.array(z.string())
});

export type OnboardingStepOneInput = z.infer<typeof onboardingStepOneSchema>;
export type OnboardingStepTwoInput = z.infer<typeof onboardingStepTwoSchema>;
export type OnboardingStepThreeInput = z.infer<typeof onboardingStepThreeSchema>;
export type OnboardingStepFourInput = z.infer<typeof onboardingStepFourSchema>;
