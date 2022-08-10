const { Client, GatewayIntentBits } = require('discord.js');

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
});
// init internationalization / localization class
const i18nModule = require('i18n-nodejs');
const config = require('./config/config.json');
const web = require('./module/backend');
const sqlConnectionDiscord = require('./module/database/database_discord');
const helper = require('./module/helper');
const routine = require('./module/routine');
const discordcommands = require('./module/discordcommands');

if (config.webinterface.disabled === 'no') {
  web.website();
}

const i18nconfig = {
  lang: config.language,
  langFile: './../../locale/locale.json',
};

const i18n = new i18nModule(i18nconfig.lang, i18nconfig.langFile);

bot.login(config.token);

bot.on('ready', () => {
  helper.myLogger.log('Bot started');
  console.log(i18n.__('Ready'));
  sqlConnectionDiscord.InitDB();
});

const checkIntervall = config.checkIntervall * 60000;

// ##########################################################################
// ############################# SERVER LISTENER ############################
// ##########################################################################
// DATABASE TIMER FOR TEMPORARY ROLES
setInterval(async () => {
  routine.housekeeping(bot);
}, checkIntervall);

bot.on('messageCreate', async (message) => {
// MAKE SURE ITS A COMMAND
  if (!message.content.startsWith(config.cmdPrefix)) {
    return;
  }

  // STOP SCRIPT IF DM/PM
  if (message.channel.type === 'dm') {
    return;
  }

  // GET CHANNEL INFO
  let msg = message.content;
  msg = msg.toLowerCase();

  // REMOVE LETTER CASE (MAKE ALL LOWERCASE)
  let command = msg.toLowerCase();
  command = command.split(/\s+/)[0];
  command = command.slice(config.cmdPrefix.length);

  // GET ARGUMENTS
  const args = msg.split(/\s+/).slice(1);

  if (command.startsWith('temprole') || command === 'tr' || command === 'trole') {
    discordcommands.temprole(message, command, args, bot);
  }

  if (command === 'paypal' || command === 'subscribe') {
    discordcommands.paypal(message, bot);
  }

  if (command === 'command' || command === 'help') {
    discordcommands.help(message, command, bot);
  }

  // ############################## CHECK ##############################
  if (command === 'check') {
    discordcommands.check(message, args, bot);
  }
  // ######################### MAP ###################################
  if (command === 'map') {
    discordcommands.map(message, bot);
  }

  if (command === 'register') {
    discordcommands.register(message, bot, args);
  }
});

// Check for bot events other than messages
bot.on('guildMemberRemove', async (member) => {
// Used to note database entries when users leave the server.
  const guild = member.guild.id;
  await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${member.id}" AND guild_id="${guild}"`)
    .then(async (rows) => {
      for (let rowNumber = 0; rowNumber < rows.length; rowNumber += 1) {
        discordcommands.leftserver(bot, member, rows[rowNumber].userID, rows[rowNumber].guild_id);
      }
    })
    .catch((err) => {
      helper.myLogger.error(helper.GetTimestamp() + '[InitDB] Failed to execute query in guildMemberRemove: ' + err);
    });
});

function RestartBot(type) {
  if (type === 'manual') { process.exit(1); } else {
    helper.myLogger.error('Unexpected error, bot stopping.');
    process.exit(1);
  }
}

if (!config.debug === 'yes') {
  bot.on('error', (err) => {
    if (typeof err === 'object') {
      helper.myLogger.error('Uncaught error: ' + err, 'error.log');
    }
    RestartBot();
  });

  process.on('unhandledRejection', (reason, p) => {
    helper.myLogger.error('Unhandled Rejection at Promise: %s', p);
  });

  process.on('uncaughtException', (err) => {
    if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
      helper.myLogger.error(helper.GetTimestamp() + 'Lost connection to the DB server. Waiting for activity before reconnecting...');
    } else {
      helper.myLogger.error(helper.GetTimestamp() + 'Uncaught Exception thrown: ' + err);
      process.exit(1);
    }
  });

  bot.on('disconnect', (error) => {
    helper.myLogger.error(helper.GetTimestamp() + 'Disconnected from Discord: ' + error);
    bot.connect();
  });
}
