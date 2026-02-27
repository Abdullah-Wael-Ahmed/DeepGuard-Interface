FROM node:20 as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build


# ---- Production Stage (Nginx) ----
FROM nginx:alpine
# Copy the built React/Vite files into Nginx's public folder
COPY --from=build /app/dist /usr/share/nginx/html
# Copy our custom Nginx configuration
COPY default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
