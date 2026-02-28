FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better for Docker caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the code and build the TypeScript
COPY . .
RUN npm run build

EXPOSE 3002

# Run the compiled JavaScript version
CMD ["npm", "run", "start:prod"]