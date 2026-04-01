FROM node:18-alpine
WORKDIR /app

COPY api/package.json ./
RUN npm install --omit=dev

COPY api/ .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
