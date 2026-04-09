# Playwright test image for CI/CD
# Built from repo root: docker build -f e2e/Dockerfile .
FROM mcr.microsoft.com/playwright:v1.56.0-jammy

# Install AWS CLI for S3 log/report uploads
RUN apt-get update && \
    apt-get install -y python3-pip curl unzip && \
    pip3 install --no-cache-dir awscli && \
    rm -rf /var/lib/apt/lists/*

RUN aws --version

WORKDIR /app

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy package manifests from repo root (deps live here, not in e2e/)
COPY package.json pnpm-lock.yaml ./

# Install dependencies (skip optional like electron, skip postinstall scripts)
RUN pnpm install --frozen-lockfile --ignore-scripts --no-optional

# Copy e2e test suite
COPY e2e/ ./e2e/

# Copy entrypoint
COPY e2e/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["test"]
