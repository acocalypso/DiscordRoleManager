const Eris = require('eris');
const config = require('./config/config.json');
const sql = require('sqlite3');
var db = new sql.Database('./dataBase.sqlite');
var mysql = require('mysql');

// Load locale
const language = config.language;
const lang = require('./locale/' + language + '.json');



var bot = new Eris(config.token, {
    disableEveryone: true,
    getAllUsers: true,
    partials: ['MESSAGE', 'CHANNEL', 'REACTION', 'GUILD_MEMBER', 'USER']
});

bot.on('ready', () => {

    console.log('Ready!');
    CreateDB();
});


bot.connect();

// ############################# SERVER LISTENER ############################

setInterval(function () {
	let timeNow = new Date().getTime();
	let dbTime = "";
	let daysLeft = "";
	let notify = "";
	let stringValue = "";

	db.all(`SELECT * FROM temporary_roles`, function (err, rows) {
		if (!rows) {
			console.log(GetTimestamp() + "No one is in the DataBase");
		}
		else {
			for (rowNumber = "0"; rowNumber < rows.length; rowNumber++) {
				dbTime = rows[rowNumber].endDate;
				notify = rows[rowNumber].notified;
				daysLeft = (dbTime * 1) - (timeNow * 1);

				let rName = bot.guilds.get(config.serverID).roles.find(rName => rName.name === rows[rowNumber].temporaryRole);
				const tempRole = rows[rowNumber].temporaryRole;
				member = bot.guilds.get(config.serverID).members.get(rows[rowNumber].userID);

				// CHECK IF THEIR ACCESS HAS EXPIRED
				if (typeof member !== 'undefined') {
					if (daysLeft < 1) {
						if (!member) {
							member.user.username = "<@" + rows[rowNumber].userID + ">"; member.id = "";
						}

						// REMOVE ROLE FROM MEMBER IN GUILD
						member.removeRole(rName.id).catch(console.error);
						stringValue = lang.lost_role;
						const has_lost = stringValue.replace(/\$role\$/gi, tempRole);
						bot.createMessage(config.mainChannelID, "⚠ " + member.user.username + " " + has_lost).catch(console.error);

						// REMOVE DATABASE ENTRY
						db.get(`DELETE FROM temporary_roles WHERE userID="${rows[rowNumber].userID}"`), function (err) {
							if (err) {
								console.log(err.message);
							}
						}
						stringValue = lang.dm_lost_role;
						const dm_lost_role_1 = stringValue.replace(/\$memberUsername\$/gi, member.user.username);
						const dm_lost_role_2 = dm_lost_role_1.replace(/\$rName\$/gi, rName.name);
						const dm_lost_role_3 = dm_lost_role_2.replace(/\$guildServer\$/gi, bot.guilds.get(config.serverID).name);
						bot.getDMChannel(member.user.id).then(dm => dm.createMessage(dm_lost_role_3).catch((err) => { console.log(err) })).catch((err) => { console.log(err) });

						console.log(GetTimestamp() + "[ADMIN] [TEMPORARY-ROLE] \"" + member.user.username + "\" (" + member.id + ") have lost their role: " + rName.name + "... time EXPIRED");
					}
				
					// CHECK IF THEIR ONLY HAVE 5 DAYS LEFT
					if (daysLeft < 432000000 && notify == "0") {
						if (!member) {
							member.user.username = "<@" + rows[rowNumber].userID + ">"; member.id = "";
						}

						// NOTIFY THE USER IN DM THAT THEY WILL EXPIRE

						stringValue = lang.dm_expire;
						const memberUsername = member.user.username;
						const dm_expire_1 = stringValue.replace(/\$memberUsername\$/gi, memberUsername);
						const dm_expire_2 = dm_expire_1.replace(/\$rName\$/gi, rName.name);
						const dm_expire_final = dm_expire_2.replace(/\$guildServer\$/gi, bot.guilds.get(config.serverID).name);
						bot.getDMChannel(member.user.id).then(dm => dm.createMessage(dm_expire_final).catch((err) => { console.log(err) })).catch((err) => { console.log(err) });

						// NOTIFY THE ADMINS OF THE PENDING EXPIRY
						bot.createMessage(config.mainChannelID, "⚠ " + member.user.username + " will lose their role of: ***" + rName.name + "*** in less than 5 days").catch((err) => { console.log(err) });

						// UPDATE THE DB TO REMEMBER THAT THEY WERE NOTIFIED
						db.get(`UPDATE temporary_roles SET notified=1 WHERE userID="${rows[rowNumber].userID}"`);

						console.log(GetTimestamp() + "[ADMIN] [TEMPORARY-ROLE] \"" + member.user.username + "\" (" + member.id + ") has been notified that they will lose their role in less than 5 days");
					}
				}
			}
		}
	});
	//console.log(GetTimestamp()+"[ADMIN] Stored accounts checked for expiry and nofication.");
}, 60000);
// 86400000 = 1day
// 3600000 = 1hr
// 60000 = 1min

