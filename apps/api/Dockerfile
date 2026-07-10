# --- build stage ---
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter api... --filter @medqueue/shared...
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @medqueue/shared build \
  && pnpm --filter api prisma:generate \
  && pnpm --filter api build \
  && pnpm --filter api --prod deploy /out

# --- runtime stage ---
FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
COPY --from=build /out /app
COPY --from=build /repo/apps/api/dist /app/dist
EXPOSE 4000
CMD ["dist/main.js"]
