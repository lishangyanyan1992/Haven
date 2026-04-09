import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default("Haven"),
  NEXT_PUBLIC_MIXPANEL_TOKEN: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_CHAT_MODEL: z.string().optional(),
  OPENAI_EMBEDDING_MODEL: z.string().optional(),
  ADVISOR_SOURCE_SYNC_SECRET: z.string().optional(),
  VISA_BULLETIN_SYNC_SECRET: z.string().optional(),
  MAILGUN_WEBHOOK_SIGNING_KEY: z.string().optional(),
  EMAIL_INGEST_DOMAIN: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  INDEXNOW_KEY: z.string().optional(),
  INDEXNOW_SECRET: z.string().optional()
});

export const env = envSchema.parse({
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_MIXPANEL_TOKEN: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_CHAT_MODEL: process.env.OPENAI_CHAT_MODEL,
  OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL,
  ADVISOR_SOURCE_SYNC_SECRET: process.env.ADVISOR_SOURCE_SYNC_SECRET,
  VISA_BULLETIN_SYNC_SECRET: process.env.VISA_BULLETIN_SYNC_SECRET,
  MAILGUN_WEBHOOK_SIGNING_KEY: process.env.MAILGUN_WEBHOOK_SIGNING_KEY,
  EMAIL_INGEST_DOMAIN: process.env.EMAIL_INGEST_DOMAIN,
  SENTRY_DSN: process.env.SENTRY_DSN,
  INDEXNOW_KEY: process.env.INDEXNOW_KEY,
  INDEXNOW_SECRET: process.env.INDEXNOW_SECRET
});

export const hasSupabaseEnv = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
