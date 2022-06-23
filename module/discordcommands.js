const config = require('./../config/config.json');
const dateMultiplier = 86400000;
const sqlConnectionDiscord = require('./database/database_discord');
const helper = require('./helper');
const { MessageEmbed } = require('discord.js');
const wait = async ms => new Promise(done => setTimeout(done, ms));

var i18nconfig = {
	"lang": config.language,
	"langFile": "./../../locale/locale.json"
}
//init internationalization / localization class
var i18n_module = require('i18n-nodejs');
var i18n = new i18n_module(i18nconfig.lang, i18nconfig.langFile);

let adminRoleName = "";
let modRoleName = "";
let mainChannelID = "";

async function temprole(message, command, args, bot) {

	/// GET CHANNEL INFO
	let g = message.guild;
	let c = message.channel;
	let m = message.member;
	let msg = message.content;


	await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id="${g.id}" AND mainChannelID="${c.id}"`)
		.then(async rows => {
			// Update all entries from the database
			if (rows[0]) {
				adminRoleName = rows[0].adminRoleName;
				modRoleName = rows[0].modRoleName;
				mainChannelID = rows[0].mainChannelID;

				// GET TAGGED USER
				let mentioned = "";
				if (message.mentions.users.first()) {
					mentioned = message.mentions.users.first();
				}

				// REMOVE LETTER CASE (MAKE ALL LOWERCASE)
				command = msg.toLowerCase();
				command = command.split(" ")[0];
				command = command.slice(config.cmdPrefix.length);

				// GET ROLES FROM CONFIG
				let AdminR = g.roles.cache.find(role => role.id === adminRoleName);
				if (!AdminR) {
					AdminR = { "id": "111111111111111111" };
				}
				let ModR = g.roles.cache.find(role => role.id === modRoleName);
				if (!ModR) {
					ModR = { "id": "111111111111111111" };
				}


				if (m.roles.cache.has(ModR.id) || m.roles.cache.has(AdminR.id) || m.id === config.ownerID) {
					if (!args[0]) {
						message.reply("syntax:\n `" + config.cmdPrefix + "temprole @mention <DAYS> <ROLE-NAME>`,\n or `" + config.cmdPrefix + "temprole remove @mention <ROLE-NAME>`\n or `" + config.cmdPrefix + "temprole check @mention <ROLE-NAME>`").catch((err) => { console.log(err) });
						return;
					}
					else if (!mentioned) {
						message.reply("please `@mention` a person you want me to give/remove `" + config.cmdPrefix + "temprole` to...").catch((err) => { console.log(err) });
						return;
					}
					else if (!args[2]) {
						message.reply("incomplete data, please try: \n `" + config.cmdPrefix + "temprole @mention <DAYS> <ROLE-NAME>`,\n or `" + config.cmdPrefix + "temprole remove @mention <ROLE-NAME>`\n or `" + config.cmdPrefix + "temprole check @mention <ROLE-NAME>`").catch((err) => { console.log(err) });
						return;
					}
					else {
						let daRole = "";
						let days = 0;
						if (args[0] === "add") {
							daRole = args[3];
							days = args[2];
						}
						else {
							daRole = args[2];
							days = args[1];
						}

						//let rName = g.roles.cache.find(rName => rName.name.toLowerCase() === daRole.toLowerCase());
						let rName = g.roles.cache.find(rName => rName.name.toLowerCase() === message.mentioned.roles.first());
						if (!rName) {
							message.reply(i18n.__("I couldn't find such role, please check the spelling and try again."));
							return;
						}

						// CHECK DATABASE FOR ROLES
						if (args[0] === "check") {
							await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}"`)
								.then(async row => {
									if (!row[0]) {
										c.send(i18n.__("⚠ [ERROR] {{mentionedUsername}} is __NOT__ in the `DataBase` for the role {{daRole}}", {
											mentionedUsername: mentioned.username,
											daRole: daRole
										})).catch((err) => { console.log(err) });
										return;
									}
									let startDateVal = new Date();
									startDateVal.setTime(row[0].startDate * 1000);
									let startDateTime = await helper.formatTimeString(startDateVal);
									let endDateVal = new Date();
									endDateVal.setTime(row[0].endDate * 1000);
									let finalDate = await helper.formatTimeString(endDateVal);

									c.send(i18n.__("✅ {{mentionedUsername}} will lose the role: **{{rowTempRole}}** on: `{{finalDate}}`! They were added on: `{{startDateTime}}`", {
										mentionedUsername: mentioned.username,
										rowTempRole: row[0].temporaryRole,
										finalDate: finalDate,
										startDateTime: startDateTime
									})).catch((err) => { console.log(err) });
								}).catch(err => {
									console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 9:" + `(${err})`);
									return;
								});
							return;
						}

						// REMOVE MEMBER FROM DATABASE
						else if (args[0] === "remove") {
							mentioned = message.mentions.members.first();
							await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}"`)
								.then(async row => {
									if (!row[0]) {
										c.send(i18n.__("⚠ [ERROR] {{mentionedUsername}} is __NOT__ in the `DataBase` for the role {{daRole}}", {
											mentionedUsername: mentioned.user.username,
											daRole: daRole
										})).catch((err) => { console.log(err) });
										return;
									}

									let theirRole = g.roles.cache.find(theirRole => theirRole.name.toLowerCase() === row[0].temporaryRole.toLowerCase());
									mentioned.roles.remove(theirRole, 'Donation Expired').catch((err) => { console.log(err) });

									await sqlConnectionDiscord.query(`DELETE FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}"`)
										.then(async result => {
											console.log(helper.GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{mUserUsername}} ({{mID}}) removed the access from {{mentionedUsername}} ({{mentionedID}}", {
												mUserUsername: m.user.username,
												mID: m.id,
												mentionedUsername: mentioned.user.username,
												mentionedID: mentioned.id
											}));
											c.send(i18n.__("⚠ {{mentionedUsername}} has **lost** their role of: **{{theirRoleName}}** and has been removed from the database", {
												mentionedUsername: mentioned.user.username,
												theirRoleName: theirRole.name
											})).catch((err) => { console.log(err) });
										})
										.catch(err => {
											console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 11:" + `(${err})`);
											return;
										});
								})
								.catch(err => {
									console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 10:" + `(${err})`);
									return;
								});
							return;
						}

						// ADD TIME TO A USER
						else if (args[0] === "add") {
							if (!Number(args[2])) {
								message.reply(i18n.__("Error: second value has to be **X** number of days, IE:\n `{{configCMDPrefix}}{{command}} add @{{mentionedUsername}} 90 {{daRole}}`", {
									configCMDPrefix: config.cmdPrefix,
									command: command,
									mentionedUsername: mentioned.username,
									daRole: daRole
								})).catch((err) => { console.log(err) });
								return;
							}

							if (args[1] && !mentioned) {
								message.reply(i18n.__("please `@mention` a person you want me to add time to...")).catch((err) => { console.log(err) });
								return;
							}
							if (!args[2]) {
								message.reply(i18n.__("for how **many** days do you want {{mentionedUsername}} to have to have this role?", {
									mentionedUsername: mentioned.username
								})).catch((err) => { console.log(err) });
								return;
							}
							await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}"`)
								.then(async row => {
									if (!row[0]) {
										message.reply(i18n.__("⚠ [ERROR] {{mentionedUsername}} is __NOT__ in the database", {
											mentionedUsername: mentioned.username
										})).catch((err) => { console.log(err) });
										return;
									}
									let startDateVal = new Date();
									startDateVal.setTime(row[0].startDate * 1000);
									let startDateTime = await helper.formatTimeString(startDateVal);
									let finalDate = Number(row[0].endDate * 1000) + Number(days * dateMultiplier);

									let name = mentioned.username.replace(/[^a-zA-Z0-9]/g, '');
									await sqlConnectionDiscord.query(`UPDATE temporary_roles SET endDate="${Math.round(finalDate / 1000)}", notified=0, username="${name}" WHERE userID="${mentioned.id}" AND temporaryRole="${daRole}" AND guild_id="${g.id}"`)
										.then(async result => {
											let endDateVal = new Date();
											endDateVal.setTime(finalDate);
											finalDate = await helper.formatTimeString(endDateVal);
											dmFinalDate = finalDate;
											console.log(helper.GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{mentionedUsername}} ({{mentionedID}}) was given {{days}} days by: {{mUserUsername}} ({{mID}}) for the role: {{daRole}}", {
												mentionedUsername: mentioned.username,
												mentionedID: mentioned.id,
												days: days,
												mUserUsername: m.user.username,
												mID: m.id,
												daRole: daRole
											}));
											c.send(i18n.__("✅ {{mentionedUsername}} has had time added until: `{{finalDate}}`! They were added on: `{{startDateTime}}`", {
												mentionedUsername: mentioned.username,
												finalDate: finalDate,
												startDateTime: startDateTime
											}));

											mentioned.send(i18n.__("Hello {{mentionedUsername}}!\n\n🎉Your access has been extended🎉.\nIt is now valid till {{finalDate}}.\n\nThanks for your support", {
												mentionedUsername: mentioned.username,
												finalDate: finalDate
											})).catch(error => {
												console.error(helper.GetTimestamp() + i18n.__("Failed to send a DM to user: {{mentionedID}}", {
													mentionedID: mentioned.id
												}));
											}).catch((err) => { console.log(err) });

										})
										.catch(err => {
											console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 14:" + `(${err})`);
											return;
										});
								})
								.catch(err => {
									console.log(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 13:" + `(${err})`);
									return;
								});
							return;
						}
						else {
							if (!Number(args[1])) {
								message.reply("Error: second value has to be **X** number of days, IE:\n`!" + command + " @" + mentioned.username + " 90 " + daRole + "`").catch((err) => { console.log(err) });
							}
						}

						// ADD MEMBER TO DATASE, AND ADD THE ROLE TO MEMBER
						await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND temporaryRole="${daRole}" AND guild_id="${g.id}"`)
							.then(async row => {
								mentioned = message.mentions.members.first();
								if (!row[0]) {
									let curDate = new Date().getTime();
									let finalDateDisplay = new Date();
									let finalDate = curDate + (Number(args[1]) * dateMultiplier);
									finalDateDisplay.setTime(finalDate);
									finalDateDisplay = await helper.formatTimeString(finalDateDisplay);
									let name = mentioned.user.username.replace(/[^a-zA-Z0-9]/g, '');
									let values = mentioned.user.id + ',\''
										+ daRole + '\','
										+ Math.round(curDate / 1000) + ','
										+ Math.round(finalDate / 1000) + ','
										+ m.id
										+ ', 0' + ',\''
										+ name + '\', 0 ,'
										+ g.id
									await sqlConnectionDiscord.query(`INSERT INTO temporary_roles VALUES(${values});`)
										.then(async result => {
											let theirRole = g.roles.cache.find(role => role.name.toLowerCase() === daRole.toLowerCase());
											mentioned.roles.add(theirRole).catch(err => { console.error(helper.GetTimestamp() + err); });
											console.log(helper.GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{mentionedUsername}} ({{mentionedID}}) was given the {{daRole}} role by {{mUserUsername}} ({{mID}})", {
												mentionedUsername: mentioned.user.username,
												mentionedID: mentioned.id,
												daRole: daRole,
												mUserUsername: m.user.username,
												mID: m.id
											}));
											c.send(i18n.__("🎉 {{mentionedUsername}} has been given a **temporary** role of: **{{daRole}}**, enjoy! They will lose this role on: `{{finalDateDisplay}}`", {
												mentionedUsername: mentioned.user.username,
												daRole: daRole,
												finalDateDisplay: finalDateDisplay
											}));

											mentioned.send(i18n.__("Hello {{mentionedUsername}}!\n\nYour access expires at {{finalDateDisplay}}.\n\nThanks for your support.\n\nLiveMap: {{map}}.", {
												mentionedUsername: mentioned.user.username,
												finalDateDisplay: finalDateDisplay,
												map: config.mapMain.url
											})).catch(error => {
												console.error(helper.GetTimestamp() + i18n.__("Failed to send a DM to user: {{mentionedID}}", {
													mentionedID: mentioned.id
												}));
											}).catch((err) => { console.log(err) });
										})
										.catch(err => {
											console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 16:" + `(${err})`);
											return;
										});
								}
								else {
									c.send(i18n.__("This user already has the role **{{daRole}}** try using `{{configCMDPrefix}}temprole remove @{{mentionedUsername}} {{daRole}} ` if you want to reset their role.", {
										daRole: daRole,
										configCMDPrefix: config.cmdPrefix,
										mentionedUsername: mentioned.user.username
									}));
								}
							})
							.catch(err => {
								console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 16:" + `(${err})`);
								return;
							});
					}

				}
				else {
					c.send(i18n.__("you are **NOT** allowed to use this command!")).catch((err) => { console.log(GetTimestamp() + err); });
				}
			} 
		})
}

async function help(message, command, bot) {

	/// GET CHANNEL INFO
	let g = message.channel.guild;
	let c = message.channel;
	let m = message.member;
	let msg = message.content;

	await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id="${g.id}" AND mainChannelID="${c.id}"`)
		.then(async rows => {
			// Update all entries from the database
			if (rows[0]) {
				adminRoleName = rows[0].adminRoleName;
				modRoleName = rows[0].modRoleName;
				mainChannelID = rows[0].mainChannelID;

				// REMOVE LETTER CASE (MAKE ALL LOWERCASE)
				command = command.split(" ")[0];
				command = command.slice(config.cmdPrefix.length);

				// GET ARGUMENTS
				args = msg.split(" ").slice(1);

				// GET ROLES FROM CONFIG
				let AdminR = g.roles.cache.find(role => role.id === adminRoleName);
				if (!AdminR) {
					AdminR = { "id": "111111111111111111" };
					console.info(helper.GetTimestamp() + i18n.__("[ERROR] [CONFIG] I could not find admin role: {{configAdminRoleName}}", {
						configAdminRoleName: adminRoleName
					}));
				}
				let ModR = g.roles.cache.find(role => role.id === modRoleName);
				if (!ModR) {
					ModR = { "id": "111111111111111111" };
					console.info(helper.GetTimestamp() + i18n.__("[ERROR] [CONFIG] I could not find mod role: {{configModRoleName}}", {
						configModRoleName: modRoleName
					}));
				}

				if (args[0] === "mods") {
					if (m.roles.cache.has(AdminR.id) || m.roles.cache.has(ModR.id)) {
						cmds = "`" + config.cmdPrefix + "temprole @mention <DAYS> <ROLE-NAME>`   \\\u00BB   to assign a temporary roles\n"
							+ "`" + config.cmdPrefix + "temprole check @mention <ROLE-NAME>`  \\\u00BB   to check the time left on a temporary role assignment\n"
							+ "`" + config.cmdPrefix + "temprole remove @mention <ROLE-NAME>`   \\\u00BB   to remove a temporary role assignment\n"
							+ "`" + config.cmdPrefix + "temprole add @mention <DAYS> <ROLE-NAME>`   \\\u00BB   to add more time to a temporary role assignment\n";
						message.reply(cmds).catch((err) => { console.log(err) });
					}
					else {
						c.send(i18n.__("you are **NOT** allowed to use this command! \ntry using: {{configCMDPrefix}}help", {
							configCMDPrefix: config.cmdPrefix
						})).catch((err) => { console.log(err) });
						return;
					}
				}
				if (!args[0]) {
					cmds = "`" + config.cmdPrefix + "check <Role-NAME>`   \\\u00BB   to check the time left on your subscription\n";
					if (config.mapMain.enabled === "yes") {
						cmds += "`" + config.cmdPrefix + "map`   \\\u00BB   a link to our web map\n"
					}
					if (config.paypal.enabled === "yes") {
						cmds += "`" + config.cmdPrefix + "subscribe`/`" + config.cmdPrefix + "paypal`   \\\u00BB   for a link to our PayPal\n"
					}
				}
				c.send(cmds);
			}
		})
}

