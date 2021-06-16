const Eris = require('eris');
const config = require('./config/config.json');
const sqlite3 = require('sqlite3');
const sql = new sqlite3.Database('./dataBase.sqlite');
var mysql = require('mysql');
const wait = async ms => new Promise(done => setTimeout(done, ms));
const dateMultiplier = 86400000;

// Load locale
const language = config.language;
const lang = require('./locale/' + language + '.json');

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
	console.log(i18n.__(`Ready`));
	SQLConnect().then(x => {
		InitDB();
	}).catch(err => { console.log(GetTimestamp() + err); })
});


bot.connect();

	// ##########################################################################
	// ############################# SERVER LISTENER ############################
	// ##########################################################################
	// DATABASE TIMER FOR TEMPORARY ROLES
	setInterval(async function () {

		//check for expired users
		let timeNow = new Date().getTime();
		let dbTime = 0;
		let daysLeft = 0;
		let notify = 0;
		await query(`SELECT * FROM temporary_roles`)
			.then(async rows => {
				if (!rows[0]) {
					console.info(GetTimestamp() + i18n.__("No one is in the DataBase"));
					return;
				}
				for (rowNumber = "0"; rowNumber < rows.length; rowNumber++) {
					dbTime = parseInt(rows[rowNumber].endDate) * 1000;
					notify = rows[rowNumber].notified;
					daysLeft = dbTime - timeNow;
					let leftServer = rows[rowNumber].leftServer;
					let rName = await bot.guilds.get(config.serverID).roles.find(rName => rName.name === rows[rowNumber].temporaryRole);
					let member = await bot.guilds.get(config.serverID).members.get(rows[rowNumber].userID);

					// Check if we pulled the member's information correctly or if they left the server.
					if (!member && !leftServer) {
						continue;
					}
					// Update usernames for legacy data
					if (!rows[rowNumber].username && !leftServer) {
						let name = member.user.username.replace(/[^a-zA-Z0-9]/g, '');
						await query(`UPDATE temporary_roles SET username="${name}" WHERE userID="${member.id}"`)
							.catch(err => {
								console.error(GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 4: " + `(${err})`);
							});
						console.log(GetTimestamp() + i18n.__(`Updated the username for {{memberId}} to {{name}}`, {
							memberID: member.id,
							name: name
						}));
					}
					// CHECK IF THEIR ACCESS HAS EXPIRED
					if (daysLeft < 1) {
						// If they left the server, remove the entry without attempting the role removal
						if (leftServer) {
							await query(`DELETE FROM temporary_roles WHERE userID='${rows[rowNumber].userID}' AND temporaryRole='${rName.name}'`)
								.catch(err => {
									console.error(GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 5:" + `(${err})`);
									process.exit(-1);
								});
							bot.createMessage(config.mainChannelID, i18n.__("⚠ {{rowUsername}} has **left** the server and **lost** their role of: **{{rNameName}}** - their **temporary** access has __EXPIRED__ 😭", {
								rowUsername: rows[rowNumber].username,
								rNameName: rName.name
							})).catch(err => { console.error(GetTimestamp() + err); });
							console.log(GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{rowUsername}} - {{rowUserID}} has left the server and lost their role: {{rNameName}} ... time EXPIRED", {
								rowUsername: rows[rowNumber].username,
								rowUserID: rows[rowNumber].userID,
								rNameName: rName.name
							}));
							continue;
						}
						// REMOVE ROLE FROM MEMBER IN GUILD
						member.removeRole(rName.id).then(async members => {
							bot.createMessage(config.mainChannelID, i18n.__("⚠ {{memberUsername}} has **lost** their role of: **{{rNameName}}** - their **temporary** access has __EXPIRED__ 😭", {
								memberUsername: member.user.username,
								rNameName: rName.name
							})).catch(err => { console.error(GetTimestamp() + err); });
							bot.getDMChannel(member.user.id).then(dm => dm.createMessage(i18n.__("Hello {{memberUsername}}!\n\nYour role **{{rNameName}}** on **{{configServerName}}** has been removed.\nIf you want to continue, please do another donation.\n\nThank you.\nPaypal: {{configPaypalUrl}}", {
								memberUsername: member.user.username,
								rNameName: rName.name,
								configServerName: config.serverName,
								configPaypalUrl: config.paypal.url
							})).catch((err) => { console.log(err) })).catch((err) => { console.log(err) })

							// REMOVE DATABASE ENTRY
							await query(`DELETE FROM temporary_roles WHERE userID='${member.id}' AND temporaryRole='${rName.name}'`)
								.catch(err => {
									console.error(GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 2:" + `(${err})`);
									process.exit(-1);
								});
							//console.log(GetTimestamp() + i18n.__(`[ADMIN] [TEMPORARY-ROLE] %s - %s have lost their role: %s ... time EXPIRED`, member.user.username, member.id, rName.name));
							console.log(GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{memberUsername}} - {{memberId}} have lost their role: {{rNameName}} ... time EXPIRED", {
								memberUsername: member.user.username,
								memberId: member.id,
								rNameName: rName.name
							}));
						}).catch(error => {
							console.error(GetTimestamp() + error.message);
							bot.createMessage(config.mainChannelID, i18n.__("**⚠ Could not remove the {{rNameName}} role from {{memberUsername}}!**", {
								rNameName: rName.name,
								memberUsername: member.user.username
							})).catch(err => { console.error(GetTimestamp() + err); });
						});
					}
					// CHECK IF THERE ARE ONLY HAVE 5 DAYS LEFT
					if (daysLeft < 432000000 && notify == "0" && !leftServer) {
						let endDateVal = new Date();
						endDateVal.setTime(dbTime);
						let finalDate = await formatTimeString(endDateVal);
						// NOTIFY THE USER IN DM THAT THEY WILL EXPIRE
						if (config.paypal.enabled == "yes") {
							bot.getDMChannel(member.user.id).then(dm => dm.createMessage(i18n.__("Hello {{memberUsername}}!\n\nYour role **{{rNameName}}** on **{{configServerName}}** will be removed at {{finalDate}}.\nIf you want to continue, please do another donation.\n\nThank you.\nPaypal: {{configPaypalUrl}}", {
								memberUsername: member.user.username,
								rNameName: rName.name,
								configServerName: config.serverName,
								finalDate: finalDate,
								configPaypalUrl: config.paypal.url
							})).catch((err) => {
								console.log(GetTimestamp() + i18n.__(`Failed to send a DM to user: {{memberID}} - {{err}}`, {
									memberID: member.id,
									err: err
								}))
							}));
						}
						else {
							bot.getDMChannel(member.user.id).then(dm => dm.createMessage(i18n__(`Hello {{memberUsername}}!\n\nYour role **{{rNameName}}** on **{{configServerName}}** will be removed at {{finalDate}}.\nIf you want to continue, please do another donation.\n\nThank you.`, {
								memberUsername: member.user.username,
								rNameName: rName.name,
								configServerName: config.serverName,
								finalDate: finalDate,
							})).catch((err) => {
								console.log(GetTimestamp() + i18n.__(`Failed to send a DM to user: {{memberID}} - {{err}}`, {
									memberID: member.id,
									err: err
								}))
							}));
						}
						// NOTIFY THE ADMINS OF THE PENDING EXPIRY
						bot.createMessage(config.mainChannelID, i18n.__(`⚠ {{memberUsername}} will lose their role of: **{{rNameName}}** in less than 5 days on {{finalDate}}.`, {
							memberUsername: member.user.username,
							rNameName: rName.name,
							finalDate: finalDate
						})).catch(err => { console.error(GetTimestamp() + err); });
						// UPDATE THE DB TO REMEMBER THAT THEY WERE NOTIFIED
						let name = member.user.username.replace(/[^a-zA-Z0-9]/g, '');
						await query(`UPDATE temporary_roles SET notified=1, username="${name}" WHERE userID="${member.id}" AND temporaryRole="${rName.name}"`)
							.catch(err => {
								console.error(GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 3:" + `(${err})`);
								process.exit(-1);
							});
						console.log(GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{memberUsername}} - ({{memberID}}) has been notified that they will lose their role {{rNameName}} in less than 5 days on {{finalDate}}", {
							memberUsername: member.user.username,
							memberID: member.id,
							rNameName: rName.name,
							finalDate: finalDate
						}));
					}
				}
			})
			.catch(err => {
				console.error(GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 1:" + `(${err})`);
				process.exit(-1);
			});
	}, 600000);
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
	let mentioned = message.mentions[0];

	// REMOVE LETTER CASE (MAKE ALL LOWERCASE)
	let command = msg.toLowerCase();
	command = command.split(" ")[0];
	command = command.slice(config.cmdPrefix.length);

	// GET ARGUMENTS
	let args = msg.split(" ").slice(1);
	skip = "no";

	// GET ROLES FROM CONFIG
	//let AdminR = guild.members.filter(m => m.roles.)
	let AdminR = g.roles.find(role => role.name === config.adminRoleName);
	if (!AdminR) {
		AdminR = { "id": "111111111111111111" };
		console.info(GetTimestamp() + i18n.__("[ERROR] [CONFIG] I could not find admin role: {{configAdminRoleName}}", {
			configAdminRoleName: config.adminRoleName
		}));
	}
	let ModR = g.roles.find(role => role.name === config.modRoleName);
	if (!ModR) {
		ModR = { "id": "111111111111111111" };
		console.info(GetTimestamp() + i18n.__("[ERROR] [CONFIG] I could not find mod role: {{configModRoleName}}", {
			configModRoleName: config.modRoleName
		}));
	}

	// ############################################################################
	// ################################ COMMANDS ##################################
	// ############################################################################


	// ######################### COMMANDS/HELP ###########################
	if (command === "commands" || command === "help") {
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

	// ######################### PAYPAL/SUBSCRIBE ########################

	const paypal_title = lang.paypal_title;
	const paypal_description = lang.paypal_description;

	if (command === "paypal" || command === "subscribe") {
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

	// ############################## Telegram Auth Bot ##############################
	if (command.startsWith("telegram")) {

		if (config.telegram.tele_enabled == "yes") {
			var conn = mysql.createConnection({
				host: config.telegram.tele_db_host,
				user: config.telegram.tele_db_user,
				password: config.telegram.tele_db_pass,
				database: config.telegram.tele_db_name
			});

			var tele_result = "";
			// ROLES ARE CASE SENSITIVE TO RESET MESSAGE AND ARGUMENTS
			msg = message.content;
			args = msg.split(" ").slice(1);

			if (m.roles.includes(ModR.id) || m.roles.includes(AdminR.id) || m.id === config.ownerID) {
				if (!args[0]) {
					bot.createMessage(c.id, i18n.__("syntax:\n {{configCMDPrefix}}telegram @mention <DAYS> <ROLE-NAME>\n or {{configCMDPrefix}}telegram check @mention", {
						configCMDPrefix: config.cmdPrefix
					})).catch((err) => { console.log(err) });
				}
				if (args[0] && !args[1]) {
					bot.createMessage(c.id, "please `@mention` a person you want me to give/remove `" + config.cmdPrefix + "telegram` to...").catch((err) => { console.log(err) });
				}
				/*if (!args[1] && mentioned) {
					bot.createMessage(c.id, "incomplete data, please try: \n `" + config.cmdPrefix + "telegram @mention <DAYS> <ROLE-NAME>`,\n or `" + config.cmdPrefix + "telegram check @mention`").catch((err) => { console.log(err) });
				}*/
				else {
					let dateMultiplier = 86400000;

					// CHECK DATABASE FOR EXPIRE DATE
					if (args[0] === "check") {

						conn.connect(function (err) {
							if (err) throw err;
							// if connection is successful
							conn.query(`SELECT * FROM abos WHERE TelegramUser ="${args[1]}"`, function (err, result, fields) {
								// if any error while executing above query, throw error
								if (err) throw err;
								// if there is no error, you have the result
								// iterate for all the rows in result
								if (result.length === 0) {
									bot.createMessage(c.id, "⚠ [ERROR] " + args[1] + " is __NOT__ in the `DataBase`").catch((err) => { console.log(err) });
								} else {
									Object.keys(result).forEach(function (key) {
										tele_result = result[key];
										console.log(tele_result.id);

										bot.createMessage(c.id, "✅ " + tele_result.TelegramUser + " will lose access on: " + tele_result.endtime).catch((err) => { console.log(err) });

									});
								}
							});
						});
						conn.end();
					};

					// ADD TIME TO A USER
					if (args[0] === "add") {
						if (!parseInt(args[2])) {
							bot.createMessage(c.id, "Error: second value has to be **X** number of days, IE:\n`!" + command + " @" + arg[1] + " 90").catch((err) => { console.log(err) });
						}

						if (!args[2]) {
							bot.createMessage(c.id, "for how **many** days do you want " + mentioned.username + " to have to have this role?").catch((err) => { console.log(err) });
						}
						else {
							conn.connect(function (err) {
								if (err) throw err;
								// if connection is successful
								conn.query(`SELECT * FROM abos WHERE TelegramUser ="${args[1]}"`, function (err, result, fields) {
									// if any error while executing above query, throw error
									if (err) throw err;
									// if there is no error, you have the result
									// iterate for all the rows in result
									if (result.length === 0) {
										bot.createMessage(c.id, "⚠ [ERROR] " + args[1] + " is __NOT__ in the `DataBase`").catch((err) => { console.log(err) });
									} else {
										Object.keys(result).forEach(function (key) {
											tele_result = result[key];

											let startDateVal = new Date();
											startDateVal.setTime(tele_result.paydate);
											startDateVal = startDateVal.getDate() + "." + (startDateVal.getMonth() + 1) + "." + startDateVal.getFullYear();

											let endDateVal = new Date(tele_result.endtime).getTime();
											let finalDate = (parseInt(endDateVal) + parseInt((args[2]) * (dateMultiplier)));
											let expireDate = new Date(parseInt(finalDate));
											expireDate = expireDate.getFullYear() + "-" + (expireDate.getMonth() + 1) + "-" + expireDate.getDate() + " " + expireDate.getHours() + ":" + expireDate.getMinutes() + ":" + expireDate.getSeconds();


											conn.query(`UPDATE abos SET endtime="${expireDate}" WHERE TelegramUser="${args[1]}"`,
												function (err, result, fields) {
													// if any error while executing above query, throw error
													if (err) throw err;
													// if there is no error, you have the result
													// iterate for all the rows in result

													bot.createMessage(c.id, "✅ " + args[1] + " has had time added until: `" + expireDate + "`! They were added on: `" + startDateVal + "`").catch((err) => { console.log(err) });
												});
										});
									}
								});
							});
						}
					}

					if (/@[A-Za-z0-9]+/.test(args[0])) {

						if (!parseInt(args[1])) {
							bot.createMessage(c.id, "Error: second value has to be **X** number of days, IE:\n`!" + command + args[0] + " 90`").catch((err) => { console.log(err) });
							return;
						}

						conn.connect(function (err) {
							if (err) throw err;
							// if connection is successful
							conn.query(`SELECT * FROM abos WHERE TelegramUser ="${args[0]}"`, function (err, result, fields) {
								// if any error while executing above query, throw error
								if (err) throw err;
								// if there is no error, you have the result
								// iterate for all the rows in result
								if (result.length === 0) {

									let curDate = new Date().getTime();
									let finalDateDisplay = new Date();
									let finalDate = ((args[1]) * (dateMultiplier));
									finalDate = ((curDate) + (finalDate));
									finalDateDisplay.setTime(finalDate);
									finalDateDisplay = finalDateDisplay.getFullYear() + "-" + (finalDateDisplay.getMonth() + 1) + "-" + finalDateDisplay.getDate() + " " + finalDateDisplay.getHours() + ":" + finalDateDisplay.getMinutes() + ":" + finalDateDisplay.getSeconds();
									let creationDate = new Date(curDate); //2020-10-12 15:05:51 - Thu Nov 12 2020 14:09:36 GMT+0100 (GMT+01:00) {}
									creationDate = creationDate.getDate() + "." + (creationDate.getMonth() + 1) + "." + creationDate.getFullYear();

									conn.query(`INSERT INTO abos (buyerName, buyerEmail, Amount, TelegramUser, userid, channels,pass,TransID,paydate,endtime,info) VALUES ('', '', 0, '${args[0]}', NULL, '', '', NULL, NOW(), '${finalDateDisplay}', 0)`,
										function (err, result, fields) {
											// if any error while executing above query, throw error
											if (err) throw err;
											// if there is no error, you have the result
											// iterate for all the rows in result
											bot.createMessage(c.id, "✅ " + args[0] + " has been created on: `" + creationDate + "`!").catch((err) => { console.log(err) });
										});
								} else {
									bot.createMessage(c.id, "⚠ [ERROR] " + args[0] + " is __ALREADY__ in the `DataBase`").catch((err) => { console.log(err) });
								}
							});
						});
						conn.end();
					}
				}
			}
			else {
				bot.createMessage(c.id, "you are **NOT** allowed to use this command!").catch((err) => { console.log(err) });
			}
		} else {
			bot.createMessage(c.id, "Telegram not enabled in config!").catch((err) => { console.log(err) });
		}
	}


	if (command.startsWith("temprole") || command === "tr" || command === "trole") {

		// ROLES ARE CASE SENSITIVE TO RESET MESSAGE AND ARGUMENTS
		msg = message.content;
		args = msg.split(" ").slice(1);

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
					await query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}"`)
						.then(async row => {
							if (!row[0]) {
								bot.createMessage(c.id, i18n.__("⚠ [ERROR] {{mentionedUsername}} is __NOT__ in the `DataBase` for the role {{daRole}}", {
									mentionedUsername: mentioned.usernamen,
									daRole: daRole
								})).catch((err) => { console.log(err) });
								return;
							}
							let startDateVal = new Date();
							startDateVal.setTime(row[0].startDate * 1000);
							let startDateTime = await formatTimeString(startDateVal);
							let endDateVal = new Date();
							endDateVal.setTime(row[0].endDate * 1000);
							let finalDate = await formatTimeString(endDateVal);

							bot.createMessage(c.id, i18n.__("✅ {{mentionedUsername}} will lose the role: **{{rowTempRole}}** on: `{{finalDate}}`! They were added on: `{{startDateTime}}`", {
								mentionedUsername: mentioned.username,
								rowTempRole: row[0].temporaryRole,
								finalDate: finalDate,
								startDateTime: startDateTime
							})).catch((err) => { console.log(err) });
						}).catch(err => {
							console.error(GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 9:" + `(${err})`);
							return;
						});
					return;
				}

				// REMOVE MEMBER FROM DATABASE
				else if (args[0] === "remove") {

					await query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}"`)
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

							await query(`DELETE FROM temporary_roles WHERE userID="${mentioned.id}"`)
								.then(async result => {
									console.log(GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{m.user.username}} ({{m.id}}) removed the access from {{mentioned.username}} ({{mentioned.id}}", {
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
									console.error(GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 11:" + `(${err})`);
									return;
								});
						})
						.catch(err => {
							console.error(GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 10:" + `(${err})`);
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
					await query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}"`)
						.then(async row => {
							if (!row[0]) {
								bot.createMessage(c.id, i18n.__("⚠ [ERROR] {{mentionedUsername}} is __NOT__ in the database", {
									mentionedUsername: mentioned.username
								})).catch((err) => { console.log(err) });
								return;
							}
							let startDateVal = new Date();
							startDateVal.setTime(row[0].startDate * 1000);
							let startDateTime = await formatTimeString(startDateVal);
							let finalDate = Number(row[0].endDate * 1000) + Number(days * dateMultiplier);

							let name = mentioned.username.replace(/[^a-zA-Z0-9]/g, '');
							await query(`UPDATE temporary_roles SET endDate="${Math.round(finalDate / 1000)}", notified=0, username="${name}" WHERE userID="${mentioned.id}" AND temporaryRole="${daRole}"`)
								.then(async result => {
									let endDateVal = new Date();
									endDateVal.setTime(finalDate);
									finalDate = await formatTimeString(endDateVal);
									dmFinalDate = finalDate;
									console.log(GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{mentionedUsername}} ({{mentionedID}}) was given {{days}} days by: {{mUserUsername}} ({{mID}}) for the role: {{daRole}}", {
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

									bot.getDMChannel(mentioned.id).then(dm => dm.createMessage(i18n.__("Hello {{mentionedUsername}}!\n\nYour access has been extended.\nIt is now valid till {{finalDate}}.\n\nThanks for your support", {
										mentionedUsername: mentioned.username,
										finalDate: finalDate
									})).catch(error => {
										console.error(GetTimestamp() + i18n.__("Failed to send a DM to user: {{mentionedID}}", {
											mentionedID: mentioned.id
										}));
									})).catch((err) => { console.log(err) });

								})
								.catch(err => {
									console.error(GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 14:" + `(${err})`);
									return;
								});
						})
						.catch(err => {
							console.log(GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 13:" + `(${err})`);
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
				await query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND temporaryRole="${daRole}"`)
					.then(async row => {
						mentioned = message.mentions[0];
						if (!row[0]) {
							let curDate = new Date().getTime();
							let finalDateDisplay = new Date();
							let finalDate = curDate + (Number(args[1]) * dateMultiplier);
							finalDateDisplay.setTime(finalDate);
							finalDateDisplay = await formatTimeString(finalDateDisplay);
							let name = mentioned.username;
							let values = mentioned.id + ',\''
								+ daRole + '\','
								+ Math.round(curDate / 1000) + ','
								+ Math.round(finalDate / 1000) + ','
								+ m.id
								+ ', 0' + ',\''
								+ name + '\', 0';
							await query(`INSERT INTO temporary_roles VALUES(${values});`)
								.then(async result => {
									let theirRole = g.roles.find(role => role.name === daRole);
									bot.guilds.get(config.serverID).addMemberRole(mentioned.id, theirRole.id, 'Donater').catch((err) => { console.log(err) });
									console.log(GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{mentionedUsername}} ({{mentionedID}}) was given the {{daRole}} role by {{mUserUsername}} ({{mID}})", {
										mentionedUsername: mentioned.username,
										mentionedID: mentioned.id,
										daRole: daRole,
										mUserUsername: m.user.username,
										mID: m.id
									}));
									bot.createMessage(c.id, i18n.__("🎉 {{mentionedUsername}} has been given a **temporary** role of: **{{daRole}}**, enjoy! They will lose this role on: `{{finalDateDisplay}}`",{
										mentionedUsername: mentioned.username,
										daRole: daRole,
										finalDateDisplay: finalDateDisplay
									}));

									bot.getDMChannel(mentioned.id).then(dm => dm.createMessage(i18n.__("Hello {{mentionedUsername}}!\n\nYour access expires at {{finalDateDisplay}}.\n\nThanks for your support.\n\nLiveMap: {{map}}.", {
										mentionedUsername: mentioned.username,
										finalDateDisplay: finalDateDisplay,
										map: config.mapMain.url
									})).catch(error => {
										console.error(GetTimestamp() + i18n.__("Failed to send a DM to user: {{mentionedID}}", {
											mentionedID: mentioned.id
										}));
									})).catch((err) => { console.log(err) });
								})
								.catch(err => {
									console.error(GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 16:" + `(${err})`);
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
						console.error(GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 16:" + `(${err})`);
						return;
					});
			}

		}
		else {
			bot.createMessage(c.id, i18n.__("you are **NOT** allowed to use this command!")).catch((err) => { console.log(GetTimestamp() + err); });
		}
	}



	// ############################## CHECK ##############################
	if (command === "check") {

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
			bot.createMessage(c.id,i18n.__("I couldn't find such role, please check the spelling and try again."));
			return;
		}

		// CHECK DATABASE FOR ROLES
		await query(`SELECT * FROM temporary_roles WHERE userID="${m.id}" AND temporaryRole="${daRole}"`)
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
				let startDateTime = await formatTimeString(startDateVal);
				let endDateVal = new Date();
				endDateVal.setTime(row[0].endDate * 1000);
				let finalDate = await formatTimeString(endDateVal);

				bot.createMessage(c.id, i18n.__("✅ You will lose the role: **{{rowTempRole}}** on: `{{finalDate}}`! The role was added on: `{{startDateTime}}`", {
					rowTempRole: row[0].temporaryRole,
					finalDate: finalDate,
					startDateTime: startDateTime
				})).catch((err) => { console.log(err) });

			})
			.catch(err => {
				console.error(GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 8:" + `(${err})`);
				return;
			});
		return;
	}
	// ######################### MAP ###################################
	if (command === "map") {
		if (config.mapMain.enabled === "yes") {
			bot.createMessage(c.id, i18n.__("Our official webmap: {{configMapUrl}}", {
				configMapUrl: config.mapMain.url
			})).catch((err) => { console.error(GetTimestamp() + err); });
		}
	}
});

// Check for bot events other than messages
bot.on('guildMemberRemove', async member => {

	let c = message.channel;

	// Used to note database entries when users leave the server.
	let guild = member.guild.id;
	if (guild != config.serverID) {
		return;
	}
	// Check if the user had any temp roles
	await query(`SELECT * FROM temporary_roles WHERE userID="${member.id}"`)
		.then(async rows => {
			// Update all entries from the database
			if (rows[0]) {
				await query(`UPDATE temporary_roles SET leftServer = 1 WHERE userID="${member.id}"`)
					.then(async result => {
						let name = member.user.username.replace(/[^a-zA-Z0-9]/g, '');
						console.log(GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{name}} ({{memberID}}) has left the server. All role assignments have been marked in the database.", {
							name: name,
							memberID: member.id
						}));
						bot.createMessage(c.id, i18n.__(":exclamation: {{name}} has left the server.", {
							name: name
						}));
					})
					.catch(err => {
						console.error(GetTimestamp() + i18n.__("[InitDB] Failed to execute role check query") + " 2:" + `(${err})`);
						return;
					});
			}
			if (rows[0]) {
				await query(`DELETE FROM temporary_roles WHERE userID="${member.id}"`)
					.then(async result => {
						let name = member.user.username.replace(/[^a-zA-Z0-9]/g, '');
						console.log(GetTimestamp() + i18n.__("[ADMIN] [TEMPORARY-ROLE] {{name}} ({{memberID}}) got removed from the database.", {
							name: name,
							memberID: member.id
						}));
						bot.createMessage(c.id, i18n.__(":exclamation: {{name}} all access removed from database.",{
							name: name
						}));
					})
					.catch(err => {
						console.error(GetTimestamp() + i18n.__("[InitDB] Failed to execute query in guildMemberRemove") + "2:" + `(${err})`);
						return;
					});
			}
		})
		.catch(err => {
			console.error(GetTimestamp() + i18n.__("[InitDB] Failed to execute query in guildMemberRemove") + "1:" + `(${err})`);
			return;
		});
});

	function GetTimestamp() {
		let now = new Date();

		return "[" + now.toLocaleString() + "]";
	}

	function RestartBot(type) {
		if (type == 'manual') { process.exit(1); }
		else {
			console.error(GetTimestamp() + "Unexpected error, bot stopping.");
			process.exit(1);
		}
		return;
	}


	function SQLConnect() {
		return new Promise(function (resolve, reject) {
			sqlConnection = mysql.createConnection({
				host: config.mysql_database.mysql_host,
				database: config.mysql_database.mysql_db,
				user: config.mysql_database.mysql_user,
				port: config.mysql_database.mysql_port,
				password: config.mysql_database.mysql_pass,
				supportBigNumbers: true
			});
			sqlConnection.connect(function (err) {
				if (err) {
					return reject;
				}
				console.log(GetTimestamp() + "SQL connection etablished!");
				resolve(true);
			});
		});
	}

	async function InitDB() {
		// Create MySQL tabels
		let currVersion = 5;
		let dbVersion = 0;
		await query(`CREATE TABLE IF NOT EXISTS metadata (
                        \`key\` VARCHAR(50) PRIMARY KEY NOT NULL,
                        \`value\` VARCHAR(50) DEFAULT NULL);`)
			.then(async x => {
				await query(`SELECT \`value\` FROM metadata WHERE \`key\` = "DB_VERSION" LIMIT 1;`)
					.then(async result => {
						//Save the DB version if one is returned
						if (result.length > 0) {
							dbVersion = parseInt(result[0].value);
						}
						console.log(GetTimestamp() + `[InitDB] DB version: ${dbVersion}, Latest: ${currVersion}`);
						if (dbVersion < currVersion) {
							for (dbVersion; dbVersion < currVersion; dbVersion++) {
								if (dbVersion == 0) {
									// Setup the temp roles table
									console.log(GetTimestamp() + '[InitDB] Creating the initial tables');
									await query(`CREATE TABLE IF NOT EXISTS temporary_roles (
                                        userID bigint(19) unsigned NOT NULL,
                                        temporaryRole varchar(35) NOT NULL,
                                        startDate int(11) unsigned NOT NULL,
                                        endDate int(11) unsigned NOT NULL,
                                        addedBy bigint(19) unsigned NOT NULL,
                                        notified tinyint(1) unsigned DEFAULT 0)`)
										.catch(err => {
											console.error(GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}b: (${err})`);
											process.exit(-1);
										});

									// Migrate the old sqlite entries into the table
									sql.all(`SELECT * FROM temporary_roles`, (err, rows) => {
										if (err) {
											console.error(GetTimestamp() + err.message);
										}
										else if (rows) {
											for (rowNumber = 0; rowNumber < rows.length; rowNumber++) {
												let values = rows[rowNumber].userID + ',\''
													+ rows[rowNumber].temporaryRole + '\','
													+ Math.round(rows[rowNumber].startDate / 1000) + ','
													+ Math.round(rows[rowNumber].endDate / 1000) + ','
													+ rows[rowNumber].addedBy + ','
													+ rows[rowNumber].notified;
												query(`INSERT INTO temporary_roles VALUES(${values});`)
													.catch(err => {
														console.error(GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}c: (${err})`);
														process.exit(-1);
													});
											}
										}
									});
									await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
										.catch(err => {
											console.error(GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
											process.exit(-1);
										});
									console.log(GetTimestamp() + '[InitDB] Migration #1 complete.');
								}
								else if (dbVersion == 1) {
									// Wait 30 seconds and let user know we are about to migrate the database and for them to make a backup until we handle backups and rollbacks.
									console.log(GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
									await wait(30 * 1000);
									await query(`ALTER TABLE temporary_roles
                                            ADD COLUMN username varchar(35) DEFAULT NULL;`)
										.catch(err => {
											console.error(GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}b: (${err})`);
											process.exit(-1);
										});
									await query(`ALTER TABLE \`temporary_roles\` COLLATE='utf8mb4_general_ci', CONVERT TO CHARSET utf8mb4;`)
										.catch(err => {
											console.error(GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}c: (${err})`);
											process.exit(-1);
										});
									await query(`ALTER TABLE \`metadata\` COLLATE='utf8mb4_general_ci', CONVERT TO CHARSET utf8mb4;`)
										.catch(err => {
											console.error(GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}d: (${err})`);
											process.exit(-1);
										});
									await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
										.catch(err => {
											console.error(GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
											process.exit(-1);
										});
									console.log(GetTimestamp() + '[InitDB] Migration #2 complete.');
								}
								else if (dbVersion == 2) {
									// Wait 30 seconds and let user know we are about to migrate the database and for them to make a backup until we handle backups and rollbacks.
									console.log(GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
									await wait(30 * 1000);
									
									await query(`ALTER TABLE \`temporary_roles\` ADD PRIMARY KEY (\`userID\`, \`temporaryRole\`);`)
										.catch(err => {
											console.error(GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}c: (${err})`);
											process.exit(-1);
										});
									await query(`ALTER TABLE \`metadata\` COLLATE='utf8mb4_general_ci', CONVERT TO CHARSET utf8mb4;`)
										.catch(err => {
											console.error(GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}d: (${err})`);
											process.exit(-1);
										});
									await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
										.catch(err => {
											console.error(GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
											process.exit(-1);
										});
									console.log(GetTimestamp() + '[InitDB] Migration #3 complete.');
								}
								else if (dbVersion == 3) {
									// Wait 30 seconds and let user know we are about to migrate the database and for them to make a backup until we handle backups and rollbacks.
									console.log(GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
									await wait(30 * 1000);
									await query(`ALTER TABLE \`temporary_roles\` ADD COLUMN leftServer tinyint(1) unsigned DEFAULT 0;`)
										.catch(err => {
											console.error(GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}b: (${err})`);
											process.exit(-1);
										});
									await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
										.catch(err => {
											console.error(GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
											process.exit(-1);
										});
									console.log(GetTimestamp() + '[InitDB] Migration #4 complete.');
								}
								else if (dbVersion == 4) {
									// Wait 30 seconds and let user know we are about to migrate the database and for them to make a backup until we handle backups and rollbacks.
									console.log(GetTimestamp() + '[InitDB] MIGRATION IS ABOUT TO START IN 30 SECONDS, PLEASE MAKE SURE YOU HAVE A BACKUP!!!');
									await wait(30 * 1000);
									
									await query(`INSERT INTO metadata (\`key\`, \`value\`) VALUES("DB_VERSION", ${dbVersion + 1}) ON DUPLICATE KEY UPDATE \`value\` = ${dbVersion + 1};`)
										.catch(err => {
											console.error(GetTimestamp() + `[InitDB] Failed to execute migration query ${dbVersion}a: (${err})`);
											process.exit(-1);
										});
									console.log(GetTimestamp() + '[InitDB] Migration #5 complete.');
								}
							}
							console.log(GetTimestamp() + '[InitDB] Migration process done.');
						}
					})
					.catch(err => {
						console.error(GetTimestamp() + `[InitDB] Failed to get version info: (${err})`);
						process.exit(-1);
					});
			})
			.catch(err => {
				console.error(GetTimestamp() + `[InitDB] Failed to create metadata table: (${err})`);
				process.exit(-1);
			});
	}

	async function query(sql, args) {
		return new Promise((resolve, reject) => {
			sqlConnection.query(sql, args, (error, results, fields) => {
				if (error) {
					if (error.code === "PROTOCOL_CONNECTION_LOST" || error.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR") {
						console.log(GetTimestamp() + "Reconnecting to DB server...");
						SQLConnect().then(result => query(sql, args));
					}
					else {
						return reject(error);
					}
				}
				return resolve(results);
			});
		});
	}

	async function formatTimeString(date) {
		return new Promise((resolve) => {
			let year = date.getFullYear();
			let month = date.getMonth() + 1;
			let day = date.getDate();
			let hour = date.getHours();
			let minute = date.getMinutes();
			let second = date.getSeconds();

			if (month < 10) { month = "0" + month.toString(); }
			if (day < 10) { day = "0" + day.toString(); }
			if (hour < 10) { hour = "0" + hour.toString(); }
			if (minute < 10) { minute = "0" + minute.toString(); }
			if (second < 10) { second = "0" + second.toString(); }

			let results = year + "-" + month + "-" + day + " @" + hour + ":" + minute + ":" + second;
			return resolve(results);
		});
	}

	if (!config.debug == "yes") {
		bot.on('error', function (err) {
			if (typeof err == 'object') {
				console.error(GetTimestamp() + 'Uncaught error: ' + err);
			}
			RestartBot();
			return;
		});

		process.on('unhandledRejection', (reason, p) => {
			console.error(GetTimestamp() + 'Unhandled Rejection at Promise: ', p);
		});

		process.on('uncaughtException', err => {
			if (err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "ECONNRESET") {
				console.log(GetTimestamp() + "Lost connection to the DB server. Waiting for activity before reconnecting...");
				return;
			}
			else {
				console.error(GetTimestamp() + 'Uncaught Exception thrown');
				console.error(GetTimestamp() + err);
				process.exit(1);
			}
		});

		bot.on('disconnect', (error) => {
			console.log("Disconnected from Discord. %s ", error);
			bot.connect();
		});
	}
