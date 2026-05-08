import { authEnv } from "./env";

type CookieOptions = {
  domain?: string;
  path?: string;
  sameSite?: boolean | "lax" | "strict" | "none";
  secure?: boolean;
  httpOnly?: boolean;
  maxAge?: number;
};

function normalizeCookieDomain(domain?: string) {
  if (!domain) return undefined;
  return domain.startsWith(".") ? domain : `.${domain}`;
}

export function applySharedCookieOptions(options?: CookieOptions): CookieOptions | undefined {
  if (!options) return options;

  const domain = normalizeCookieDomain(authEnv.AUTH_COOKIE_DOMAIN);

  return {
    ...options,
    domain: domain ?? options.domain,
    path: options.path ?? "/",
    sameSite:
      options.sameSite === false
        ? undefined
        : options.sameSite ?? "lax",
    secure: options.secure ?? process.env.NODE_ENV === "production"
  };
}
