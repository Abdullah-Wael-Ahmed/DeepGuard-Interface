FROM node:18-alpine

WORKDIR /app

# Install dependencies, Docker CLI, and Chromium for Puppeteer
RUN apk update && apk add --no-cache \
    sudo \
    iptables \
    docker-cli \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to use the system-installed Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./

# Install only production dependencies (ignores devDependencies like nodemon)
RUN npm install --omit=dev

COPY . .

EXPOSE 5000

# Run the server directly (change "server.js" to "index.js" or your actual entry file)
CMD ["node", "app.js"]