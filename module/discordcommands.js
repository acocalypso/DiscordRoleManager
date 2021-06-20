const config = require('./../config/config.json');
const dateMultiplier = 86400000;
const database = require('./database/database');
const helper = require('./helper');

var i18nconfig = {
	"lang": config.language,
	"langFile": "./../../locale/locale.json"
}
//init internationalization / localization class
var i18n_module = require('i18n-nodejs');
var i18n = new i18n_module(i18nconfig.lang, i18nconfig.langFile);

async function temprole(message, command, args, bot) {

	/// GET CHANNEL INFO
	let g = message.channel.guild;
	let c = message.channel;
	let m = message.member;
	let msg = message.content;
	msg = msg.toLowerCase();

	// GET TAGGED USER
	let mentioned = message.mentions[0];

	// REMOVE LETTER CASE (MAKE ALL LOWERCASE)
	command = msg.toLowerCase();
	command = command.split(" ")[0];
	command = command.slice(config.cmdPrefix.length);

	skip = "no";

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


	if (m.roles.includes(ModR.id) || m.roles.includes(AdminR.id) || m.id === config.ownerID) {
		if (!args[0]) {
			bot.createMessage(c.id, "syntax:\n `" + config.cmdPrefix + "temprole @mention <DAYS> <ROLE-NAME>`,\n or `" + config.cmdPrefix + "temprole remove @mention <ROLE-NAME>`\n or `" + config.cmdPrefix + "temprole check @mention <ROLE-NAME>`").catch((err) => { console.log(err) });
			return;
		}
		if (!mentioned) {
			bot.createMessage(c.id, "please `@mention` a person you want me to give/remove `" + config.cmdPrefix + "temprole` to...").catch((err) => { console.log(err) });
			return;
		}
		if (!args[2]) {
			bot.createMessage(c.id, "incomplete data, please try: \n `" + config.cmdPrefix + "temprole @mention <DAYS> <ROLE-NAME>`,\n or `" + config.cmdPrefix + "temprole remove @mention`\n or `" + config.cmdPrefix + "temprole check @mention`").catch((err) => { console.log(err) });
			return;
		}
		else {
			let daRole = "";
			let = 0;
			if (args[0] === "add") {
				daRole = args[3];
				days = args[2];
			}
			else {
				daRole = args[2];
				days = args[1];
			}

			let rName = g.roles.find(rName => rName.name === daRole);
			if (!rName) {
				bot.createMessage(c.id, i18n.__("I couldn't find such role, please check the spelling and try again."));
				return;
			}

			// CHECK DATABASE FOR ROLES
			if (args[0] === "check") {
				await database.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}"`)
					.then(async row => {
						if (!row[0]) {
							bot.createMessage(c.id, i18n.__("⚠ [ERROR] {{mentionedUsername}} is __NOT__ in the `DataBase` for the role {{daRole}}", {
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

						bot.createMessage(c.id, i18n.__("✅ {{mentionedUsername}} will lose the role: **{{rowTempRole}}** on: `{{finalDate}}`! They were added on: `{{startDateTime}}`", {
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

				await database.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}"`)
					.then(async row => {
						if (!row[0]) {
							bot.createMessage(c.id, i18n.__("⚠ [ERROR] {{mentionedUsername}} is __NOT__ in the `DataBase` for the role {{daRole}}", {
								mentionedUsername: mentioned.username,
								daRole: daRole
							})).catch((err) => { console.log(err) });
							return;
						}

						let theirRole = g.roles.find(theirRole => theirRole.name === row[0].temporaryRole);
						bot.guilds.get(config.serverID).removeMemberRole(mentioned.id, theirRole.id, 'Donation Expired').catch((err) => { console.log(err) });

						await database.query(`DELETE FROM temporary_roles WHERE userID="${mentioned.id}"`)
							.then(async result => {
								console.log(helper.GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{mUserUsername}} ({{mID}}) removed the access from {{mentionedUsername}} ({{mentionedID}}", {
									mUserUsername: m.user.username,
									mID: m.id,
									mentionedUsername: mentioned.username,
									mentionedID: mentioned.id
								}));
								bot.createMessage(c.id, i18n.__("⚠ {{mentionedUsername}} has **lost** their role of: **{{theirRoleName}}** and has been removed from the database", {
									mentionedUsername: mentioned.username,
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
					bot.createMessage(c.id, i18n.__("Error: second value has to be **X** number of days, IE:\n `{{configCMDPrefix}}{{command}} add @{{mentionedUsername}} 90 {{daRole}}`", {
						configCMDPrefix: config.cmdPrefix,
						command: command,
						mentionedUsername: mentioned.username,
						daRole: daRole
					})).catch((err) => { console.log(err) });
					return;
				}

				if (args[1] && !mentioned) {
					bot.createMessage(c.id, i18n.__("please `@mention` a person you want me to add time to...")).catch((err) => { console.log(err) });
					return;
				}
				if (!args[2]) {
					bot.createMessage(c.id, i18n.__("for how **many** days do you want {{mentionedUsername}} to have to have this role?", {
						mentionedUsername: mentioned.username
					})).catch((err) => { console.log(err) });
					return;
				}
				await database.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}"`)
					.then(async row => {
						if (!row[0]) {
							bot.createMessage(c.id, i18n.__("⚠ [ERROR] {{mentionedUsername}} is __NOT__ in the database", {
								mentionedUsername: mentioned.username
							})).catch((err) => { console.log(err) });
							return;
						}
						let startDateVal = new Date();
						startDateVal.setTime(row[0].startDate * 1000);
						let startDateTime = await helper.formatTimeString(startDateVal);
						let finalDate = Number(row[0].endDate * 1000) + Number(days * dateMultiplier);

						let name = mentioned.username.replace(/[^a-zA-Z0-9]/g, '');
						await database.query(`UPDATE temporary_roles SET endDate="${Math.round(finalDate / 1000)}", notified=0, username="${name}" WHERE userID="${mentioned.id}" AND temporaryRole="${daRole}"`)
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
								bot.createMessage(c.id, i18n.__("✅ {{mentionedUsername}} has had time added until: `{{finalDate}}`! They were added on: `{{startDateTime}}`", {
									mentionedUsername: mentioned.username,
									finalDate: finalDate,
									startDateTime: startDateTime
								}));

								bot.getDMChannel(mentioned.id).then(dm => dm.createMessage(i18n.__("Hello {{mentionedUsername}}!\n\n🎉Your access has been extended🎉.\nIt is now valid till {{finalDate}}.\n\nThanks for your support", {
									mentionedUsername: mentioned.username,
									finalDate: finalDate
								})).catch(error => {
									console.error(helper.GetTimestamp() + i18n.__("Failed to send a DM to user: {{mentionedID}}", {
										mentionedID: mentioned.id
									}));
								})).catch((err) => { console.log(err) });

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
					bot.createMessage(c.id, "Error: second value has to be **X** number of days, IE:\n`!" + command + " @" + mentioned.username + " 90 " + daRole + "`").catch((err) => { console.log(err) });
				}
			}

			// ADD MEMBER TO DATASE, AND ADD THE ROLE TO MEMBER
			await database.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND temporaryRole="${daRole}"`)
				.then(async row => {
					mentioned = message.mentions[0];
					if (!row[0]) {
						let curDate = new Date().getTime();
						let finalDateDisplay = new Date();
						let finalDate = curDate + (Number(args[1]) * dateMultiplier);
						finalDateDisplay.setTime(finalDate);
						finalDateDisplay = await helper.formatTimeString(finalDateDisplay);
						let name = mentioned.username;
						let values = mentioned.id + ',\''
							+ daRole + '\','
							+ Math.round(curDate / 1000) + ','
							+ Math.round(finalDate / 1000) + ','
							+ m.id
							+ ', 0' + ',\''
							+ name + '\', 0';
						await database.query(`INSERT INTO temporary_roles VALUES(${values});`)
							.then(async result => {
								let theirRole = g.roles.find(role => role.name === daRole);
								bot.guilds.get(config.serverID).addMemberRole(mentioned.id, theirRole.id, 'Donater').catch((err) => { console.log(err) });
								console.log(helper.GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{mentionedUsername}} ({{mentionedID}}) was given the {{daRole}} role by {{mUserUsername}} ({{mID}})", {
									mentionedUsername: mentioned.username,
									mentionedID: mentioned.id,
									daRole: daRole,
									mUserUsername: m.user.username,
									mID: m.id
								}));
								bot.createMessage(c.id, i18n.__("🎉 {{mentionedUsername}} has been given a **temporary** role of: **{{daRole}}**, enjoy! They will lose this role on: `{{finalDateDisplay}}`", {
									mentionedUsername: mentioned.username,
									daRole: daRole,
									finalDateDisplay: finalDateDisplay
								}));

								bot.getDMChannel(mentioned.id).then(dm => dm.createMessage(i18n.__("Hello {{mentionedUsername}}!\n\nYour access expires at {{finalDateDisplay}}.\n\nThanks for your support.\n\nLiveMap: {{map}}.", {
									mentionedUsername: mentioned.username,
									finalDateDisplay: finalDateDisplay,
									map: config.mapMain.url
								})).catch(error => {
									console.error(helper.GetTimestamp() + i18n.__("Failed to send a DM to user: {{mentionedID}}", {
										mentionedID: mentioned.id
									}));
								})).catch((err) => { console.log(err) });
							})
							.catch(err => {
								console.error(helper.GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 16:" + `(${err})`);
								return;
							});
					}
					else {
						bot.createMessage(c.id, i18n.__("This user already has the role **{{daRole}}** try using `{{configCMDPrefix}}temprole remove @{{mentionedUsername}} {{daRole}} ` if you want to reset their role.", {
							daRole: daRole,
							configCMDPrefix: config.cmdPrefix,
							mentionedUsername: mentioned.username
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
		bot.createMessage(c.id, i18n.__("you are **NOT** allowed to use this command!")).catch((err) => { console.log(GetTimestamp() + err); });
	}
}

async function help(message, command, bot) {

	/// GET CHANNEL INFO
	let g = message.channel.guild;
	let c = message.channel;
	let m = message.member;
	let msg = message.content;
	msg = msg.toLowerCase();

	// REMOVE LETTER CASE (MAKE ALL LOWERCASE)
	command = msg.toLowerCase();
	command = command.split(" ")[0];
	command = command.slice(config.cmdPrefix.length);

	// GET ARGUMENTS
	args = msg.split(" ").slice(1);
	skip = "no";

	// GET ROLES FROM CONFIG
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

	if (args[0] === "mods") {
		if (m.roles.includes(AdminR.id) || m.roles.includes(ModR.id)) {
			cmds = "`" + config.cmdPrefix + "temprole @mention <DAYS> <ROLE-NAME>`   \\\u00BB   to assign a temporary roles\n"
				+ "`" + config.cmdPrefix + "temprole check @mention <ROLE-NAME>`  \\\u00BB   to check the time left on a temporary role assignment\n"
				+ "`" + config.cmdPrefix + "temprole remove @mention <ROLE-NAME>`   \\\u00BB   to remove a temporary role assignment\n"
				+ "`" + config.cmdPrefix + "temprole add @mention <DAYS> <ROLE-NAME>`   \\\u00BB   to add more time to a temporary role assignment\n";
			bot.createMessage(c.id, cmds).catch((err) => { console.log(err) });
		}
		else {
			bot.createMessage(c.id, i18n.__("you are **NOT** allowed to use this command! \ntry using: {{configCMDPrefix}}help", {
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
	bot.createMessage(c.id, cmds);
}

async function paypal(message, bot) {
	/// GET CHANNEL INFO
	let c = message.channel;
	let msg = message.content;
	msg = msg.toLowerCase();
/*
	// REMOVE LETTER CASE (MAKE ALL LOWERCASE)
	command = msg.toLowerCase();
	command = command.split(" ")[0];
	command = command.slice(config.cmdPrefix.length);

	// GET ARGUMENTS
	args = msg.split(" ").slice(1);
	skip = "no";
	*/
	// ######################### PAYPAL/SUBSCRIBE ########################

	var paypal_description = i18n.__("Thank you! \nYour support is greatly appreciated")
	var paypal_title = i18n.__("Click HERE to Subscribe")
	if (config.paypal.enabled === "yes") {
		let embedMSG = {
			'color': 0xFF0000,
			'title': paypal_title,
			'url': config.paypal.url,
			'thumbnail': { 'url': config.paypal.img },
			'description': paypal_description
		};
		bot.createMessage(c.id, { embed: embedMSG }).catch((err) => { console.log(err) });
	}
}

async function check(message, args, bot) {
	let c = message.channel;
	let g = message.channel.guild;
	let m = message.member;
	msg = message.content;
	args = msg.split(" ").slice(1);

	if (!args[0]) {
		bot.createMessage(c.id, i18n.__("Please enter the role you want to check like `{{configCMDPrefix}}check <ROLE-NAME>`", {
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
	let rName = g.roles.find(rName => rName.name === daRole);
	if (!rName) {
		bot.createMessage(c.id, i18n.__("I couldn't find such role, please check the spelling and try again."));
		return;
	}

	// CHECK DATABASE FOR ROLES
	await database.query(`SELECT * FROM temporary_roles WHERE userID="${m.id}" AND temporaryRole="${daRole}"`)
		.then(async row => {
			if (!row[0]) {
				bot.createMessage(c.id, i18n.__("⚠ [ERROR] {{mAuthorUsername}} is __NOT__ in the database for the role {{daRole}}.", {
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

			bot.createMessage(c.id, i18n.__("✅ You will lose the role: **{{rowTempRole}}** on: `{{finalDate}}`! The role was added on: `{{startDateTime}}`", {
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
	msg = msg.toLowerCase();

	if (config.mapMain.enabled === "yes") {
		bot.createMessage(c.id, i18n.__("Our official webmap: {{configMapUrl}}", {
			configMapUrl: config.mapMain.url
		})).catch((err) => { console.error(helper.GetTimestamp() + err); });
	}
	return;
}

exports.temprole = temprole;
exports.paypal = paypal;
exports.help = help;
exports.check = check;
exports.map = map;