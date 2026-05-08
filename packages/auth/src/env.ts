import { z } from "zod";

const authEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  AUTH_COOKIE_DOMAIN: z.string().optional()
});

export const authEnv = authEnvSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN
});

export const hasSupabaseEnv = Boolean(
  authEnv.NEXT_PUBLIC_SUPABASE_URL && authEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
