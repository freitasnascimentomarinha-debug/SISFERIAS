# Alternativa ao iniciar.bat/iniciar.sh: docker compose up -d (ver docker-compose.yml).
# No contêiner o banco é o serviço PostgreSQL do docker-compose; os binários
# do PostgreSQL embutido (dependências opcionais) não são instalados.
# A imagem base pode ser trocada (ex.: espelho interno):
#   docker build --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-alpine .
ARG NODE_IMAGE=node:22-alpine
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=optional --no-audit --no-fund
COPY . .
RUN npm run build

FROM ${NODE_IMAGE}
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/app/data PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY server ./server
COPY scripts ./scripts
VOLUME ["/app/data"]
EXPOSE 3000
CMD ["node", "server/start.js"]
