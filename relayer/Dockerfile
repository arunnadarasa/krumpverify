# Krump Verify x402 relayer — Fly.io
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY server.js ./

EXPOSE 7350
ENV PORT=7350

CMD ["node", "server.js"]
