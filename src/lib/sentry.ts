import * as Sentry from '@sentry/react';

const DSN = 'https://62c4debae5e86ad0fa9beaebf9661953@o4511654558498816.ingest.us.sentry.io/4511654584123392';

// App version / release tag. Vite injects nothing by default; fall back to a constant.
export const APP_RELEASE =
  (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'kaivo@dev';

const SENSITIVE_KEYS = [
  'amount', 'amounts', 'note', 'notes', 'email', 'password',
  'card', 'card_name', 'cardName', 'card_number', 'cardNumber',
  'cvv', 'pan', 'token', 'access_token', 'refresh_token',
];

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => scrub(v, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.some((s) => k.toLowerCase().includes(s))) {
        out[k] = '[scrubbed]';
      } else {
        out[k] = scrub(v, depth + 1);
      }
    }
    return out;
  }
  if (typeof value === 'string') {
    // strip email addresses from free-form strings
    return value.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]');
  }
  return value;
}

let initialized = false;

export function initSentry() {
  if (initialized || typeof window === 'undefined') return;
  Sentry.init({
    dsn: DSN,
    release: APP_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      // Drop request body/query/cookies and user PII
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.query_string;
      }
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
        delete (event.user as Record<string, unknown>).username;
      }
      if (event.extra) event.extra = scrub(event.extra) as typeof event.extra;
      if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;
      if (event.tags) event.tags = scrub(event.tags) as typeof event.tags;
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((b) => ({
          ...b,
          data: b.data ? (scrub(b.data) as typeof b.data) : b.data,
          message: typeof b.message === 'string'
            ? (scrub(b.message) as string)
            : b.message,
        }));
      }
      return event;
    },
  });
  Sentry.setTag('release', APP_RELEASE);
  initialized = true;

  // One-off connection test event — remove once verified.
  Sentry.captureMessage('sentry-setup-test');
}

export function setSentryUser(userId: string | null) {
  if (!initialized) return;
  Sentry.setUser(userId ? { id: userId } : null);
}

export function setSentryRoute(path: string) {
  if (!initialized) return;
  Sentry.setTag('route', path);
}

export { Sentry };