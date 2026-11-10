# مرحلة البناء (Build Stage)
FROM node:20-slim AS build
WORKDIR /app

# معاملات البناء من EasyPanel / CI وضبط الذاكرة
ARG GIT_SHA
ENV GIT_SHA=$GIT_SHA
ENV NODE_OPTIONS="--max-old-space-size=4096"

# تثبيت الاعتماديات
COPY package*.json ./
RUN npm install --legacy-peer-deps

# نسخ الكود وبناء النسخة الإنتاجية
COPY . .
RUN npm run build

# مرحلة التشغيل (Nginx Production Stage)
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