async function paypal(message, bot) {
	/// GET CHANNEL INFO
	let c = message.channel;

	var paypal_description = i18n.__("Thank you! \nYour support is greatly appreciated")
	var paypal_title = i18n.__("Click HERE to Subscribe")
	if (config.paypal.enabled === "yes") {
		const embedMSG = new MessageEmbed()
			.setColor('0xFF0000')
			.setTitle(paypal_title)
			.setURL(config.paypal.url)
			.setThumbnail(config.paypal.img)
			.setDescription(paypal_description);
		c.send({ embeds: [embedMSG] }).catch((err) => { console.log(err) });
		};
	}

async function check(message, args, bot) {
	let c = message.channel;
	let g = message.channel.guild;
	let m = message.member;
	msg = message.content;
	args = msg.split(" ").slice(1);

	if (!args[0]) {
		c.send(i18n.__("Please enter the role you want to check like `{{configCMDPrefix}}check <ROLE-NAME>`", {
			configCMDPrefix: config.cmdPrefix
		}));
		return;
	}
	// ROLES WITH SPACES
	let daRole = "";
	for (var x = 0; x < args.length; x++) {
		daRole += args[x] + " ";
	}
	daRole = daRole.slice(0, -1);
	// CHECK ROLE EXIST
	let rName = g.roles.cache.find(rName => rName.name === daRole);
	if (!rName) {
		c.send(i18n.__("I couldn't find such role, please check the spelling and try again."));
		return;
	}

	// CHECK DATABASE FOR ROLES
	await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${m.id}" AND temporaryRole="${daRole}" AND guild_id="${g.id}"`)
		.then(async row => {
			if (!row[0]) {
				c.send(i18n.__("⚠ [ERROR] {{mAuthorUsername}} is __NOT__ in the database for the role {{daRole}}.", {
					mAuthorUsername: message.author.username,
					daRole: daRole
				})).catch((err) => { console.log(err) });
				return;
			}

			let startDateVal = new Date();
			startDateVal.setTime(row[0].startDate * 1000);
			let startDateTime = await helper.formatTimeString(startDateVal);
			let endDateVal = new Date();
			endDateVal.setTime(row[0].endDate * 1000);
			let finalDate = await helper.formatTimeString(endDateVal);

			c.send(i18n.__("✅ You will lose the role: **{{rowTempRole}}** on: `{{finalDate}}`! The role was added on: `{{startDateTime}}`", {
				rowTempRole: row[0].temporaryRole,
				finalDate: finalDate,
				startDateTime: startDateTime
			})).catch((err) => { console.log(err) });

		})
		.catch(err => {
			console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 8:" + `(${err})`);
			return;
		});
	return;
}

