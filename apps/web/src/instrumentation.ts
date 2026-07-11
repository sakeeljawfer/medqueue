import * as Sentry from '@sentry/nextjs';

/** Next.js server instrumentation hook — no-op unless a DSN is configured. */
export async function register(): Promise<void> {
  if (!process.env.SENTRY_DSN_WEB) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN_WEB,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

export const onRequestError = Sentry.captureRequestError;
