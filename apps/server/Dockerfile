FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile --filter @boson/server...

FROM base AS build
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/server/node_modules ./apps/server/node_modules
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server ./apps/server
RUN pnpm --filter @boson/server build

FROM base AS prod-deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile --filter @boson/server... --prod

FROM node:22-alpine AS runner
WORKDIR /repo
ENV NODE_ENV=production
RUN addgroup -g 1001 -S boson && adduser -u 1001 -S boson -G boson
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/apps/server/node_modules ./apps/server/node_modules
COPY --from=prod-deps /repo/apps/server/package.json ./apps/server/package.json
COPY --from=build /repo/apps/server/dist ./apps/server/dist
USER boson
WORKDIR /repo/apps/server
EXPOSE 3001
CMD ["node", "dist/index.js"]
