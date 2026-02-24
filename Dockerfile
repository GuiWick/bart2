FROM node:22-alpine

WORKDIR /app

# Install backend deps first (cached unless package.json changes)
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Install frontend deps
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install

# Copy all source and build
COPY . .
RUN cd backend && npx tsc && mkdir -p static
RUN cd frontend && npm run build

WORKDIR /app
CMD ["node", "backend/dist/index.js"]
