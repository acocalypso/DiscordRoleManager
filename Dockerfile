FROM node:20-alpine

#define WORKDIR
WORKDIR /usr/src/app
ADD . ./
RUN npm install
# Expose ports for bot and webinterface
EXPOSE 9000 40444
# Start the bot.
CMD ["node", "start.js"]