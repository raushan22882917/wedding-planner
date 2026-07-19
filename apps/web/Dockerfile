# Build stage
FROM node:22-alpine AS build
WORKDIR /app

# Copy workspace configuration and package files
COPY package*.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/

# Install dependencies for the monorepo workspace
RUN npm ci

# Copy web app sources
COPY apps/web ./apps/web

# Build the web app
RUN npm run build --workspace=@marrymap/web

# Production runtime stage
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy package configurations and install production dependencies
COPY package*.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/api/package.json ./apps/api/
RUN npm ci --omit=dev

# Copy the built Nitro server output
COPY --from=build /app/apps/web/.output ./apps/web/.output

EXPOSE 8080

# Start the application using the Nitro entry point
CMD ["node", "apps/web/.output/server/index.mjs"]
