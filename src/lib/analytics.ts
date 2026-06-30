import posthog from 'posthog-js';

const POSTHOG_KEY = 'phc_w5zmhy3AfGc7y5ETUYpFAKQoZKniSBfjUYDGDkEaxHh7';
const POSTHOG_HOST = 'https://us.i.posthog.com';

let initialized = false;

export function initAnalytics() {
  if (initialized || typeof window === 'undefined') return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    person_profiles: 'identified_only',
    autocapture: false,
  });
  initialized = true;
}

export function identifyUser(userId: string) {
  if (!initialized) return;
  // Do NOT pass email or any PII as properties.
  posthog.identify(userId);
}

export function resetAnalytics() {
  if (!initialized) return;
  posthog.reset();
}

export type AnalyticsEvent =
  | 'sign_up'
  | 'sign_in'
  | 'expense_added'
  | 'budget_created'
  | 'subscription_added'
  | 'renewal_prompt_shown'
  | 'renewal_logged'
  | 'renewal_skipped'
  | 'strategy_viewed'
  | 'paywall_viewed'
  | 'account_deleted';

export function track(event: AnalyticsEvent, properties?: Record<string, string | number | boolean | null>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}