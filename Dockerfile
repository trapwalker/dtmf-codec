# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY . .

# Build the library and examples
RUN npm run build && \
    npx vite build examples --outDir /app/dist-examples

# Production stage
FROM nginx:alpine

# Copy built examples to nginx
COPY --from=builder /app/dist-examples /usr/share/nginx/html

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
