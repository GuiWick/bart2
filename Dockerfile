FROM node:22-alpine

WORKDIR /app

# Copy source
COPY . .

# Build backend (TypeScript → JS)
WORKDIR /app/backend
RUN npm install && npx tsc && mkdir -p static

# Build frontend (React/Vite) and copy into backend/static
WORKDIR /app/frontend
RUN npm install && npm run build && cp -r dist/* ../backend/static/

# Run from repo root so relative paths work
WORKDIR /app
CMD ["node", "backend/dist/index.js"]
