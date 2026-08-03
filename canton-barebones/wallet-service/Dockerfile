# Built from the repository root so the pnpm workspace lockfile is in context.
# See canton-barebones/docker-compose.yaml for the build.context / dockerfile wiring.

FROM node:24-alpine AS build
WORKDIR /app
ENV HUSKY=0
RUN corepack enable
# Copy the root lockfile + workspace config plus every workspace manifest first,
# so the install layer caches independently of source changes. pnpm needs all
# manifests present to reconstruct the workspace tree from the root lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY canton-connect/package.json canton-connect/
COPY canton-barebones/package.json canton-barebones/
COPY canton-barebones/wallet-service/package.json canton-barebones/wallet-service/
COPY dapp/daml/package.json dapp/daml/
COPY dapp/frontend/package.json dapp/frontend/
# --ignore-scripts skips the root husky prepare hook (no .git in the image) and
# unrelated workspace postinstalls; the wallet-service build needs none of them.
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY canton-barebones/wallet-service/tsconfig.json canton-barebones/wallet-service/
COPY canton-barebones/wallet-service/src canton-barebones/wallet-service/src
RUN pnpm --filter @canton-dappbooster/wallet-service run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV HUSKY=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY canton-connect/package.json canton-connect/
COPY canton-barebones/package.json canton-barebones/
COPY canton-barebones/wallet-service/package.json canton-barebones/wallet-service/
COPY dapp/daml/package.json dapp/daml/
COPY dapp/frontend/package.json dapp/frontend/
RUN pnpm install --frozen-lockfile --prod --ignore-scripts
COPY --from=build /app/canton-barebones/wallet-service/dist canton-barebones/wallet-service/dist
WORKDIR /app/canton-barebones/wallet-service
EXPOSE 3010
CMD ["node", "dist/server.js"]
