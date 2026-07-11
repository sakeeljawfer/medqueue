# ADR 0004: Dual payment rails — PayHere gateway and admin-approved bank slips

Date: 2026-07-10 · Status: Accepted

## Context

Doctors pay subscription/listing fees. In Sri Lanka many practitioners (especially
semi-urban) still pay by bank deposit and photograph the slip; card penetration is
uneven. PayHere is the dominant local gateway with LKR settlement and a sandbox.
Both rails must exist from day one, converging on the same `Payment` record.

## Decision

- **One `Payment` model, two methods** (`PAYHERE` | `BANK_SLIP`), one lifecycle
  (`PENDING → APPROVED | REJECTED`). Downstream logic (activating a listing) keys off
  `payment.approved` domain events, indifferent to the rail.
- **PayHere**: server builds the checkout payload including the documented
  MD5 hash (`merchant_id + order_id + amount + currency + md5(secret)`); the webhook's
  `md5sig` is verified server-side before any state change. Webhook processing is
  idempotent — replays of a settled payment are acknowledged without effect. Checkout
  creation accepts an `Idempotency-Key` header so client retries don't mint duplicate
  pending payments.
- **Bank slip**: doctor uploads a photo (magic-byte validated, ≤5 MB, private bucket).
  Admin reviews the slip image via a signed URL and approves/rejects; the decision and
  reviewer are recorded on the payment row *and* in the append-only audit log within
  the same transaction.
- Amounts are fixed server-side (`PRICES` table) — the client never supplies an amount.

## Consequences

- MD5 is weak in general but is PayHere's contract; the merchant secret never leaves
  the server, and the webhook check compares full signatures, so tampering with amount
  or status invalidates the request. Tested against tampered-amount replays.
- Manual review adds admin workload — accepted; it mirrors how LK businesses already
  operate and is the reason the product has an admin payment queue at all.
- A webhook lost in transit leaves a payment PENDING; PayHere retries, and the admin
  dashboard surfaces stale pending PayHere payments for manual reconciliation.
