FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
# --chown so the unprivileged `node` runtime user owns (and can read) the app
# even when a source file carries restrictive host perms.
COPY --chown=node:node --from=build /app/dist ./dist
COPY --chown=node:node server.js ./server.js
COPY --chown=node:node server ./server
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Pre-create the data dirs owned by the built-in unprivileged `node` user; the
# entrypoint drops root to that user at boot (defence in depth — the server
# never runs as root).
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /data /backups /logs \
  && chown -R node:node /data /backups /logs
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
