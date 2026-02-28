FROM node:20-alpine

WORKDIR /app

# Install dependencies first for Docker caching
COPY package.json .
RUN npm install

# Copy application code
COPY . .

# Start the worker (matches port 3003 from docker-compose)
CMD ["npm", "start"]