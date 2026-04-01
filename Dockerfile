# Monorepo root: pick app with build arg SERVICE (set in Railway Variables per service).
# ai-agent → AnalX / Kimi backend
# helius-proxy → Helius RPC proxy
ARG SERVICE=ai-agent

FROM node:18-alpine
WORKDIR /app

COPY ${SERVICE}/package.json ./
RUN npm install --omit=dev

COPY ${SERVICE}/ .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
