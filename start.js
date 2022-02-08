const Eris = require('eris');
const config = require('./config/config.json');
const dateMultiplier = 86400000;
const web = require('./module/backend.js');
const sqlConnectionDiscord = require('./module/database/database_discord');
const helper = require('./module/helper');
const routine = require('./module/routine');
const discordcommands = require('./module/discordcommands');
const log = require('log-to-file');

if (config.webinterface.disabled === "no") {
	web.website();
}

var i18nconfig = {
	"lang": config.language,
	"langFile": "./../../locale/locale.json"
}
//init internationalization / localization class
var i18n_module = require('i18n-nodejs');
var i18n = new i18n_module(i18nconfig.lang, i18nconfig.langFile);

var bot = new Eris(config.token, {
    disableEveryone: true,
    getAllUsers: true
});

bot.on('ready', () => {
	log('Bot started', 'info.log');
	console.log(i18n.__(`Ready`));
	sqlConnectionDiscord.InitDB();
});


bot.connect();

	// ##########################################################################
	// ############################# SERVER LISTENER ############################
	// ##########################################################################
	// DATABASE TIMER FOR TEMPORARY ROLES
setInterval(async function () {
	routine.housekeeping(bot);
		
}, 3600000);
	// 86400000 = 1day
	// 3600000 = 1hr
	// 60000 = 1min

bot.on("messageCreate", async (message) => {
	// MAKE SURE ITS A COMMAND
	if (!message.content.startsWith(config.cmdPrefix)) {
		return
	}

	//STOP SCRIPT IF DM/PM
	if (message.channel.type == "dm") {
		return
	}

	// GET CHANNEL INFO
	let g = message.channel.guild;
	let c = message.channel;
	let m = message.member;
	let msg = message.content;
	msg = msg.toLowerCase();

	// GET TAGGED USER
	//let mentioned = message.mentions[0];

	// REMOVE LETTER CASE (MAKE ALL LOWERCASE)
	let command = msg.toLowerCase();
	command = command.split(" ")[0];
	command = command.slice(config.cmdPrefix.length);

	// GET ARGUMENTS
	let args = message.content.split(" ").slice(1);
	//skip = "no";

	// GET ROLES FROM CONFIG
	//let AdminR = guild.members.filter(m => m.roles.)
	let AdminR = g.roles.find(role => role.name === config.adminRoleName);
	if (!AdminR) {
		AdminR = { "id": "111111111111111111" };
		console.info(helper.GetTimestamp() + i18n.__("[ERROR] [CONFIG] I could not find admin role: {{configAdminRoleName}}", {
			configAdminRoleName: config.adminRoleName
		}));
	}
	let ModR = g.roles.find(role => role.name === config.modRoleName);
	if (!ModR) {
		ModR = { "id": "111111111111111111" };
		console.info(helper.GetTimestamp() + i18n.__("[ERROR] [CONFIG] I could not find mod role: {{configModRoleName}}", {
			configModRoleName: config.modRoleName
		}));
	}

	// ############################################################################
	// ################################ COMMANDS ##################################
	// ############################################################################


	
	if (command.startsWith("temprole") || command === "tr" || command === "trole") {
		discordcommands.temprole(message, command, args, bot);
	}

	if (command.startsWith("telegram") || command === "tg") {
		telegramcommands.telegram(message, command, args, bot);
	}

	if (command === "paypal" || command === "subscribe") {
		discordcommands.paypal(message, bot);
	}

	if (command === "command" || command === "help") {
		discordcommands.help(message, command, bot);
	}

	// ############################## CHECK ##############################
	if (command === "check") {
		discordcommands.check(message, args, bot);
	}
	// ######################### MAP ###################################
	if (command === "map") {
		discordcommands.map(message, bot);
	}
});

// Check for bot events other than messages
bot.on('guildMemberRemove', async member => {

	// Used to note database entries when users leave the server.
	let guild = member.guild.id;
	if (guild != config.serverID) {
		return;
	}

	discordcommands.leftserver(bot, member);
	
});

	function RestartBot(type) {
		if (type == 'manual') { process.exit(1); }
		else {
			console.error(helper.GetTimestamp() + "Unexpected error, bot stopping.");
			process.exit(1);
		}
		return;
	}


	if (!config.debug == "yes") {
		bot.on('error', function (err) {
			if (typeof err == 'object') {
				console.error(helper.GetTimestamp() + 'Uncaught error: ' + err);
			}
			RestartBot();
			return;
		});

		process.on('unhandledRejection', (reason, p) => {
			console.error(helper.GetTimestamp() + 'Unhandled Rejection at Promise: ', p);
		});

		process.on('uncaughtException', err => {
			if (err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "ECONNRESET") {
				console.log(helper.GetTimestamp() + "Lost connection to the DB server. Waiting for activity before reconnecting...");
				return;
			}
			else {
				console.error(helper.GetTimestamp() + 'Uncaught Exception thrown');
				console.error(helper.GetTimestamp() + err);
				process.exit(1);
			}
		});

		socket.on('error', function (exec) {
			console.error(helper.GetTimestamp() + 'Exception occured: %s - ignored', exec);
		});

		bot.on('disconnect', (error) => {
			console.log(helper.GetTimestamp() + "Disconnected from Discord. %s ", error);
			bot.connect();
		});
	}
