FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/
COPY packages/db/package.json ./packages/db/
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY . .

# Generate Prisma client
RUN cd packages/db && pnpm generate

# Build shared + db
RUN pnpm --filter @elc/shared build
RUN pnpm --filter @elc/db build

# Build backend
RUN pnpm --filter @elc/backend build

EXPOSE 4000
CMD ["node", "apps/backend/dist/index.js"]
