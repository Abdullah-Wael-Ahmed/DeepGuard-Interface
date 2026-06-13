FROM node:18-alpine

WORKDIR /app

RUN apk update && apk add sudo iptables docker-cli

COPY package*.json ./

# Install only production dependencies (ignores devDependencies like nodemon)
RUN npm install --omit=dev

COPY . .

EXPOSE 5000

# Run the server directly (change "server.js" to "index.js" or your actual entry file)
CMD ["node", "app.js"]