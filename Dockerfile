# Build stage
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

# Runtime stage: production dependencies only
FROM node:22-alpine AS runner
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/build ./build

# Stdio MCP server: no port. Pass the key at run time, e.g.
#   docker run -i --rm -e EXA_API_KEY exa-mcp-server
ENV NODE_ENV=production
USER node
ENTRYPOINT ["node", "build/index.js"]
