# Alternativa ao iniciar.bat/iniciar.sh: docker compose up -d
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/app/data PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY server ./server
COPY scripts ./scripts
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "server/start.js"]
