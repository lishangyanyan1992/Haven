"use client";

import mixpanel from "mixpanel-browser";

type LoginMethod = "password" | "google";

interface LoginAttempt {
  method: LoginMethod;
  startedAt: number;
}

const LOGIN_ATTEMPT_STORAGE_KEY = "haven-mixpanel-login-attempt";

let initialized = false;

function isBrowser() {
  return typeof window !== "undefined";
}

function getToken() {
  return process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
}

export function initMixpanel() {
  if (initialized || !isBrowser()) return;

  const token = getToken();
  if (!token) {
    initialized = true;
    return;
  }

  mixpanel.init(token, {
    persistence: "localStorage",
    track_pageview: true
  });

  initialized = true;
}

export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  initMixpanel();
  if (!getToken()) return;
  mixpanel.track(eventName, properties);
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  initMixpanel();
  if (!getToken()) return;

  mixpanel.identify(userId);
  mixpanel.register({ user_id: userId, ...properties });
}

export function resetMixpanel() {
  initMixpanel();
  if (!getToken()) return;
  mixpanel.reset();
}

export function rememberLoginAttempt(method: LoginMethod) {
  if (!isBrowser()) return;

  const attempt: LoginAttempt = {
    method,
    startedAt: Date.now()
  };

  window.sessionStorage.setItem(LOGIN_ATTEMPT_STORAGE_KEY, JSON.stringify(attempt));
}

export function consumeLoginAttempt(): LoginAttempt | null {
  if (!isBrowser()) return null;

  const raw = window.sessionStorage.getItem(LOGIN_ATTEMPT_STORAGE_KEY);
  if (!raw) return null;

  window.sessionStorage.removeItem(LOGIN_ATTEMPT_STORAGE_KEY);

  try {
    const parsed = JSON.parse(raw) as Partial<LoginAttempt>;
    if ((parsed.method === "password" || parsed.method === "google") && typeof parsed.startedAt === "number") {
      return {
        method: parsed.method,
        startedAt: parsed.startedAt
      };
    }
  } catch {
    return null;
  }

  return null;
}

export function clearLoginAttempt() {
  if (!isBrowser()) return;
  window.sessionStorage.removeItem(LOGIN_ATTEMPT_STORAGE_KEY);
}
