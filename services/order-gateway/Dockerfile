FROM node:20-alpine

WORKDIR /app

# Install dependencies first for Docker caching
COPY package.json .
RUN npm install

# Copy application code
COPY . .

# Start the gateway (matches port 3000 from docker-compose)
CMD ["npm", "start"]