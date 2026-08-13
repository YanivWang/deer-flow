# syntax=docker/dockerfile:1.7

FROM node:22.22.3-bookworm-slim AS dependencies
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@10.26.2 --activate
COPY frontend/package.json frontend/pnpm-lock.yaml ./frontend/
RUN cd frontend && pnpm install --frozen-lockfile
COPY frontend-vue/package.json frontend-vue/pnpm-lock.yaml frontend-vue/pnpm-workspace.yaml ./frontend-vue/
COPY frontend-vue/packages/agent-core/package.json ./frontend-vue/packages/agent-core/package.json
RUN cd frontend-vue && pnpm install --frozen-lockfile --strict-peer-dependencies

FROM dependencies AS build
COPY frontend-vue ./frontend-vue
COPY frontend/public/demo ./frontend/public/demo
COPY frontend/public/images ./frontend/public/images
RUN cd frontend-vue && pnpm exec nuxt build

FROM node:22.22.3-bookworm-slim AS runtime
ENV HOST=0.0.0.0 PORT=3000 NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /workspace/frontend-vue/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", ".output/server/index.mjs"]