async function map(message, bot) {

	/// GET CHANNEL INFO
	let c = message.channel;
	let msg = message.content;

	if (config.mapMain.enabled === "yes") {
		c.send(i18n.__("Our official webmap: {{configMapUrl}}", {
			configMapUrl: config.mapMain.url
		})).catch((err) => { console.error(helper.GetTimestamp() + err); });
	}
	return;
}

async function leftserver(bot, member) {
	let g = message.channel.guild;
	let c = message.channel;
	// Check if the user had any temp roles
	await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${member.id}" AND guild_id="${g.id}"`)
		.then(async rows => {
			// Update all entries from the database
			if (rows[0]) {
				await sqlConnectionDiscord.query(`UPDATE temporary_roles SET leftServer = 1 WHERE userID="${member.id}" AND guild_id="${g.id}"`)
					.then(async result => {
						let name = member.user.username.replace(/[^a-zA-Z0-9]/g, '');
						console.log(helper.GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{name}} ({{memberID}}) has left the server. All role assignments have been marked in the database.", {
							name: name,
							memberID: member.id
						}));
						c.send(i18n.__(":exclamation: {{name}} has left the server.", {
							name: name
						}));
					})
					.catch(err => {
						console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 2:" + `(${err})`);
						return;
					});
			}
			if (rows[0]) {
				await sqlConnectionDiscord.query(`DELETE FROM temporary_roles WHERE userID="${member.id}" AND guild_id="${g.id}"`)
					.then(async result => {
						let name = member.user.username.replace(/[^a-zA-Z0-9]/g, '');
						console.log(helper.GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{name}} ({{memberID}}) got removed from the database.", {
							name: name,
							memberID: member.id
						}));
						c.send(i18n.__(":exclamation: {{name}} all access removed from database.", {
							name: name
						}));
					})
					.catch(err => {
						console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute query in guildMemberRemove") + "2:" + `(${err})`);
						return;
					});
			}
		})
		.catch(err => {
			console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute query in guildMemberRemove") + "1:" + `(${err})`);
			return;
		});

}

