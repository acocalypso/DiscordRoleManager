const { MessageEmbed } = require('discord.js');
// init internationalization / localization class
const i18n_module = require('i18n-nodejs');
const config = require('../config/config.json');

const dateMultiplier = 86400000;
const sqlConnectionDiscord = require('./database/database_discord');
const helper = require('./helper');

const wait = async (ms) => new Promise((done) => setTimeout(done, ms));

const i18nconfig = {
  lang: config.language,
  langFile: './../../locale/locale.json',
};
const i18n = new i18n_module(i18nconfig.lang, i18nconfig.langFile);

let adminRoleName = '';
let modRoleName = '';
const defaultDonatorRole = config.specialmode.defaultDonatorRole;

async function temprole(message, command, args) {
  /// GET CHANNEL INFO
  const g = message.guild;
  const c = message.channel;
  const m = message.member;
  const msg = message.content;

  await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id="${g.id}" AND mainChannelID="${c.id}"`)
    .then(async (rows) => {
      // Update all entries from the database
      if (rows[0]) {
        adminRoleName = rows[0].adminRoleName;
        modRoleName = rows[0].modRoleName;

        // GET TAGGED USER
        let mentioned = '';
        if (message.mentions.users.first()) {
          mentioned = message.mentions.users.first();
        }

        // REMOVE LETTER CASE (MAKE ALL LOWERCASE)
        command = msg.toLowerCase();
        command = command.split(/\s+/)[0];
        command = command.slice(config.cmdPrefix.length);

        // GET ROLES FROM CONFIG
        let AdminR = g.roles.cache.find((role) => role.id === adminRoleName);
        if (!AdminR) {
          AdminR = { id: '111111111111111111' };
        }
        let ModR = g.roles.cache.find((role) => role.id === modRoleName);
        if (!ModR) {
          ModR = { id: '111111111111111111' };
        }

        if (m.roles.cache.has(ModR.id) || m.roles.cache.has(AdminR.id) || m.id === config.ownerID) {
          if (!args[0]) {
            message.reply('syntax:\n `' + config.cmdPrefix + 'temprole @mention <DAYS> @<ROLE-NAME>`,\n or `' + config.cmdPrefix + 'temprole remove @mention @<ROLE-NAME>`\n or `' + config.cmdPrefix + 'temprole check @mention @<ROLE-NAME>`').catch((err) => { helper.myLogger.error(err); });
          } else if (!mentioned) {
            message.reply('please `@mention` a person you want me to give/remove `' + config.cmdPrefix + 'temprole` to...').catch((err) => { helper.myLogger.error(err); });
          } /* else if (!args[2]) {
            message.reply('incomplete data, please try: \n `' + config.cmdPrefix + 'temprole @mention <DAYS> <@ROLE-NAME>`,\n or `' + config.cmdPrefix + 'temprole remove @mention @<ROLE-NAME>`\n or `' + config.cmdPrefix + 'temprole check @mention @<ROLE-NAME>`').catch((err) => { helper.myLogger.error(err); });
          } */
          else {
            let days = 0;
            if (args[0] === 'add') {
              days = args[2];
            } else {
              days = args[1];
            }
            let messageRoleID;
            let daRole;

            if (message.mentions.roles.first()) {
              messageRoleID = message.mentions.roles.first().id;
              daRole = message.member.guild.roles.cache.get(messageRoleID);
            } else {
              messageRoleID = defaultDonatorRole;
              daRole = message.member.guild.roles.cache.get(messageRoleID);
            }
            /* if (config.specialmode.enabled === 'no') {
              if (messageRoleID && typeof messageRoleID !== 'undefined' && messageRoleID !== 'null') {
                roleID = message.mentions.roles.first().id;
                daRole = message.member.guild.roles.cache.get(roleID);
              }
            } else {
              c.send('Please mention a role').catch((err) => { helper.myLogger.error(helper.GetTimestamp() + err); });
            } */
            // CHECK DATABASE FOR ROLES
            if (args[0] === 'check') {
              await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}"`)
                .then(async (row) => {
                  if (!row[0]) {
                    c.send(i18n.__('⚠ [ERROR] {{mentionedUsername}} is __NOT__ in the `DataBase` for the role {{daRole}}', {
                      mentionedUsername: mentioned.username,
                      daRole: daRole.name,
                    })).catch((err) => { helper.myLogger.error(err); });
                    return;
                  }
                  const startDateVal = new Date();
                  startDateVal.setTime(row[0].startDate * 1000);
                  const startDateTime = await helper.formatTimeString(startDateVal);
                  const endDateVal = new Date();
                  endDateVal.setTime(row[0].endDate * 1000);
                  const finalDate = await helper.formatTimeString(endDateVal);

                  c.send(i18n.__('✅ {{mentionedUsername}} will lose the role: **{{rowTempRole}}** on: `{{finalDate}}`! They were added on: `{{startDateTime}}`', {
                    mentionedUsername: mentioned.username,
                    rowTempRole: row[0].temporaryRole,
                    finalDate,
                    startDateTime,
                  })).catch((err) => { helper.myLogger.error(err); });
                }).catch((err) => {
                  helper.myLogger.error(helper.GetTimestamp() + i18n.__('[InitDB] Failed to execute role check query') + ' 9:' + err);
                });
              return;
              // eslint-disable-next-line brace-style
            }

            // REMOVE MEMBER FROM DATABASE
            else if (args[0] === 'remove') {
              mentioned = message.mentions.members.first();
              await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}" AND temporaryRole="${daRole.name}"`)
                .then(async (row) => {
                  if (!row[0]) {
                    c.send(i18n.__('⚠ [ERROR] {{mentionedUsername}} is __NOT__ in the `DataBase` for the role {{daRole}}', {
                      mentionedUsername: mentioned.user.username,
                      daRole: daRole.name,
                    })).catch((err) => { helper.myLogger.error(err); });
                    return;
                  }

                  const theirRole = g.roles.cache.find((daRole) => daRole.name.toLowerCase() === row[0].temporaryRole.toLowerCase());
                  mentioned.roles.remove(theirRole, 'Donation Expired').catch((err) => { helper.myLogger.error(err); });

                  await sqlConnectionDiscord.query(`DELETE FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}" AND temporaryRole="${daRole.name}"`)
                    .then(async () => {
                      helper.myLogger.log(helper.GetTimestamp() + i18n.__('[ADMIN] [TEMPORARY-ROLE] {{mUserUsername}} ({{mID}}) removed the access from {{mentionedUsername}} ({{mentionedID}}', {
                        mUserUsername: m.user.username,
                        mID: m.id,
                        mentionedUsername: mentioned.user.username,
                        mentionedID: mentioned.id,
                      }));
                      c.send(i18n.__('⚠ {{mentionedUsername}} has **lost** their role of: **{{theirRoleName}}** and has been removed from the database', {
                        mentionedUsername: mentioned.user.username,
                        theirRoleName: theirRole.name,
                      })).catch((err) => { helper.myLogger.error(err); });
                    })
                    .catch((err) => {
                      helper.myLogger.error(helper.GetTimestamp() + i18n.__('[InitDB] Failed to execute role check query') + ' 11 :' + err);
                    });
                })
                .catch((err) => {
                  helper.myLogger.error(helper.GetTimestamp() + i18n.__('[InitDB] Failed to execute role check query') + ' 10 :' + err);
                });
              return;
            }

            // ADD TIME TO A USER
            else if (args[0] === 'add') {
              if (!Number(args[2])) {
                message.reply(i18n.__('Error: second value has to be **X** number of days, IE:\n `{{configCMDPrefix}}{{command}} add @{{mentionedUsername}} 90 {{daRole}}`', {
                  configCMDPrefix: config.cmdPrefix,
                  command,
                  mentionedUsername: mentioned.username,
                  daRole: daRole.name,
                })).catch((err) => { helper.myLogger.error(err); });
                return;
              }

              if (args[1] && !mentioned) {
                message.reply(i18n.__('please `@mention` a person you want me to add time to...')).catch((err) => { helper.myLogger.error(err); });
                return;
              }
              if (!args[2]) {
                message.reply(i18n.__('for how **many** days do you want {{mentionedUsername}} to have to have this role?', {
                  mentionedUsername: mentioned.username,
                })).catch((err) => { helper.myLogger.error(err); });
                return;
              }
              await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}"`)
                .then(async (row) => {
                  if (!row[0]) {
                    message.reply(i18n.__('⚠ [ERROR] {{mentionedUsername}} is __NOT__ in the database', {
                      mentionedUsername: mentioned.username,
                    })).catch((err) => { helper.myLogger.error(err); });
                    return;
                  }
                  const startDateVal = new Date();
                  startDateVal.setTime(row[0].startDate * 1000);
                  const startDateTime = await helper.formatTimeString(startDateVal);
                  let finalDate = Number(row[0].endDate * 1000) + Number(days * dateMultiplier);

                  const name = mentioned.username.replace(/[^a-zA-Z0-9]/g, '');
                  await sqlConnectionDiscord.query(`UPDATE temporary_roles SET endDate="${Math.round(finalDate / 1000)}", notified=0, username="${name}" WHERE userID="${mentioned.id}" AND temporaryRole="${daRole.name}" AND guild_id="${g.id}"`)
                    .then(async () => {
                      const endDateVal = new Date();
                      endDateVal.setTime(finalDate);
                      finalDate = await helper.formatTimeString(endDateVal);
                      helper.myLogger.log(helper.GetTimestamp() + i18n.__('[ADMIN] [TEMPORARY-ROLE] {{mentionedUsername}} ({{mentionedID}}) was given {{days}} days by: {{mUserUsername}} ({{mID}}) for the role: {{daRole}}', {
                        mentionedUsername: mentioned.username,
                        mentionedID: mentioned.id,
                        days,
                        mUserUsername: m.user.username,
                        mID: m.id,
                        daRole: daRole.name,
                      }));
                      c.send(i18n.__('✅ {{mentionedUsername}} has had time added until: `{{finalDate}}`! They were added on: `{{startDateTime}}`', {
                        mentionedUsername: mentioned.username,
                        finalDate,
                        startDateTime,
                      }));

                      mentioned.send(i18n.__('Hello {{mentionedUsername}}!\n\n🎉Your access has been extended🎉.\nIt is now valid till {{finalDate}}.\n\nThanks for your support', {
                        mentionedUsername: mentioned.username,
                        finalDate,
                      })).catch((error) => {
                        helper.myLogger.error(helper.GetTimestamp() + i18n.__('Failed to send a DM to user: {{mentionedID}} ' + error, {
                          mentionedID: mentioned.id,
                        }));
                      }).catch((err) => { helper.myLogger.error(err); });
                    })
                    .catch((err) => {
                      helper.myLogger.error(helper.GetTimestamp() + i18n.__('[InitDB] Failed to execute role check query') + ' 14: ' + err);
                    });
                })
                .catch((err) => {
                  helper.myLogger.error(helper.GetTimestamp() + i18n.__('[InitDB] Failed to execute role check query') + ' 13: ' + err);
                });
              return;
            } else if (!Number(args[1])) {
              message.reply('Error: second value has to be **X** number of days, IE:\n`!' + command + ' @' + mentioned.username + ' 90 ' + daRole + '`').catch((err) => { console.log(err); });
            }

            // ADD MEMBER TO DATASE, AND ADD THE ROLE TO MEMBER
            await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND temporaryRole="${daRole.name}" AND guild_id="${g.id}"`)
              .then(async (row) => {
                mentioned = message.mentions.members.first();
                if (!row[0]) {
                  const curDate = new Date().getTime();
                  let finalDateDisplay = new Date();
                  const finalDate = curDate + (Number(args[1]) * dateMultiplier);
                  finalDateDisplay.setTime(finalDate);
                  finalDateDisplay = await helper.formatTimeString(finalDateDisplay);
                  const name = mentioned.user.username.replace(/[^a-zA-Z0-9]/g, '');
                  const values = mentioned.user.id + ',\''
                               + daRole.name + '\','
                               + Math.round(curDate / 1000) + ','
                               + Math.round(finalDate / 1000) + ','
                               + m.id
                               + ', 0 ,\''
                               + name + '\', 0 ,'
                               + g.id;
                  await sqlConnectionDiscord.query(`INSERT INTO temporary_roles VALUES(${values});`)
                    .then(async () => {
                      const theirRole = g.roles.cache.find((role) => role.name === daRole.name);
                      mentioned.roles.add(theirRole).catch((err) => { console.error(helper.GetTimestamp() + err); });
                      helper.myLogger.info(helper.GetTimestamp() + i18n.__('[ADMIN] [TEMPORARY-ROLE] {{mentionedUsername}} ({{mentionedID}}) was given the {{daRole}} role by {{mUserUsername}} ({{mID}})', {
                        mentionedUsername: mentioned.user.username,
                        mentionedID: mentioned.id,
                        daRole: daRole.name,
                        mUserUsername: m.user.username,
                        mID: m.id,
                      }));
                      helper.myLogger.info(helper.GetTimestamp() + 'User has been added to DB: %s %s', mentioned.user.username, daRole.name);
                      c.send(i18n.__('🎉 {{mentionedUsername}} has been given a **temporary** role of: **{{daRole}}**, enjoy! They will lose this role on: `{{finalDateDisplay}}`', {
                        mentionedUsername: mentioned.user.username,
                        daRole: daRole.name,
                        finalDateDisplay,
                      }));

                      mentioned.send(i18n.__('Hello {{mentionedUsername}}!\n\nYour access expires at {{finalDateDisplay}}.\n\nThanks for your support.\n\nLiveMap: {{map}}.', {
                        mentionedUsername: mentioned.user.username,
                        finalDateDisplay,
                        map: config.mapMain.url,
                      })).catch((error) => {
                        helper.myLogger.error(helper.GetTimestamp() + i18n.__('Failed to send a DM to user: {{mentionedID}} ' + error, {
                          mentionedID: mentioned.id,
                        }));
                      }).catch((err) => { helper.myLogger.error(err); });
                    })
                    .catch((err) => {
                      helper.myLogger.error(helper.GetTimestamp() + i18n.__('[InitDB] Failed to execute role check query') + ' 16: ' + err);
                    });
                } else {
                  c.send(i18n.__('This user already has the role **{{daRole}}** try using `{{configCMDPrefix}}temprole remove @{{mentionedUsername}} {{daRole}} ` if you want to reset their role.', {
                    daRole,
                    configCMDPrefix: config.cmdPrefix,
                    mentionedUsername: mentioned.user.username,
                  }));
                }
              })
              .catch((err) => {
                helper.myLogger.error(helper.GetTimestamp() + i18n.__('[InitDB] Failed to execute role check query') + ' 16: ' + err);
              });
          } /* else {
              c.send('Please mention a role').catch((err) => { helper.myLogger.error(helper.GetTimestamp() + err); });
            } */
          // }
        } else {
          c.send(i18n.__('you are **NOT** allowed to use this command!')).catch((err) => { helper.myLogger.error(helper.GetTimestamp() + err); });
        }
      }
    });
}

async function help(message, command) {
  /// GET CHANNEL INFO
  const g = message.channel.guild;
  const c = message.channel;
  const m = message.member;
  const msg = message.content;

  await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id="${g.id}" AND mainChannelID="${c.id}"`)
    .then(async (rows) => {
      // Update all entries from the database
      if (rows[0]) {
        adminRoleName = rows[0].adminRoleName;
        modRoleName = rows[0].modRoleName;

        // REMOVE LETTER CASE (MAKE ALL LOWERCASE)
        command = command.split(' ')[0];
        command = command.slice(config.cmdPrefix.length);

        // GET ARGUMENTS
        const args = msg.split(' ').slice(1);

        // GET ROLES FROM CONFIG
        let AdminR = g.roles.cache.find((role) => role.id === adminRoleName);
        if (!AdminR) {
          AdminR = { id: '111111111111111111' };
          helper.myLogger.error(helper.GetTimestamp() + i18n.__('[ERROR] [CONFIG] I could not find admin role: {{configAdminRoleName}}', {
            configAdminRoleName: adminRoleName,
          }));
        }
        let ModR = g.roles.cache.find((role) => role.id === modRoleName);
        if (!ModR) {
          ModR = { id: '111111111111111111' };
          helper.myLogger.error(helper.GetTimestamp() + i18n.__('[ERROR] [CONFIG] I could not find mod role: {{configModRoleName}}', {
            configModRoleName: modRoleName,
          }));
        }

        if (args[0] === 'mods') {
          if (m.roles.cache.has(AdminR.id) || m.roles.cache.has(ModR.id)) {
            const cmds = '`' + config.cmdPrefix + 'temprole @mention <DAYS> <ROLE-NAME>`   \\\u00BB   to assign a temporary roles\n'
                 + '`' + config.cmdPrefix + 'temprole check @mention <ROLE-NAME>`  \\\u00BB   to check the time left on a temporary role assignment\n'
                 + '`' + config.cmdPrefix + 'temprole remove @mention <ROLE-NAME>`   \\\u00BB   to remove a temporary role assignment\n'
                 + '`' + config.cmdPrefix + 'temprole add @mention <DAYS> <ROLE-NAME>`   \\\u00BB   to add more time to a temporary role assignment\n';
            message.reply(cmds).catch((err) => { helper.myLogger.error(err); });
          } else {
            c.send(i18n.__('you are **NOT** allowed to use this command! \ntry using: {{configCMDPrefix}}help', {
              configCMDPrefix: config.cmdPrefix,
            })).catch((err) => { helper.myLogger.error(err); });
            return;
          }
        }
        if (!args[0]) {
          let cmds = '`' + config.cmdPrefix + 'check @<Role-NAME>`   \\\u00BB   to check the time left on your subscription\n';
          if (config.mapMain.enabled === 'yes') {
            cmds += '`' + config.cmdPrefix + 'map`   \\\u00BB   a link to our web map\n';
          }
          if (config.paypal.enabled === 'yes') {
            cmds += '`' + config.cmdPrefix + 'subscribe`/`' + config.cmdPrefix + 'paypal`   \\\u00BB   for a link to our PayPal\n';
          }
          c.send(cmds);
        }
      }
    });
}

