# ==============================================================================
# Dockerfile: Roofing & CompanyCam Bridge Service for Twenty CRM
# Build context: ./custom-roofing-crm
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency specifications from service subfolder
COPY service/package.json ./package.json
RUN npm install

# Copy source and config
COPY service/tsconfig.json ./tsconfig.json
COPY service/src/ ./src/

RUN npm run build

# --- Production Image ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install Chromium and system dependencies required for headless PDF printing
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      font-noto-emoji

COPY service/package.json ./package.json
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

# Copy the SQL migration scripts so the service can auto-execute them on startup
COPY 01_roofing_schema_and_triggers.sql ./01_roofing_schema_and_triggers.sql
COPY 02_seed_roofing_catalogs_and_views.sql ./02_seed_roofing_catalogs_and_views.sql
COPY companycam/03_companycam_schema_and_triggers.sql ./companycam/03_companycam_schema_and_triggers.sql
COPY 04_work_orders_and_material_orders.sql ./04_work_orders_and_material_orders.sql

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/healthz || exit 1

CMD ["node", "dist/index.js"]
