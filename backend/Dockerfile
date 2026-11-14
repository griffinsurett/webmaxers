# Webmaxxers Blueprint Agent backend: production image.
# Build context is this folder (backend/). On Railway set the service's Root Directory to
# "backend"; with docker compose use docker-compose.prod.yml.
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8000

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
# Read at run time: the schema (applied on start) and the knowledge base (loaded on first start).
COPY db/ ./db/
COPY kb/ ./kb/

# Never run as root.
RUN chown -R node:node /app
USER node

EXPOSE 8000

# The service answers 200 on /health only when its database is reachable.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# exec form: node receives SIGTERM directly, which triggers the graceful shutdown.
CMD ["node", "dist/index.js"]
