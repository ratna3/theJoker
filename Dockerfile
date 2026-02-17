# ============================================
# The Joker - Agentic Terminal
# Multi-stage Dockerfile
# ============================================

# ── Stage 1: Build ────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ── Stage 2: Production ──────────────────────
FROM node:20-slim AS production

# Install Chromium dependencies for Puppeteer + Python for AirLLM
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use the system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

# Install production Node dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Install Python dependencies for AirLLM (optional)
COPY requirements-airllm.txt ./
RUN python3 -m pip install --break-system-packages --no-cache-dir -r requirements-airllm.txt || true

# Copy built output and supporting files
COPY --from=builder /app/dist ./dist
COPY airllm_server.py ./
COPY .env.example ./.env.example

# Create necessary directories
RUN mkdir -p logs projects reports .joker_memory

# Expose ports: AirLLM sidecar
EXPOSE 8899

# The terminal is interactive — requires -it flags
CMD ["node", "dist/index.js"]
