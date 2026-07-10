# MedQueue LK

Real-time patient queue and appointment platform for private dispensaries and channeling
doctors in Sri Lanka. Patients get a token, watch their live queue position, and arrive
just in time; doctors run their session from a live console; admins verify SLMC
registrations and approve payments.

## Architecture

```mermaid
flowchart LR
  subgraph Clients
    P[Patient PWA<br/>mobile-first]
    D[Doctor console<br/>tablet]
    A[Admin dashboard<br/>desktop]
  end

  P & D & A -->|HTTPS| WEB[Next.js 15 - apps/web]
  WEB -->|REST| API[NestJS - apps/api]
  P & D -->|WebSocket /queue| API
  API --> PG[(PostgreSQL 16<br/>durable record)]
  API --> RD[(Redis<br/>live queue, OTP,<br/>rate limits, pub/sub)]
  API --> S3[(MinIO / S3<br/>slips and photos)]
  API --> SMS[SMS providers<br/>Notify.lk / Ideabiz]
  API --> PH[PayHere gateway]
```

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js 15 (App Router, RSC), Tailwind v4, next-intl (si/ta/en) |
| `apps/api` | NestJS modular monolith + Socket.IO gateway |
| `packages/ui` | Bespoke design system (tokens, components, Storybook) |
| `packages/shared` | Zod schemas, LK districts, phone/currency helpers shared FE/BE |
| `docs/adr` | Architecture decision records |
| `deploy` | Deployment guides (VPS + Caddy, Vercel + Railway/Fly) |

## Local development

```bash
corepack enable                # pnpm
cp .env.example .env
docker compose up -d           # postgres, redis, minio, mailhog
pnpm install
pnpm --filter api prisma:migrate
pnpm --filter api seed
pnpm dev                       # web on :3000, api on :4000
```

## Quality gates

`pnpm lint && pnpm typecheck && pnpm test && pnpm build` — CI blocks merges on any
failure, then builds and Trivy-scans both Docker images.
