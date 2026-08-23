# syntax=docker/dockerfile:1.7

# Frontend Dockerfile
# Supports two targets:
#   --target dev   — install deps only, run `pnpm dev` at container start
#   --target prod  — full build baked in, run `pnpm start` at container start (default if no --target is specified)

ARG PNPM_STORE_PATH=/root/.local/share/pnpm/store
ARG NPM_REGISTRY

# ── Base: shared setup ────────────────────────────────────────────────────────
FROM node:22-alpine AS base
ARG PNPM_STORE_PATH
ARG NPM_REGISTRY
# Configure corepack registry before installing pnpm so the download itself
# succeeds in restricted networks (COREPACK_NPM_REGISTRY controls where
# corepack fetches package managers from).
RUN if [ -n "${NPM_REGISTRY}" ]; then \
      export COREPACK_NPM_REGISTRY="${NPM_REGISTRY}"; \
    fi && \
    corepack enable && corepack install -g pnpm@10.26.2
RUN pnpm config set store-dir ${PNPM_STORE_PATH}
# Optionally override npm registry for restricted networks (e.g. NPM_REGISTRY=https://registry.npmmirror.com)
RUN if [ -n "${NPM_REGISTRY}" ]; then pnpm config set registry "${NPM_REGISTRY}"; fi
WORKDIR /app

# Keep dependency installation independent from application source changes.
# The cache mount persists downloaded packages across clean BuildKit builds;
# node_modules itself remains in this image layer for downstream stages.
FROM base AS dependencies
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/
RUN --mount=type=cache,id=deer-flow-frontend-pnpm,target=${PNPM_STORE_PATH} \
    cd /app/frontend && pnpm install --frozen-lockfile

# ── Dev: install only, CMD is overridden by docker-compose ───────────────────
FROM dependencies AS dev
COPY frontend ./frontend
EXPOSE 3000

# ── Builder: install + compile Next.js ───────────────────────────────────────
FROM dependencies AS builder
COPY frontend ./frontend
# Skip env validation — runtime vars are injected by nginx/container
# App version stamp for the About page. Nightly CI passes
# APP_VERSION=<base>-nightly.<date>-<sha>; release/local builds leave it empty
# and the frontend falls back to package.json's version.
ARG APP_VERSION=""
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION
RUN cd /app/frontend && SKIP_ENV_VALIDATION=1 pnpm build

# ── Prod: minimal runtime with pre-built output ───────────────────────────────
FROM node:22-alpine AS prod
ARG PNPM_STORE_PATH
ARG NPM_REGISTRY
RUN if [ -n "${NPM_REGISTRY}" ]; then \
      export COREPACK_NPM_REGISTRY="${NPM_REGISTRY}"; \
    fi && \
    corepack enable && corepack install -g pnpm@10.26.2
RUN pnpm config set store-dir ${PNPM_STORE_PATH}
RUN if [ -n "${NPM_REGISTRY}" ]; then pnpm config set registry "${NPM_REGISTRY}"; fi
WORKDIR /app
COPY --from=builder /app/frontend ./frontend
EXPOSE 3000
CMD ["sh", "-c", "cd /app/frontend && pnpm start"]