async function paypal(message) {
  /// GET CHANNEL INFO
  const c = message.channel;

  const paypal_description = i18n.__('Thank you! \nYour support is greatly appreciated');
  const paypal_title = i18n.__('Click HERE to Subscribe');
  if (config.paypal.enabled === 'yes') {
    const embedMSG = new MessageEmbed()
      .setColor('0xFF0000')
      .setTitle(paypal_title)
      .setURL(config.paypal.url)
      .setThumbnail(config.paypal.img)
      .setDescription(paypal_description);
    c.send({ embeds: [embedMSG] }).catch((err) => { helper.myLogger.error(err); });
  }
}

async function check(message, args) {
  const c = message.channel;
  const g = message.channel.guild;
  const m = message.member;
  const msg = message.content;
  const messageRoleID = message.mentions.roles.first();

  if (messageRoleID && typeof messageRoleID !== 'undefined' && messageRoleID !== 'null') {
    const roleID = message.mentions.roles.first().id;
    const daRole = message.member.guild.roles.cache.get(roleID);

    args = msg.split(' ').slice(1);

    if (!args[0]) {
      c.send(i18n.__('Please enter the role you want to check like `{{configCMDPrefix}}check @<ROLE-NAME>`', {
        configCMDPrefix: config.cmdPrefix,
      }));
      return;
    }

    // CHECK ROLE EXIST
    const rName = g.roles.cache.find((rName) => rName.name === daRole.name);
    if (!rName) {
      c.send(i18n.__("I couldn't find such role, please check the spelling and try again."));
      return;
    }

    // CHECK DATABASE FOR ROLES
    await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${m.id}" AND temporaryRole="${daRole.name}" AND guild_id="${g.id}"`)
      .then(async (row) => {
        if (!row[0]) {
          c.send(i18n.__('⚠ [ERROR] {{mAuthorUsername}} is __NOT__ in the database for the role {{daRole}}.', {
            mAuthorUsername: message.author.username,
            daRole: daRole.name,
          })).catch((err) => { helper.myLogger.error(err); });
          return;
        }

        const startDateVal = new Date();
        startDateVal.setTime(row[0].startDate * 1000);
        const startDateTime = await helper.formatTimeString(startDateVal);
        const endDateVal = new Date();
        endDateVal.setTime(row[0].endDate * 1000);
        const finalDate = await helper.formatTimeString(endDateVal);

        c.send(i18n.__('✅ You will lose the role: **{{rowTempRole}}** on: `{{finalDate}}`! The role was added on: `{{startDateTime}}`', {
          rowTempRole: row[0].temporaryRole,
          finalDate,
          startDateTime,
        })).catch((err) => { helper.myLogger.error(err); });
      })
      .catch((err) => {
        helper.myLogger.error(helper.GetTimestamp() + i18n.__('[InitDB] Failed to execute role check query') + ' 8: ' + err);
      });
  } else {
    c.send('Please mention a role').catch((err) => { helper.myLogger.error(helper.GetTimestamp() + err); });
  }
}

