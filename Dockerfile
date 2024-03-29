# Use an official Node.js runtime as a parent image
FROM node:21-alpine

# Set the working directory to /app
WORKDIR /app

# Copy the package.json and package-lock.json files to the container
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code to the container
COPY . .

# Compile the TypeScript code
RUN npm run build

# Expose port 3000 for the application
EXPOSE 3000
EXPOSE 3001
EXPOSE 9005

# Start the application using node
CMD ["node", "dist/index.js"]