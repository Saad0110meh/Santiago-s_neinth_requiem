FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port specified in your docker-compose.yml
EXPOSE 3004

# Start the server
CMD ["npm", "start"]