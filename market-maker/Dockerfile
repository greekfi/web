FROM node:22-alpine AS builder
WORKDIR /app

RUN corepack enable

# Copy package files and yarn config
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn .yarn

# Install all dependencies (need devDeps for build)
RUN yarn install --immutable

# Copy source and build
COPY src src
COPY tsup.config.ts tsconfig.json ./
RUN yarn build --no-dts

# --- Production stage ---
FROM node:22-alpine
WORKDIR /app

RUN corepack enable

# Copy package files for yarn to resolve modules
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn .yarn

# Copy node_modules and built output from builder
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/dist dist

# Copy cached metadata for fast startup
COPY data data

# Run as non-root
USER node

# Default command (overridden by docker-compose)
CMD ["node", "dist/bebop.mjs"]
