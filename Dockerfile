FROM node:16-alpine

WORKDIR /usr/src/app
ADD . ./
RUN npm install

EXPOSE 9000
# Start the bot.
CMD ["node", "start.js"]