# Stage 0: Base
FROM node:20 AS base
WORKDIR /repo

ENV NODE_OPTIONS="--max-old-space-size=4096"

# Install Node 25.3.0 via n
RUN npm install -g n && n 25.3.0 && hash -r

# Enable Corepack and activate pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy monorepo configs and lockfile
COPY pnpm-workspace.yaml .
COPY turbo.json .
COPY package.json .
COPY pnpm-lock.yaml .

# Add app-specific package.json
COPY apps/mentor/package.json ./apps/mentor/package.json

# Add all packages for workspace resolution
COPY packages ./packages

# Install dependencies
RUN pnpm install

# Stage 1: Builder
FROM base AS builder

# Accept build arguments
ARG NEXT_IMAGE_PATTERNS
ARG NEXT_PUBLIC_BASE_PATH
ARG SENTRY_AUTH_TOKEN
# Make available as environment variables during build
ENV NEXT_IMAGE_PATTERNS=$NEXT_IMAGE_PATTERNS
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ENV SENTRY_AUTH_TOKEN=$SENTRY_AUTH_TOKEN

ENV NODE_OPTIONS="--max-old-space-size=4096"

# Copy entire monorepo for build
COPY . .

# Create production env file
RUN echo "NEXT_PUBLIC_BASE_PATH=/${NEXT_PUBLIC_BASE_PATH}" > apps/mentor/.env.production

# Build the app (this runs next build + post-build.sh to copy static assets)
RUN pnpm turbo run build --filter=ibl-web-nextjs-mentor-spa

# Stage 2: Runner (Standalone)
FROM node:20-alpine AS runner
WORKDIR /app

# Install Node 25.3.0 (download official musl binary for Alpine)
RUN apk add --no-cache libstdc++ \
    && wget -qO- https://unofficial-builds.nodejs.org/download/release/v25.3.0/node-v25.3.0-linux-x64-musl.tar.gz | tar xz -C /usr/local --strip-components=1 \
    && node --version

# Copy standalone output (includes minimal node_modules)
COPY --from=builder /repo/apps/mentor/.next/standalone ./

# Copy server wrapper for error handling
COPY --from=builder /repo/apps/mentor/server-wrapper.js ./apps/mentor/server-wrapper.js

# Copy static assets (already copied to standalone by post-build.sh)
# These are already in .next/standalone/apps/mentor/.next/static and .next/standalone/apps/mentor/public

# Copy entrypoint script if it exists
COPY --from=builder /repo/apps/mentor/entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh 

# Set working directory to app location in standalone
WORKDIR /app/apps/mentor

EXPOSE 5000

# Use server-wrapper.js with PORT environment variable
ENV PORT=5000
CMD ["node", "server-wrapper.js"]
