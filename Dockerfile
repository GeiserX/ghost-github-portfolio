FROM node:26-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM node:26-alpine
# The base image's CA bundle predates the eMudhra distrust (2026-10-20); run Node
# on that patched system bundle, because its built-in roots still trust them.
RUN apk add --no-cache 'ca-certificates-bundle>=20261020-r0'
ENV NODE_OPTIONS=--use-openssl-ca
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist/ dist/
ENTRYPOINT ["node", "dist/index.js"]
CMD ["sync", "--config", "/config/config.yml"]