// ############################# SERVER LISTENER END ############################

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
		console.info("[ERROR] [CONFIG] I could not find admin role: " + config.adminRoleName);
	}
	let ModR = g.roles.find(role => role.name === config.modRoleName);
	if (!ModR) {
		ModR = { "id": "111111111111111111" };
		console.info("[ERROR] [CONFIG] I could not find mod role: " + config.modRoleName);
	}

	// ############################################################################
	// ################################ COMMANDS ##################################
	// ############################################################################


	// ######################### COMMANDS/HELP ###########################
	if (command === "commands" || command === "help") {
		if (args[0] === "mods") {
			if (g.members.filter(m => m.roles.includes(ModR.id)) || g.members.filter(m => m.roles.includes(AdminR.id))) {
				cmds = "`" + config.cmdPrefix + "temprole @mention <DAYS> <ROLE-NAME>`   \\\u00BB   to assign a temporary roles\n"
					+ "`" + config.cmdPrefix + "temprole check @mention`   \\\u00BB   to check the time left on a temporary role assignment\n"
					+ "`" + config.cmdPrefix + "temprole remove @mention`   \\\u00BB   to remove a temporary role assignment\n"
					+ "`" + config.cmdPrefix + "temprole add @mention <DAYS>`   \\\u00BB   to add more time to a temporary role assignment\n";
				bot.createMessage(c.id, cmds).catch((err) => { console.log(err) });
			}
			else {
				bot.createMessage(c.id, "you are **NOT** allowed to use this command! \ntry using: `" + config.cmdPrefix + "commads`").catch((err) => { console.log(err) });
			}
		}
		if (!args[0]) {
			cmds = "`" + config.cmdPrefix + "check`   \\\u00BB   to check the time left on your subscription\n";
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

			if (g.members.filter(m => m.roles.includes(ModR.id)) || g.members.filter(m => m.roles.includes(AdminR.id)) || m.id === config.ownerID) {
				if (!args[0]) {
					bot.createMessage(c.id, "syntax:\n `" + config.cmdPrefix + "telegram @mention <DAYS> <ROLE-NAME>`,\n or `" + config.cmdPrefix + "telegram check @mention`").catch((err) => { console.log(err) });
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
						/*
						if (args[1] && !mentioned) {
							bot.createMessage(c.id, "please add a person you want me to add time to...").catch((err) => { console.log(err) });
						}*/
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
							return
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
				message.delete();
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

		if (g.members.filter(m => m.roles.includes(ModR.id)) || g.members.filter(m => m.roles.includes(AdminR.id)) || m.id === config.ownerID) {
			if (!args[0]) {
				bot.createMessage(c.id, "syntax:\n `" + config.cmdPrefix + "temprole @mention <DAYS> <ROLE-NAME>`,\n or `" + config.cmdPrefix + "temprole remove @mention`\n or `" + config.cmdPrefix + "temprole check @mention`").catch((err) => { console.log(err) });
			}
			if (args[0] && !mentioned) {
				bot.createMessage(c.id, "please `@mention` a person you want me to give/remove `" + config.cmdPrefix + "temprole` to...").catch((err) => { console.log(err) });
			}
			if (!args[1] && mentioned) {
				bot.createMessage(c.id, "incomplete data, please try: \n `" + config.cmdPrefix + "temprole @mention <DAYS> <ROLE-NAME>`,\n or `" + config.cmdPrefix + "temprole remove @mention`\n or `" + config.cmdPrefix + "temprole check @mention`").catch((err) => { console.log(err) });
			}
			else {
				let dateMultiplier = 86400000;

				// CHECK DATABASE FOR ROLES
				if (args[0] === "check") {
					db.get(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}";`, function (err, row) {
						if (err) {
							console.log(err.message);
						}
						else {
							if (!row) {
								bot.createMessage(c.id, "⚠ [ERROR] " + mentioned.username + " is __NOT__ in the `DataBase`").catch((err) => { console.log(err) });
							}
							else {
								let startDateVal = new Date();
								startDateVal.setTime(row.startDate);
								startDateVal = startDateVal.getDate() + "." + (startDateVal.getMonth() + 1) + "." + startDateVal.getFullYear();

								let endDateVal = new Date();
								endDateVal.setTime(row.endDate);

								finalDate = endDateVal.getDate() + "." + (endDateVal.getMonth() + 1) + "." + endDateVal.getFullYear();
								bot.createMessage(c.id, "✅ " + mentioned.username + " will lose the role: **" + row.temporaryRole + "** on: `" + finalDate + "`! They were added on: `" + startDateVal + "`").catch((err) => { console.log(err) });
							}
						}
					});
				}

				// REMOVE MEMBER FROM DATABASE
				if (args[0] === "remove") {
					//mentioned = message.mentions.members.first();
					db.get(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}";`, function (err, row) {
						if (err) {
							console.log(err.message);
						}
						else {
							if (!row) {
								bot.createMessage(c.id, "⚠ [ERROR] " + mentioned.username + " is __NOT__ in the `DataBase`").catch((err) => { console.log(err) });
							}
							else {

								let theirRole = g.roles.find(theirRole => theirRole.name === row.temporaryRole);
								bot.guilds.get(config.serverID).removeMemberRole(mentioned.id, theirRole.id, 'Donation Expired').catch((err) => { console.log(err) });
								db.get(`DELETE FROM temporary_roles WHERE userID="${mentioned.id}";`), function (err) {
									if (err) {
										console.log(err.message);
									}
								}
								console.log(mentioned.username + " was removed from DB");
								bot.createMessage(c.id, "⚠ " + mentioned.username + " has **lost** their role of: **" + theirRole.name + "** and has been removed from the `DataBase`").catch((err) => { console.log(err) });
							}
						}
					});
				}

				// ADD TIME TO A USER
				if (args[0] === "add") {
					if (!parseInt(args[2])) {
						bot.createMessage(c.id, "Error: second value has to be **X** number of days, IE:\n`!" + command + " @" + mentioned.username + " 90 " + daRoles + "`").catch((err) => { console.log(err) });
					}

					if (args[1] && !mentioned) {
						bot.createMessage(c.id, "please `@mention` a person you want me to add time to...").catch((err) => { console.log(err) });
					}
					if (!args[2]) {
						bot.createMessage(c.id, "for how **many** days do you want " + mentioned.username + " to have to have this role?").catch((err) => { console.log(err) });
					}
					else {
						db.get(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}";`, function (err, row) {
							if (err) {
								console.log(err.message);
							}
							else {
								if (!row) {
									bot.createMessage(c.id, "⚠ [ERROR] " + mentioned.username + " is __NOT__ in the `DataBase`").catch((err) => { console.log(err) });
								}
								let startDateVal = new Date();
								startDateVal.setTime(row.startDate);
								startDateVal = startDateVal.getDate() + "." + (startDateVal.getMonth() + 1) + "." + startDateVal.getFullYear();

								let endDateVal = new Date();
								let finalDate = (parseInt(row.endDate) + parseInt((args[2]) * (dateMultiplier)));
								let dmFinalDate = (parseInt(row.endDate) + parseInt((args[2]) * (dateMultiplier)));

								console.log("Mentioned User: %s", mentioned.username);
								endDateVal.setTime(dmFinalDate);
								dmFinalDate = endDateVal.getDate() + "." + (endDateVal.getMonth() + 1) + "." + endDateVal.getFullYear();

								const stringValue = lang.dm_access_extended;
								const dm_access_extend_1 = stringValue.replace(/\$memberUsername\$/gi, mentioned.username);
								const dm_access_extend_2 = dm_access_extend_1.replace(/\$dmFinalDate\$/gi, dmFinalDate);

								bot.getDMChannel(mentioned.id).then(dm => dm.createMessage(dm_access_extend_2).catch(error => {
									console.error(GetTimestamp() + "Failed to send a DM to user: " + mentioned.id);
								})).catch((err) => { console.log(err) });

								db.get(`UPDATE temporary_roles SET endDate="${finalDate}", notified=0 WHERE userID="${mentioned.id}";`, function (err) {
									if (err) {
										console.log(err.message);
									}
									else {
										endDateVal.setTime(finalDate);
										finalDate = endDateVal.getDate() + "." + (endDateVal.getMonth() + 1) + "." + endDateVal.getFullYear();
										bot.createMessage(c.id, "✅ " + mentioned.username + " has had time added until: `" + finalDate + "`! They were added on: `" + startDateVal + "`").catch((err) => { console.log(err) });
									}
								});
							}
						});
					}
				}
				if (/<@!?(\d+)>/.test(args[0])) {

					let daRoles = args[2]
					if (!parseInt(args[1])) {
						bot.createMessage(c.id, "Error: second value has to be **X** number of days, IE:\n`!" + command + " @" + mentioned.username + " 90 " + daRoles + "`").catch((err) => { console.log(err) });
						return
					}
					// CHECK ROLE EXIST
					let rName = g.roles.find(rName => rName.name === daRoles);
					if (typeof rName !== "undefined") {

						// ADD MEMBER TO DATASE, AND ADD THE ROLE TO MEMBER
						db.get(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}";`, function (err, row) {
							if (err) {
								console.log(err.message);
							}
							else {
								//mentioned = message.mentions.members.first();
								if (!row) {
									let curDate = new Date().getTime();
									let finalDateDisplay = new Date();
									let finalDate = ((args[1]) * (dateMultiplier));
									finalDate = ((curDate) + (finalDate));
									finalDateDisplay.setTime(finalDate);
									finalDateDisplay = finalDateDisplay.getDate() + "." + (finalDateDisplay.getMonth() + 1) + "." + finalDateDisplay.getFullYear();

									db.run("INSERT INTO temporary_roles (userID, temporaryRole, startDate, endDate, addedBy, notified) VALUES (?, ?, ?, ?, ?, 0)",
										[mentioned.id, daRoles, curDate, finalDate, m.id]);
									let theirRole = g.roles.find(role => role.name === daRoles);
									bot.guilds.get(config.serverID).addMemberRole(mentioned.id, theirRole.id, 'Donater').catch((err) => { console.log(err) });
									console.log(GetTimestamp() + "[ADMIN] [TEMPORARY-ROLE] \"" + mentioned.username + "\" (" + mentioned.id + ") was given role: " + daRoles + " by: " + m.user.username + " (" + m.id + ")");
									bot.createMessage(c.id, "🎉 " + mentioned.username + " has been given a **temporary** role of: **" + daRoles + "**, enjoy! They will lose this role on: `" + finalDateDisplay + "`").catch((err) => { console.log(err) });

									const stringValue = lang.dm_access_granted;
									const dm_granted_1 = stringValue.replace(/\$memberUsername\$/gi, mentioned.username);
									const dm_granted_2 = dm_granted_1.replace(/\$finalDateDisplay\$/gi, finalDateDisplay);
									const dm_granted_3 = dm_granted_2.replace(/\$map\$/gi, config.mapMain.url);
									bot.getDMChannel(mentioned.id).then(dm => dm.createMessage(dm_granted_3).catch(error => {
										console.error(GetTimestamp() + "Failed to send a DM to user: " + mentioned.id);
									})).catch((err) => { console.log(err) });
								}
								else {
									bot.createMessage(c.id, "this user already has a **temporary** role... try using `" + config.cmdPrefix + "temprole remove @" + mentioned.username + "` if you want to **change** their role.").catch((err) => { console.log(err) });
								}
							}
						});
					}
					else {
						bot.createMessage(c.id, "I couldn't find such role, please check the spelling and try again.").catch((err) => { console.log(err) });
					}

				}
			}
		}
		else {
			message.delete();
			bot.createMessage(c.id, "you are **NOT** allowed to use this command!").catch((err) => { console.log(err) });
		}
	}


	// ############################## CHECK ##############################
	if (command === "check") {

		let dateMultiplier = 86400000;

		// CHECK DATABASE FOR ROLES
		db.get(`SELECT * FROM temporary_roles WHERE userID="${message.author.id}"`, function (err, row) {
			if (err) {
				console.log(err.message);
			}
			else {
				if (!row) {
					bot.createMessage(c.id, "⚠ [ERROR] **" + message.author.username + "** is __NOT__ in my `DataBase`").catch((err) => { console.log(err) });
				}
				else {
					let startDateVal = new Date();
					startDateVal.setTime(row.startDate);
					startDateVal = startDateVal.getDate() + "." + (startDateVal.getMonth() + 1) + "." + startDateVal.getFullYear();

					let endDateVal = new Date();
					endDateVal.setTime(row.endDate);

					finalDate = endDateVal.getDate() + "." + (endDateVal.getMonth() + 1) + "." + endDateVal.getFullYear();
					bot.createMessage(c.id, "✅ You will lose the role: **" + row.temporaryRole + "** on: `" + finalDate + "`! The role was added on: `" + startDateVal + "`").catch((err) => { console.log(err) });
				}
			}
		});
	}
	// ######################### MAP ###################################
	if (command === "map") {
		if (config.mapMain.enabled === "yes") {
			bot.createMessage(c.id, "Our official webmap: \n<" + config.mapMain.url + ">").catch((err) => { console.log(err) });
		}
	}
    
},
    function (error, response) {
        console.log(error);
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

function CreateDB() {
	// CREATE DATABASE TABLE 
	db.run('CREATE TABLE IF NOT EXISTS temporary_roles (userID TEXT, temporaryRole TEXT, startDate TEXT, endDate TEXT, addedBy TEXT, notified TEXT);', function (err) {
		if (err) {
			console.log(err.message);
		}
		console.log("Table created");
	});
}

function timeConverter(UNIX_timestamp) {
	var a = new Date(UNIX_timestamp * 1000);
	var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	var year = a.getFullYear();
	var month = months[a.getMonth()];
	var date = a.getDate();
	var hour = a.getHours();
	var min = a.getMinutes();
	var sec = a.getSeconds();
	var time = date + ' ' + month + ' ' + year + ' ' + hour + ':' + min + ':' + sec;
	return time;
}

if (!config.debug == "yes") {
	bot.on('error', function (err) {
		if (typeof err == 'object') {
			console.error(GetTimestamp() + 'Uncaught error: ' + err);
		}
		RestartBot();
		return;
	});

	process.on('uncaughtException', function (err) {
		if (typeof err == 'object') {
			console.error(GetTimestamp() + 'Uncaught exception: ' + err);
		}
		RestartBot();
		return;
	});

	process.on('unhandledRejection', function (err) {
		if (typeof err == 'object') {
			console.error(GetTimestamp() + 'Uncaught Rejection: ' + err);
		}
		RestartBot();
		return;
	});

	bot.on('disconnect', (error) => {
		console.log("Disconnected from Discord. %s ", error);
		bot.connect();
	});
}
