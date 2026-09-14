# مرحلة البناء
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# مرحلة التشغيل (Nginx)
FROM nginx:1.31.3-alpine3.24-slim
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]