async function guildMemberRemove(bot,member,guildID) {
	// Used to note database entries when users leave the server.
	let guild = guildID;
/*	if (guild != config.serverID) {
		return;
	}*/
	// Check if the user had any temp roles
	await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${member.id}" AND guild_id="${guild}"`)
		.then(async rows => {
			// Update all entries from the database
			if (rows[0]) {
				await sqlConnectionDiscord.query(`UPDATE temporary_roles SET leftServer = 1 WHERE userID="${member.id}" AND guild_id="${guild}"`)
					.then(async result => {
						var name = "Unknown";
						name = rows[0].username;
						console.log(helper.GetTimestamp() + "[ADMIN] [TEMPORARY-ROLE] \"" + name + "\" (" + member.id + ") has left the server. All temp role assignments have been marked in the database.");
						await sqlConnectionDiscord.query(`SELECT mainChannelID from registration WHERE guild_id="${guild}"`)
							.then(async result => {
								bot.channels.cache.get(rows[0].mainChannelID).send(":exclamation: " + name + " has left the server. All temp role assignments have been marked in the database.");
							})
							.catch(err => {
								console.error(GetTimestamp() + `[InitDB] Failed to execute query in guildMemberRemove 3: (${err})`);
								return;
							});
					})
					.catch(err => {
						console.error(GetTimestamp() + `[InitDB] Failed to execute query in guildMemberRemove 2: (${err})`);
						return;
					});
			}
		})
		.catch(err => {
			console.error(helper.GetTimestamp() + `[InitDB] Failed to execute query in guildMemberRemove 1: (${err})`);
			return;
		});
}

