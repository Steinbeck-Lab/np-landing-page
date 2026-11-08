# syntax=docker/dockerfile:1

# ---- Dependencies: production-only node_modules (sharp ships musl prebuilds) ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev

# ---- Runtime ----
FROM node:24-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=80 \
    DATA_DIR=/data
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY views ./views
COPY public ./public
# Admin and backup helpers: docker compose exec app node scripts/admin.js <user>
COPY scripts/admin.js scripts/backup.js ./scripts/

# SQLite database + uploaded logos live here; mount a volume.
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "src/server.js"]
