# Stage 1: Build the Vue.js application
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Serve the static files with Nginx
FROM nginx:stable-alpine
RUN rm /etc/nginx/conf.d/default.conf
# IMPORTANT: Nginx 默认只 include `/etc/nginx/conf.d/*.conf`，所以这里必须使用 `.conf` 后缀
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
