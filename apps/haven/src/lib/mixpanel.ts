"use client";

import mixpanel, { type Config } from "mixpanel-browser";

import {
  BLOCKED_ELEMENT_ATTRIBUTES,
  BLOCKED_PROPERTIES,
  LEGACY_SUPER_PROPERTIES,
  hasRecordLikeId,
  sanitizePath
} from "@/lib/analytics-privacy";

export { sanitizePath };

type LoginMethod = "password";

interface LoginAttempt {
  method: LoginMethod;
  startedAt: number;
}

const LOGIN_ATTEMPT_STORAGE_KEY = "haven-mixpanel-login-attempt";
const SIGN_UP_ATTEMPT_STORAGE_KEY = "haven-mixpanel-signup-attempt";

let initialized = false;

function isBrowser() {
  return typeof window !== "undefined";
}

function getToken() {
  return process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
}

/**
 * No marketing or first-touch data: no UTM tags, referrers or Google click ids,
 * and nothing written to a profile behind the scenes. These options exist in
 * mixpanel-browser 2.81 but are missing from its type definitions.
 */
const NO_MARKETING_CONFIG = {
  track_marketing: false,
  skip_first_touch_marketing: true,
  stop_utm_persistence: true,
  save_referrer: false,
  store_google: false
} as unknown as Partial<Config>;

export function initMixpanel() {
  if (initialized || !isBrowser()) return;

  const token = getToken();
  if (!token) {
    initialized = true;
    return;
  }

  mixpanel.init(token, {
    debug: process.env.NODE_ENV !== "production",
    persistence: "localStorage",
    // Page views are sent by MixpanelProvider with a cleaned path instead.
    track_pageview: false,
    autocapture: {
      pageview: false,
      click: true,
      input: true,
      scroll: true,
      submit: true,
      capture_text_content: false,
      block_attrs: [...BLOCKED_ELEMENT_ATTRIBUTES],
      // Element ids are always sent and can hold record ids, so skip those interactions.
      block_element_callback: (element: Element) => hasRecordLikeId(element)
    },
    ...NO_MARKETING_CONFIG,
    // No screen recordings and no location from the visitor's IP address.
    record_sessions_percent: 0,
    ip: false,
    property_blacklist: [...BLOCKED_PROPERTIES]
  });

  // Earlier versions saved these in the browser and attached them to every event.
  for (const property of LEGACY_SUPER_PROPERTIES) mixpanel.unregister(property);

  initialized = true;
}



export function trackEvent(eventName: string, properties?: Record<string, unknown>) {
  initMixpanel();
  if (!getToken()) return;
  mixpanel.track(eventName, properties);
}

/** Records a page view with the cleaned path, and attaches that path to later events such as clicks. */
export function trackPageView(pathname: string) {
  initMixpanel();
  if (!getToken()) return;
  const pagePath = sanitizePath(pathname);
  mixpanel.register({ page_path: pagePath });
  mixpanel.track("Page View", { page_path: pagePath });
}

export function identifyUser(userId: string) {
  initMixpanel();
  if (!getToken()) return;

  // The id is Haven's internal user id. Nothing else about the person is sent.
  mixpanel.identify(userId);
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
    if (parsed.method === "password" && typeof parsed.startedAt === "number") {
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

export function rememberSignUpAttempt(email: string) {
  if (!isBrowser()) return;

  window.sessionStorage.setItem(
    SIGN_UP_ATTEMPT_STORAGE_KEY,
    JSON.stringify({
      email,
      startedAt: Date.now()
    })
  );
}

export function consumeSignUpAttempt() {
  if (!isBrowser()) return null;

  const raw = window.sessionStorage.getItem(SIGN_UP_ATTEMPT_STORAGE_KEY);
  if (!raw) return null;

  window.sessionStorage.removeItem(SIGN_UP_ATTEMPT_STORAGE_KEY);
  return JSON.parse(raw) as { email: string; startedAt: number };
}
