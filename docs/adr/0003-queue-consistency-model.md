# ADR 0003: Queue consistency — Postgres for issuance, Redis for live state

Date: 2026-07-10 · Status: Accepted

## Context

Two very different consistency needs coexist:

1. **Token issuance** must be strictly serial — two patients must never receive the
   same token, and numbers should be gapless. Money and fairness ride on this.
2. **Live position/ETA reads** happen hundreds of times per second across watchers and
   must be cheap; they tolerate sub-second staleness.

## Decision

- **Issuance in Postgres**: booking runs in a transaction that takes
  `SELECT … FOR UPDATE` on the session row, computes `max(tokenNumber) + 1`, and
  inserts. Concurrent bookings serialize on the row lock; the
  `@@unique([sessionId, tokenNumber])` constraint is the backstop if any path forgets
  the lock. Booking invariants (1 active appointment per session, ≤3 platform-wide,
  session capacity) are checked inside the same transaction. Verified by an
  integration test firing 20 parallel bookings.
- **Live state in Redis**: a sorted set of waiting tokens (score = token number), a
  meta hash (current token, served count, rolling consult-duration totals), and an
  owner hash (token → patientId) for targeted pushes. Doctor actions mutate Postgres
  (durable) then Redis (live), then broadcast.
- **ETA** = position × rolling average of *actual* consult durations this session
  (recorded when the doctor taps Next), falling back to the schedule's
  `avgConsultMinutes` until the first consult completes.
- **Reconciliation at session end**: remaining BOOKED appointments are cancelled in
  Postgres, final statuses persisted, then Redis keys are deleted. Postgres is always
  the durable record; Redis can be rebuilt from it (session start re-seeds the sorted
  set from BOOKED appointments).
- **No-show**: appointment marked NO_SHOW (skipped); the patient may rejoin exactly
  once per session, entering at the tail with a fresh token linked via
  `rejoinedFromToken`.

## Consequences

- A Redis flush during a live session loses only live view state — rebuidable by
  re-seeding from Postgres (the doctor restarting the session does exactly this).
- Row-lock serialization caps booking throughput per session (~hundreds/sec), far
  above a dispensary's realistic booking rate.
- Audit log rows are written for every queue state change inside the same Postgres
  transaction, so the durable history is complete even if a broadcast is missed.
