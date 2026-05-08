export function isSafeRedirectPath(path?: string | null) {
  if (!path) return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  return true;
}

export function normalizeRedirectPath(path?: string | null, fallback = "/dashboard") {
  return isSafeRedirectPath(path) ? path : fallback;
}

export function shouldHonorRedirect(
  redirectTo?: string | null,
  options?: {
    disallowPrefixes?: string[];
  }
) {
  if (!isSafeRedirectPath(redirectTo)) return false;

  const disallowPrefixes = options?.disallowPrefixes ?? [];
  return !disallowPrefixes.some((prefix) => redirectTo!.startsWith(prefix));
}

export function resolvePostSignInRedirect(params: {
  redirectTo?: string | null;
  preferredPath: string;
  fallbackPath?: string;
  disallowRedirectPrefixes?: string[];
}) {
  const {
    redirectTo,
    preferredPath,
    fallbackPath = "/dashboard",
    disallowRedirectPrefixes = []
  } = params;

  if (
    preferredPath === fallbackPath &&
    shouldHonorRedirect(redirectTo, { disallowPrefixes: disallowRedirectPrefixes })
  ) {
    return redirectTo!;
  }

  return preferredPath;
}
