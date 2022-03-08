const sqlConnectionDiscord = require('./database/database_discord');
const helper = require('./helper');
const config = require('./../config/config');
const discordcommands = require('./discordcommands');


var i18nconfig = {
	"lang": config.language,
	"langFile": "./../../locale/locale.json"
}
//init internationalization / localization class
var i18n_module = require('i18n-nodejs');
var i18n = new i18n_module(i18nconfig.lang, i18nconfig.langFile);


async function housekeeping(bot) {

	//check for expired users
	let timeNow = new Date().getTime();
	let dbTime = 0;
	let daysLeft = 0;

	await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles`)
		.then(async rows => {
			if (!rows[0]) {
				console.info(helper.GetTimestamp() + i18n.__("No one is in the DataBase"));
				return;
			}
			for (rowNumber = "0"; rowNumber < rows.length; rowNumber++) {
				dbTime = parseInt(rows[rowNumber].endDate) * 1000;
				notify = rows[rowNumber].notified;
				daysLeft = dbTime - timeNow;
				let leftServer = rows[rowNumber].leftServer;
				let rName = bot.guilds.cache.get(config.serverID).roles.cache.find(rName => rName.name.toLowerCase() === rows[rowNumber].temporaryRole.toLowerCase());
				var member = await discordcommands.getMember(bot, rows[rowNumber].userID)
				let name = member.user.username.replace(/[^a-zA-Z0-9]/g, '');
				// Check if we pulled the member's information correctly or if they left the server.
				if (!member && !leftServer) {
					continue;
				}
				// Update usernames for legacy data
				if (!rows[rowNumber].username && !leftServer) {
					
					await sqlConnectionDiscord.query(`UPDATE temporary_roles SET username="${name}" WHERE userID="${member.id}" AND guild_id="${member.guild.id}"`)
						.catch(err => {
							console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 4: " + `(${err})`);
						});
					console.log(helper.GetTimestamp() + i18n.__(`Updated the username for {{memberId}} to {{name}}`, {
						memberID: member.id,
						name: name
					}));
				}
				if (!leftServer && !rows[rowNumber].guild_id) {
					var guild_id = member.guild.id;
					await sqlConnectionDiscord.query(`UPDATE temporary_roles SET guild_id="${guild_id}" WHERE userID="${rows[rowNumber].userID}"`)
						.catch(err => {
							console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 4: " + `(${err})`);
						});
					console.log(helper.GetTimestamp() + i18n.__(`Updated guild_id for {{name}}`, {
						name: name
					}));
				}

				// CHECK IF THEIR ACCESS HAS EXPIRED
				if (daysLeft < 1) {
					// If they left the server, remove the entry without attempting the role removal
					if (leftServer) {
						await sqlConnectionDiscord.query(`DELETE FROM temporary_roles WHERE userID='${rows[rowNumber].userID}' AND temporaryRole='${rName.name}'`)
							.catch(err => {
								console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 5:" + `(${err})`);
								process.exit(-1);
							});
						bot.channels.cache.get(config.mainChannelID).send(i18n.__("⚠ {{rowUsername}} has **left** the server and **lost** their role of: **{{rNameName}}** - their **temporary** access has __EXPIRED__ 😭", {
							rowUsername: rows[rowNumber].username,
							rNameName: rName.name
						})).catch(err => { console.error(GetTimestamp() + err); });
						console.log(helper.GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{rowUsername}} - {{rowUserID}} has left the server and lost their role: {{rNameName}} ... time EXPIRED", {
							rowUsername: rows[rowNumber].username,
							rowUserID: rows[rowNumber].userID,
							rNameName: rName.name
						}));
						continue;
					}
					// REMOVE ROLE FROM MEMBER IN GUILD
					member.roles.remove(rName).then(async member => {
						bot.channels.cache.get(config.mainChannelID).send(i18n.__("⚠ {{memberUsername}} has **lost** their role of: **{{rNameName}}** - their **temporary** access has __EXPIRED__ 😭", {
							memberUsername: member.user.username,
							rNameName: rName.name
						})).catch(err => { console.error(helper.GetTimestamp() + err); });
						member.send(i18n.__("Hello {{memberUsername}}!\n\nYour role **{{rNameName}}** on **{{configServerName}}** has been removed.\nIf you want to continue, please do another donation.\n\nThank you.\nPaypal: {{configPaypalUrl}}", {
							memberUsername: member.user.username,
							rNameName: rName.name,
							configServerName: config.serverName,
							configPaypalUrl: config.paypal.url
						})).catch(err => { console.log(err) }).catch((err) => { console.log(err) })

						// REMOVE DATABASE ENTRY
						await sqlConnectionDiscord.query(`DELETE FROM temporary_roles WHERE userID='${member.id}' AND temporaryRole='${rName.name}' AND guild_id=`)
							.catch(err => {
								console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 2:" + `(${err})`);
								process.exit(-1);
							});
						console.log(helper.GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{memberUsername}} - {{memberId}} have lost their role: {{rNameName}} ... time EXPIRED", {
							memberUsername: member.user.username,
							memberId: member.id,
							rNameName: rName.name
						}));
					}).catch(error => {
						console.error(helper.GetTimestamp() + error.message);
						bot.channels.cache.get(config.mainChannelID).send(i18n.__("**⚠ Could not remove the {{rNameName}} role from {{memberUsername}}!**", {
							rNameName: rName.name,
							memberUsername: member.user.username
						})).catch(err => { console.error(helper.GetTimestamp() + err); });
					});
				}
				// CHECK IF THERE ARE ONLY HAVE 5 DAYS LEFT
				if (daysLeft < 432000000 && notify == "0" && !leftServer) {
					let endDateVal = new Date();
					endDateVal.setTime(dbTime);
					let finalDate = await helper.formatTimeString(endDateVal);
					// NOTIFY THE USER IN DM THAT THEY WILL EXPIRE
					if (config.paypal.enabled == "yes") {
						member.send(i18n.__("Hello {{memberUsername}}!\n\nYour role **{{rNameName}}** on **{{configServerName}}** will be removed at {{finalDate}}.\nIf you want to continue, please do another donation.\n\nThank you.\nPaypal: {{configPaypalUrl}}", {
							memberUsername: member.user.username,
							rNameName: rName.name,
							configServerName: config.serverName,
							finalDate: finalDate,
							configPaypalUrl: config.paypal.url
						})).catch((err) => {
							console.log(helper.GetTimestamp() + i18n.__(`Failed to send a DM to user: {{memberID}} - {{err}}`, {
								memberID: member.id,
								err: err
							}))
						});
					}
					else {
						member.send(i18n__(`Hello {{memberUsername}}!\n\nYour role **{{rNameName}}** on **{{configServerName}}** will be removed at {{finalDate}}.\nIf you want to continue, please do another donation.\n\nThank you.`, {
							memberUsername: member.user.username,
							rNameName: rName.name,
							configServerName: config.serverName,
							finalDate: finalDate,
						})).catch((err) => {
							console.log(helper.GetTimestamp() + i18n.__(`Failed to send a DM to user: {{memberID}} - {{err}}`, {
								memberID: member.id,
								err: err
							}))
						});
					}
					// NOTIFY THE ADMINS OF THE PENDING EXPIRY
					bot.channels.cache.get(config.mainChannelID).send(i18n.__(`⚠ {{memberUsername}} will lose their role of: **{{rNameName}}** in less than 5 days on {{finalDate}}.`, {
						memberUsername: member.user.username,
						rNameName: rName.name,
						finalDate: finalDate
					})).catch(err => { console.error(helper.GetTimestamp() + err); });
					// UPDATE THE DB TO REMEMBER THAT THEY WERE NOTIFIED
					let name = member.user.username.replace(/[^a-zA-Z0-9]/g, '');
					await sqlConnectionDiscord.query(`UPDATE temporary_roles SET notified=1, username="${name}" WHERE userID="${member.id}" AND temporaryRole="${rName.name}"`)
						.catch(err => {
							console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 3:" + `(${err})`);
							process.exit(-1);
						});
					console.log(helper.GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{memberUsername}} - ({{memberID}}) has been notified that they will lose their role {{rNameName}} in less than 5 days on {{finalDate}}", {
						memberUsername: member.user.username,
						memberID: member.id,
						rNameName: rName.name,
						finalDate: finalDate
					}));
				}
			}
		})
		.catch(err => {
			console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 1:" + `(${err})`);
			process.exit(-1);
		});
}

exports.housekeeping = housekeeping;