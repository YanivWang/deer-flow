FROM node:22.22.3-alpine AS deps
WORKDIR /app
COPY frontend-vue/package.json frontend-vue/pnpm-lock.yaml* frontend-vue/pnpm-workspace.yaml ./
RUN corepack enable && corepack pnpm install --frozen-lockfile

FROM deps AS build
ARG NUXT_GATEWAY_URL=http://gateway:8001
ENV NUXT_GATEWAY_URL=${NUXT_GATEWAY_URL}
COPY frontend-vue/.nuxtrc frontend-vue/nuxt.config.ts frontend-vue/tsconfig.json ./
COPY frontend-vue/app ./app
COPY frontend-vue/config ./config
COPY frontend-vue/server ./server
RUN corepack pnpm build

FROM node:22.22.3-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
COPY --from=build /app/.output ./.output
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -qO- "http://127.0.0.1:${NITRO_PORT}/login" >/dev/null || exit 1
CMD ["node", ".output/server/index.mjs"]
