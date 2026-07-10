FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Install dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY . .

# Build shared
RUN pnpm --filter @elc/shared build

# Build frontend
RUN pnpm --filter @elc/frontend build

FROM nginx:alpine AS production
COPY --from=base /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
