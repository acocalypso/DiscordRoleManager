const { Client, GatewayIntentBits, Partials } = require('discord.js');

const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel,
  ],
});
// init internationalization / localization class
const i18n = require('./module/i18n');
const config = require('./config/config.json');
const web = require('./module/backend');
const sqlConnectionDiscord = require('./module/database/database_discord');
const helper = require('./module/helper');
const routine = require('./module/routine');
const discordcommands = require('./module/discordcommands');
const slashCommands = require('./module/slashCommands');

if (config.webinterface.disabled === 'no') {
  web.website(bot);
}

bot.login(config.token);

bot.on('clientReady', () => {
  helper.myLogger.log('Bot started');
  console.log(i18n.__('app.ready'));
  sqlConnectionDiscord.InitDB();
  slashCommands.registerSlashCommands();
});

const checkIntervall = config.checkIntervall * 60000;

// ##########################################################################
// ############################# SERVER LISTENER ############################
// ##########################################################################
// DATABASE TIMER FOR TEMPORARY ROLES
setInterval(async () => {
  routine.housekeeping(bot);
}, checkIntervall);

if (config.specialmode.enabled === 'yes') {
  bot.on('guildMemberAdd', async (member) => {
    console.log('guildMemberAdd active!');
    const defaultRole = config.specialmode.hideRole;
    member.roles.add(defaultRole).then(helper.myLogger.log('Hide Role added: ' + member.id));
  });
}

bot.on('interactionCreate', async (interaction) => {
  await slashCommands.handleInteraction(interaction);
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

bot.on('error', (err) => {
  if (typeof err === 'object') {
    helper.myLogger.error('Uncaught error: ' + err, 'error.log');
  }
});

process.on('unhandledRejection', (reason, p) => {
  helper.myLogger.error('Unhandled Rejection at Promise: %s', p);
});

process.on('unhandledRejection', (error) => {
  helper.myLogger.error('Unhandled promise rejection:', error);
});

bot.on('disconnect', (error) => {
  helper.myLogger.error(helper.GetTimestamp() + 'Disconnected from Discord: ' + error);
  bot.connect();
});
