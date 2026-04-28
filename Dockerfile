# Build Frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Setup Backend & Serve
FROM node:20-alpine
WORKDIR /app

# Copy backend files
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --production

# Copy backend source code
COPY backend/ ./

# Copy built frontend from previous stage
COPY --from=build /app/dist /app/dist

# Expose port (Cloud Run defaults to 8080, but we can set PORT env)
EXPOSE 8080

# Start server
ENV NODE_ENV=production
ENV PORT=8080
CMD ["node", "server.js"]
