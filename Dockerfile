FROM node:16

# Create the bot's directory
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 3000
# Start the bot.
CMD ["node", "start.js"]