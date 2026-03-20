# Stage 0: Base
FROM node:20 AS base
WORKDIR /app

ENV NODE_OPTIONS="--max-old-space-size=4096"

# Install Node 25.3.0 via n
RUN npm install -g n && n 25.3.0 && hash -r

# Enable Corepack and activate pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package manifests first (for layer caching)
COPY package.json .
COPY pnpm-lock.yaml .

# Install dependencies
# git config: force HTTPS for GitHub (electron/node-gyp uses git+ssh which fails without SSH keys)
RUN git config --system url."https://github.com/".insteadOf "git@github.com:" \
    && git config --system url."https://github.com/".insteadOf "ssh://git@github.com/" \
    && pnpm install --frozen-lockfile

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

# Copy entire source for build
COPY . .

# Create production env file
RUN echo "NEXT_PUBLIC_BASE_PATH=/${NEXT_PUBLIC_BASE_PATH}" > .env.production

# Build the app (runs next build + post-build.sh to copy static assets)
RUN pnpm run build

# Stage 2: Runner (Standalone)
FROM node:20-alpine AS runner
WORKDIR /app

# Install Node 25.3.0 (download official musl binary for Alpine)
RUN apk add --no-cache libstdc++ \
    && wget -qO- https://unofficial-builds.nodejs.org/download/release/v25.3.0/node-v25.3.0-linux-x64-musl.tar.gz | tar xz -C /usr/local --strip-components=1 \
    && node --version

# Copy standalone output (includes minimal node_modules)
COPY --from=builder /app/.next/standalone ./

# Copy static assets (standalone output doesn't include these)
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy server wrapper for error handling
COPY --from=builder /app/server-wrapper.js ./server-wrapper.js

# Copy entrypoint script
COPY --from=builder /app/entrypoint.sh ./entrypoint.sh

RUN chmod +x ./entrypoint.sh

EXPOSE 5000

ENV PORT=5000
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server-wrapper.js"]
