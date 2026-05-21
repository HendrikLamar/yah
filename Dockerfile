FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
ARG DATABASE_URL=postgresql://yah:yah@postgres:5432/yah?schema=public
ARG DIRECT_DATABASE_URL=postgresql://yah:yah@postgres:5432/yah?schema=public
ARG SHADOW_DATABASE_URL=postgresql://yah:yah@postgres:5432/yah_shadow?schema=public
ENV DATABASE_URL=${DATABASE_URL}
ENV DIRECT_DATABASE_URL=${DIRECT_DATABASE_URL}
ENV SHADOW_DATABASE_URL=${SHADOW_DATABASE_URL}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run prisma:generate && npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl poppler-utils tesseract-ocr tesseract-ocr-deu tesseract-ocr-eng && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
EXPOSE 3000
CMD ["npm", "run", "start"]
