# ── Frontend Dockerfile ─────────────────────────────────────────────────
# Stage 1: Build React app
# ────────────────────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY public/ ./public/
COPY src/ ./src/
# Pass backend URL as build arg
ARG REACT_APP_API_URL=https://db-assistant-backend-105401535311.us-central1.run.app
ENV REACT_APP_API_URL=$REACT_APP_API_URL
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]