FROM node:18-alpine

RUN apk add --no-cache iptables

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

CMD ["node", "server.js"]