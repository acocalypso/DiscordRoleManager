const config = require('./../config/config.json');
const dateMultiplier = 86400000;
const database = require('./database/database_telegram');
const helper = require('./helper');

var i18nconfig = {
	"lang": config.language,
	"langFile": "./../../locale/locale.json"
}
//init internationalization / localization class
var i18n_module = require('i18n-nodejs');
var i18n = new i18n_module(i18nconfig.lang, i18nconfig.langFile);

async function telegram(message,command,args,bot) {

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

exports.telegram = telegram;