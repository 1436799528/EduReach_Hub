FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN npm run build

# Runtime dependencies only. The server bundle is built with --packages=external,
# so it needs express, dotenv and @supabase/supabase-js at run time and nothing
# else. Copying the build-stage node_modules into the image shipped Playwright,
# esbuild, TypeScript and the rest of the toolchain to production (audit P2-5):
# a larger image and a much larger attack surface for no benefit.
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/build ./build
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "build/server.cjs"]
