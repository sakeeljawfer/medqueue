# ADR 0002: Socket.IO on a NestJS gateway with Redis pub/sub

Date: 2026-07-10 · Status: Accepted

## Context

The core promise of the product is "watch your queue position move without refreshing".
Patients are on mid-range Android phones over 4G with flaky connectivity; sessions have
40–80 watchers, and a popular doctor can have hundreds. Positions must push instantly
when the doctor taps "Next" — polling at that scale wastes both battery and bandwidth.

## Decision

- **Socket.IO** (not raw WebSocket): automatic reconnection with backoff, HTTP
  long-polling fallback for hostile mobile networks/proxies, and rooms — all battle
  costs we would otherwise pay ourselves.
- **Single `/queue` namespace**, room per session (`session:{id}`), plus a per-user
  room (`user:{userId}:{sessionId}`) so personal `queue.you` payloads (your token,
  position, ETA) go only to the authenticated owner. Public `queue.state` payloads
  carry token numbers only — never identities.
- **Auth at the middleware layer**: the short-lived access JWT rides in
  `handshake.auth.token`; unauthenticated sockets are rejected before any handler runs.
- **`@socket.io/redis-adapter`** so multiple API replicas share rooms — emit on any
  node, delivered from all nodes. The same Redis instance already holds queue state.
- **Idempotent resync**: every `subscribe` (including after reconnect) replies with the
  full current `queue.state` + `queue.you`, so a dropped connection never leaves a
  stale ticket; there is no incremental diff protocol to corrupt.
- Domain events (`queue.advanced`, `session.started`, …) are emitted via NestJS
  EventEmitter; the gateway is a listener, keeping queue logic transport-agnostic.

## Consequences

- Slightly heavier wire format than raw WS — acceptable at our payload sizes (<300 B).
- The Redis adapter makes Redis availability a realtime dependency; it already is one
  for queue state, so no new failure mode.
- Long-polling fallback means the platform still works behind networks that block WS.
