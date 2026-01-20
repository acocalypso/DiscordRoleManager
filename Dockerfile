FROM node:22-alpine

#define WORKDIR
WORKDIR /usr/src/app
ADD . ./
RUN npm install
# Expose ports for bot and webinterface
EXPOSE 9000 40444
# Start the bot (builds the frontend and starts the bot).
CMD ["npm", "run", "start"]