async function getMember(bot,userID,guildID) {
	return new Promise(async (resolve) => {
		var member = {};
		await bot.guilds.cache.get(guildID).members.fetch();
		member = bot.guilds.cache.get(guildID).members.cache.get(userID);
		// Check if we pulled the member's information correctly or if they left the server.
		if (!member) {
			await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id=${guildID};`)
				.then(async result => {
					console.log(helper.GetTimestamp() + "[ADMIN] [MEMBER] Failed to get user ID: " + member.id);
					bot.channels.cache.get(result[0].mainChannelID).send(":exclamation: Failed to get user ID: " +
						member.id + " <@" + member.id + "> from the cache. Tagging them to force the cache update.")
						.catch(err => { console.error(helper.GetTimestamp() + err); });
			await bot.guilds.cache.get(guildID).members.fetch();
			await wait(1 * 1000); // 1 second
			member = bot.guilds.cache.get(guildID).members.cache.get(userID);
			// If it still doesn't exist, return an error
			if (!member) {
				console.error(helper.GetTimestamp() + "Failed to find a user for ID: " + member.id + ". They may have left the server.");
				bot.channels.cache.get(result[0].mainChannelID).send("**:x: Could not find a user for ID: " +
					member.id + " <@" + member.id + ">. They may have left the server.**")
					.catch(err => { console.error(helper.GetTimestamp() + err); });
				member = { "guild": { "id": guildID }, "id": member.id }
				await guildMemberRemove(bot, member,guildID)
				return resolve(false);
					}
				});
		}
		return resolve(member);
	});
}

async function register(message, bot, args) {
	let c = message.channel;
	let guild_id = message.guild.id;
	let guild_name = message.guild.name;
	let modRole = "";
	let adminRole = "";

	if (args[0] == "modrole") {
		//modRole = args[1];
		modRole = message.mentions.roles.first().id
		await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id="${guild_id}" AND modRoleName="${modRole}"`)
			.then(async rows => {
				// Update all entries from the database
				if (!rows[0]) {
					await sqlConnectionDiscord.query(`UPDATE registration SET modRoleName="${modRole}" WHERE guild_id=${guild_id};`)
						.then(async result => {
							console.log(helper.GetTimestamp() + i18n.__("[ADMIN] [ROLE-REGISTRATION] Role {{modRole}} on {{guild_name}} added to database", {
								guild_name: guild_name,
								modRole: modRole
							}));
							c.send(i18n.__("🎉 {{modRole}} has been registered!", {
								modRole: modRole
							}));
						});
				} else {
					c.send(i18n.__("🎉 {{modRole}} has already been registered!", {
						modRole: modRole
					}));
				}
			})
	}

	if (args[0] == "adminrole") {
		//adminRole = args[1];
		adminRole = message.mentions.roles.first().id
		await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id="${guild_id}" AND adminRoleName="${adminRole}"`)
			.then(async rows => {
				// Update all entries from the database
				if (!rows[0]) {
					await sqlConnectionDiscord.query(`UPDATE registration SET adminRoleName="${adminRole}" WHERE guild_id=${guild_id};`)
						.then(async result => {
							console.log(helper.GetTimestamp() + i18n.__("[ADMIN] [ROLE-REGISTRATION] Role {{adminRole}} on {{guild_name}} added to database", {
								guild_name: guild_name,
								adminRole: adminRole
							}));
							c.send(i18n.__("🎉 {{adminRole}} has been registered!", {
								adminRole: adminRole
							}));
						});
				} else {
					c.send(i18n.__("🎉 {{adminRole}} has already been registered!", {
						adminRole: adminRole
					}));
				}
			})
	}

	if (args[0] == "channel") {
		channelID = message.mentions.channels.first().id;

		await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id="${guild_id}" AND mainChannelID="${channelID}"`)
			.then(async rows => {
				// Update all entries from the database
				if (!rows[0]) {
					await sqlConnectionDiscord.query(`UPDATE registration SET mainChannelID = ${channelID} WHERE \`guild_id\`="${guild_id}"`)
						.then(async result => {
							console.log(helper.GetTimestamp() + i18n.__("[ADMIN] [CHANNEL-REGISTRATION] Channel added to database"));
							c.send(i18n.__("🎉 Channel has been registered!", {
								adminRole: adminRole
							}));
						});
				} else {
					c.send(i18n.__("🎉 Channel has already been registered!"));
				}
			})
	}

	if (!args[0]) {
		await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id="${guild_id}"`)
			.then(async rows => {
				// Update all entries from the database
				if (!rows[0]) {
					let values = guild_id + ',\''
						+ guild_name + '\''
					console.log(values);
					await sqlConnectionDiscord.query(`INSERT INTO registration (\`guild_id\`, \`guild_name\`) VALUES(${values});`)
						.then(async result => {
							console.log(helper.GetTimestamp() + i18n.__("[ADMIN] [SERVER-REGISTRATION] {{guild_name}} {{guild_id}} added to database", {
								guild_name: guild_name,
								guild_id: guild_id
							}));
							c.send(i18n.__("🎉 {{guild_name}} has been registered!", {
								guild_name: guild_name
							}));
						});
				} else {
					c.send(i18n.__("🎉 {{guild_name}} has already been registered!", {
						guild_name: guild_name
					}));
				}
			})
			.catch(err => {
				console.error(helper.GetTimestamp() + `[InitDB] Failed to execute query in Server registration: (${err})`);
				return;
			});
	}
}

exports.temprole = temprole;
exports.paypal = paypal;
exports.help = help;
exports.check = check;
exports.map = map;
exports.leftserver = leftserver;
exports.guildMemberRemove = guildMemberRemove;
exports.getMember = getMember;
exports.register = register;