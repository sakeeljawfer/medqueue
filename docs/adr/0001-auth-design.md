# ADR 0001: Phone-OTP authentication with rotating refresh-token families

Date: 2026-07-10 · Status: Accepted

## Context

Patients in semi-urban Sri Lanka are phone-first; most have no email and share mid-range
Android devices. Passwords would be forgotten or reused; SMS OTP is the established local
pattern (banks, PayHere, government services all use it). Sessions must survive weeks
between dispensary visits without re-login, yet a stolen token must not grant 30 days of
access.

## Decision

1. **Identity = +94 mobile number** (E.164, normalized server-side). No passwords stored.
2. **OTP**: 6 digits, HMAC-SHA256-hashed in Redis with a 5-minute TTL, max 3 verify
   attempts (counter destroyed with the code), constant-time comparison. Rate limits:
   3 requests/phone/15 min and 10/IP/hour, on top of a global sliding-window limiter.
3. **SMS via provider abstraction** (`SmsProvider`): Notify.lk and Dialog Ideabiz
   adapters selected by `SMS_PROVIDER` env; a console adapter for development.
4. **Access token**: 15-minute JWT carried in an `httpOnly Secure SameSite=Strict`
   cookie (also accepted as a Bearer header for the socket handshake).
5. **Refresh token**: opaque 48-byte random value, SHA-256 hash stored in Postgres with
   a `familyId`. Every refresh rotates the token and links `replacedBy`. Presenting an
   already-rotated or revoked token is treated as theft: **the entire family is revoked**
   and the user must OTP again. Cookie path is scoped to `/auth`.

## Consequences

- No password storage/reset surface; account recovery equals SIM possession, which
  matches how patients already authenticate to local services.
- SMS cost per login is real; the long-lived rotating refresh token keeps OTP sends rare
  (once per device per month in the common case).
- Family revocation means a false-positive reuse (e.g. a retried request after a lost
  response) logs the user out — acceptable, cheap to recover, and safe by default.
- SameSite=Strict blocks CSRF on cookie-auth mutations; the CORS allowlist and Helmet
  CSP cover the rest.
