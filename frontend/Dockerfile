FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Relative /api/v1 so nginx on same host proxies to Django
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_TELEGRAM_BOT_USERNAME=lutfan_ai_bot
ARG VITE_ENABLE_DEV_LOGIN=true
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_TELEGRAM_BOT_USERNAME=$VITE_TELEGRAM_BOT_USERNAME \
    VITE_ENABLE_DEV_LOGIN=$VITE_ENABLE_DEV_LOGIN

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