async function map(message) {
  /// GET CHANNEL INFO
  const c = message.channel;

  if (config.mapMain.enabled === 'yes') {
    c.send(i18n.__('Our official webmap: {{configMapUrl}}', {
      configMapUrl: config.mapMain.url,
    })).catch((err) => { helper.myLogger.error(helper.GetTimestamp() + err); });
  }
}

async function leftserver(bot, member, userID, guildID) {
  // Check if the user had any temp roles
  await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id="${guildID}"`)
    .then(async (rows) => {
      // Update all entries from the database
      if (rows[0]) {
        const c = rows[0].mainChannelID;
        // Check if the user had any temp roles
        await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${userID}" AND guild_id="${guildID}"`)
          .then(async (rows) => {
            // Update all entries from the database
            if (rows[0]) {
              await sqlConnectionDiscord.query(`UPDATE temporary_roles SET leftServer = 1 WHERE userID="${userID}" AND guild_id="${guildID}"`)
                .then(async () => {
                  const name = member.user.username.replace(/[^a-zA-Z0-9]/g, '');
                  helper.myLogger.error(helper.GetTimestamp() + i18n.__('[ADMIN] [TEMPORARY-ROLE] {{name}} ({{memberID}}) has left the server. All role assignments have been marked in the database.', {
                    name,
                    memberID: member.id,
                  }));
                  bot.channels.cache.get(c).send(i18n.__(':exclamation: {{name}} has left the server.', {
                    name,
                  }));
                })
                .catch((err) => {
                  helper.myLogger.error(helper.GetTimestamp() + i18n.__('[InitDB] Failed to execute role check query') + ' 2 :' + err);
                });
            }
            if (rows[0]) {
              await sqlConnectionDiscord.query(`DELETE FROM temporary_roles WHERE userID="${userID}" AND guild_id="${guildID}"`)
                .then(async () => {
                  const name = member.user.username.replace(/[^a-zA-Z0-9]/g, '');
                  helper.myLogger.error(helper.GetTimestamp() + i18n.__('[ADMIN] [TEMPORARY-ROLE] {{name}} ({{memberID}}) got removed from the database.', {
                    name,
                    memberID: member.id,
                  }));
                  bot.channels.cache.get(c).send(i18n.__(':exclamation: {{name}} all access removed from database.', {
                    name,
                  }));
                })
                .catch((err) => {
                  helper.myLogger.error(helper.GetTimestamp() + i18n.__('[InitDB] Failed to execute query in guildMemberRemove') + '2: ' + err);
                });
            }
          })
          .catch((err) => {
            helper.myLogger.error(helper.GetTimestamp() + i18n.__('[InitDB] Failed to execute query in guildMemberRemove') + '1: ' + err);
          });
      }
    })
    .catch((err) => {
      helper.myLogger.error(helper.GetTimestamp() + i18n.__('[InitDB] Failed to execute mainChannelID') + ' 2: ' + err);
    });
}

