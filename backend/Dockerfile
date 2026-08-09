FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["sh", "-c", "node src/marketplace/seed.js && node src/server.js"]
