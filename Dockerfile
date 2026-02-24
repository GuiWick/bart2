FROM node:22-alpine

WORKDIR /app

# Copy source
COPY . .

# Build backend (TypeScript → JS)
WORKDIR /app/backend
RUN npm install && npx tsc && mkdir -p static

# Build frontend — Vite outputs directly to ../backend/static (see vite.config.ts)
WORKDIR /app/frontend
RUN npm install && npm run build

# Run from repo root
WORKDIR /app
CMD ["node", "backend/dist/index.js"]