async function guildMemberRemove(bot, member, guildID) {
  // Used to note database entries when users leave the server.
  const guild = guildID;

  // Check if the user had any temp roles
  await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${member.id}" AND guild_id="${guild}"`)
    .then(async (rows) => {
      // Update all entries from the database
      if (rows[0]) {
        await sqlConnectionDiscord.query(`UPDATE temporary_roles SET leftServer = 1 WHERE userID="${member.id}" AND guild_id="${guild}"`)
          .then(async () => {
            let name = 'Unknown';
            name = rows[0].username;
            helper.myLogger.error(helper.GetTimestamp() + '[ADMIN] [TEMPORARY-ROLE] "' + name + '" (' + member.id + ') has left the server. All temp role assignments have been marked in the database.');
            await sqlConnectionDiscord.query(`SELECT mainChannelID from registration WHERE guild_id="${guild}"`)
              .then(async () => {
                bot.channels.cache.get(rows[0].mainChannelID).send(':exclamation: ' + name + ' has left the server. All temp role assignments have been marked in the database.');
              })
              .catch((err) => {
                helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute query in guildMemberRemove 3: (${err})`);
              });
          })
          .catch((err) => {
            helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute query in guildMemberRemove 2: (${err})`);
          });
      }
    })
    .catch((err) => {
      helper.myLogger.error(helper.GetTimestamp() + `[InitDB] Failed to execute query in guildMemberRemove 1: (${err})`);
    });
}

async function getMember(bot, userID, guildID) {
  return new Promise(async (resolve) => {
    let member = {};
    await bot.guilds.cache.get(guildID).members.fetch();
    member = bot.guilds.cache.get(guildID).members.cache.get(userID);
    // Check if we pulled the member's information correctly or if they left the server.
    if (!member) {
      await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id=${guildID};`)
        .then(async (result) => {
          helper.myLogger.error(helper.GetTimestamp() + '[ADMIN] [MEMBER] Failed to get user ID: ' + userID);
          bot.channels.cache.get(result[0].mainChannelID).send(':exclamation: Failed to get user ID: '
          + userID + ' <@' + userID + '> from the cache. Tagging them to force the cache update.')
            .catch((err) => { helper.myLogger.error(helper.GetTimestamp() + err); });
          await bot.guilds.cache.get(guildID).members.fetch();
          await wait(1 * 1000); // 1 second
          member = bot.guilds.cache.get(guildID).members.cache.get(userID);
          // If it still doesn't exist, return an error
          if (!member) {
            helper.myLogger.error(helper.GetTimestamp() + 'Failed to find a user for ID: ' + userID + '. They may have left the server.');
            bot.channels.cache.get(result[0].mainChannelID).send('**:x: Could not find a user for ID: '
            + userID + ' <@' + userID + '>. They may have left the server.**')
              .catch((err) => { helper.myLogger.error(helper.GetTimestamp() + err); });
            member = { guild: { id: guildID }, id: userID };
            await guildMemberRemove(bot, member, guildID);
            return resolve(false);
          }
        });
    }
    return resolve(member);
  });
}

async function register(message, bot, args) {
  const c = message.channel;
  const guild_id = message.guild.id;
  const guild_name = message.guild.name;
  let modRole = '';
  let adminRole = '';

  if (args[0] === 'modrole') {
    modRole = message.mentions.roles.first().id;
    await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id="${guild_id}" AND modRoleName="${modRole}"`)
      .then(async (rows) => {
        // Update all entries from the database
        if (!rows[0]) {
          await sqlConnectionDiscord.query(`UPDATE registration SET modRoleName="${modRole}" WHERE guild_id=${guild_id};`)
            .then(async () => {
              helper.myLogger.log(helper.GetTimestamp() + i18n.__('[ADMIN] [ROLE-REGISTRATION] Role {{modRole}} on {{guild_name}} added to database', {
                guild_name,
                modRole,
              }));
              c.send(i18n.__('🎉 {{modRole}} has been registered!', {
                modRole,
              }));
            });
        } else {
          c.send(i18n.__('🎉 {{modRole}} has already been registered!', {
            modRole,
          }));
        }
      });
  }

  if (args[0] === 'adminrole') {
    adminRole = message.mentions.roles.first().id;
    await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id="${guild_id}" AND adminRoleName="${adminRole}"`)
      .then(async (rows) => {
        // Update all entries from the database
        if (!rows[0]) {
          await sqlConnectionDiscord.query(`UPDATE registration SET adminRoleName="${adminRole}" WHERE guild_id=${guild_id};`)
            .then(async () => {
              helper.myLogger.log(helper.GetTimestamp() + i18n.__('[ADMIN] [ROLE-REGISTRATION] Role {{adminRole}} on {{guild_name}} added to database', {
                guild_name,
                adminRole,
              }));
              c.send(i18n.__('🎉 {{adminRole}} has been registered!', {
                adminRole,
              }));
            });
        } else {
          c.send(i18n.__('🎉 {{adminRole}} has already been registered!', {
            adminRole,
          }));
        }
      });
  }

  if (args[0] === 'channel') {
    const channelID = message.mentions.channels.first().id;

    await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id="${guild_id}" AND mainChannelID="${channelID}"`)
      .then(async (rows) => {
        // Update all entries from the database
        if (!rows[0]) {
          await sqlConnectionDiscord.query(`UPDATE registration SET mainChannelID = ${channelID} WHERE \`guild_id\`="${guild_id}"`)
            .then(async () => {
              helper.myLogger.log(helper.GetTimestamp() + i18n.__('[ADMIN] [CHANNEL-REGISTRATION] Channel added to database'));
              c.send(i18n.__('🎉 Channel has been registered!', {
                adminRole,
              }));
            });
        } else {
          c.send(i18n.__('🎉 Channel has already been registered!'));
        }
      });
  }

  if (!args[0]) {
    await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id="${guild_id}"`)
      .then(async (rows) => {
        // Update all entries from the database
        if (!rows[0]) {
          const values = guild_id + ',\''
                     + guild_name + '\'';
          helper.myLogger.log(values);
          await sqlConnectionDiscord.query(`INSERT INTO registration (\`guild_id\`, \`guild_name\`) VALUES(${values});`)
            .then(async () => {
              helper.myLogger.log(helper.GetTimestamp() + i18n.__('[ADMIN] [SERVER-REGISTRATION] {{guild_name}} {{guild_id}} added to database', {
                guild_name,
                guild_id,
              }));
              c.send(i18n.__('🎉 {{guild_name}} has been registered!', {
                guild_name,
              }));
            });
        } else {
          c.send(i18n.__('🎉 {{guild_name}} has already been registered!', {
            guild_name,
          }));
        }
      })
      .catch((err) => {
        helper.myLogger.error(helper.GetTimestamp() + '[InitDB] Failed to execute query in Server registration: ' + err);
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
