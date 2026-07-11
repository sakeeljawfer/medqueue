# Deploying MedQueue LK

Two supported targets. Both need PostgreSQL 16, Redis 7, and an S3-compatible
bucket; secrets are validated by zod at boot, so the api crashes loudly on a
missing variable (see `/.env.example` for the full list).

## Option A — single VPS with Docker + Caddy (recommended for LK hosting)

Works on any Ubuntu VPS (2 vCPU / 4 GB is comfortable for ~100 concurrent
sessions).

```bash
# on the VPS
git clone <repo> medqueue && cd medqueue/deploy
cp ../.env.example .env            # fill in secrets; set DOMAIN + POSTGRES_PASSWORD
docker compose -f docker-compose.prod.yml up -d --build

# first boot only: run migrations + demo seed inside the api container
docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy
```

- Caddy answers on 80/443 and auto-provisions TLS for `$DOMAIN`.
- `https://$DOMAIN` → web, `https://$DOMAIN/api` → api, `/socket.io` → api
  (WebSocket upgrade proxied automatically).
- Scale the api with `--scale api=3`; the Socket.IO Redis adapter fans
  broadcasts out across replicas (see ADR 0002).
- Object storage: point `S3_*` vars at any S3-compatible provider; for a
  self-hosted MinIO add the service from the root `docker-compose.yml`.
- Backups: `pg_dump` on a cron + volume snapshots. Redis holds only
  reconstructible live state (see ADR 0003) — losing it mid-session is
  recovered from Postgres.

## Option B — Vercel (web) + Railway or Fly.io (api)

**Web on Vercel**
1. Import the repo; set the root directory to `apps/web`.
2. Build command `pnpm turbo run build --filter=web`, install command
   `pnpm install`.
3. Env: `NEXT_PUBLIC_API_URL=https://api.<your-domain>`.

**API on Railway**
1. New service from the repo; Railway detects `apps/api/Dockerfile` — set the
   Docker build context to the repo root.
2. Attach the Postgres and Redis plugins; map `DATABASE_URL` / `REDIS_URL`.
3. Set the remaining env vars from `/.env.example`
   (`WEB_URL=https://<vercel-domain>` is required for CORS + cookies).
4. Release command: `npx prisma migrate deploy`.

**API on Fly.io (alternative)**
```bash
fly launch --dockerfile apps/api/Dockerfile --no-deploy   # generates fly.toml
fly postgres create && fly postgres attach
fly redis create        # Upstash Redis; set REDIS_URL from its output
fly secrets set JWT_SECRET=... PAYHERE_MERCHANT_SECRET=... # etc.
fly deploy
```

Cross-site cookies: with web and api on different registrable domains the
refresh cookie (`SameSite=Strict`) will not be sent. Serve both from one
apex domain (e.g. `medqueue.lk` + `api.medqueue.lk`) — cookies are scoped to
the parent domain and this works unchanged.

## Post-deploy checklist

- [ ] `GET /healthz` and `GET /readyz` return 200 behind the proxy.
- [ ] PayHere dashboard: set the notify URL to `https://<api>/payments/payhere/webhook`
      and switch `PAYHERE_MODE=live` only after a sandbox end-to-end test.
- [ ] SMS: set `SMS_PROVIDER=NOTIFYLK` or `IDEABIZ` with real credentials
      (`CONSOLE` logs OTPs instead of sending — dev only).
- [ ] Create the first admin: promote a signed-up user
      `UPDATE "User" SET role='ADMIN' WHERE phone='+94…';`
- [ ] Run the load test against staging: `k6 run load/queue-watch.js -e API_URL=… -e SESSION_ID=… -e SOCKET_TOKEN=…`
- [ ] Confirm Sentry DSNs are set for both apps and events arrive.
