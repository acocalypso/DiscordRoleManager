const { MessageEmbed } = require('discord.js');
const i18n = require('./i18n');
const config = require('../config/config.json');

const dateMultiplier = 86400000;
const sqlConnectionDiscord = require('./database/database_discord');
const helper = require('./helper');

const wait = async (ms) => new Promise((done) => setTimeout(done, ms));

let adminRoleName = '';
let modRoleName = '';
const defaultDonatorRole = config.defaultDonatorRole;

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
            message.reply(i18n.__('errors.temproleSyntax', {
              configCMDPrefix: config.cmdPrefix,
            })).catch((err) => { helper.myLogger.error(err); });
          } else if (!mentioned) {
            message.reply(i18n.__('errors.temproleMentionRequired', {
              configCMDPrefix: config.cmdPrefix,
            })).catch((err) => { helper.myLogger.error(err); });
          } else if (!args[2] && !defaultDonatorRole) {
            message.reply(i18n.__('errors.temproleIncompleteData', {
              configCMDPrefix: config.cmdPrefix,
            })).catch((err) => { helper.myLogger.error(err); });
          } else {
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

            // CHECK DATABASE FOR ROLES
            if (args[0] === 'check') {
              await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}"`)
                .then(async (row) => {
                  if (!row[0]) {
                    c.send(i18n.__('errors.notInDbForRole', {
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

                  c.send(i18n.__('messages.roleExpiryInfo', {
                    mentionedUsername: mentioned.username,
                    rowTempRole: row[0].temporaryRole,
                    finalDate,
                    startDateTime,
                  })).catch((err) => { helper.myLogger.error(err); });
                }).catch((err) => {
                  helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.initdb.roleCheckQuery') + ' 9:' + err);
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
                    c.send(i18n.__('errors.notInDbForRole', {
                      mentionedUsername: mentioned.user.username,
                      daRole: daRole.name,
                    })).catch((err) => { helper.myLogger.error(err); });
                    return;
                  }

                  const theirRole = g.roles.cache.find((daRole) => daRole.name.toLowerCase() === row[0].temporaryRole.toLowerCase());
                  mentioned.roles.remove(theirRole, 'Donation Expired').catch((err) => { helper.myLogger.error(err); });

                  await sqlConnectionDiscord.query(`DELETE FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}" AND temporaryRole="${daRole.name}"`)
                    .then(async () => {
                      helper.myLogger.log(helper.GetTimestamp() + i18n.__('admin.tempRole.removedAccessLog', {
                        mUserUsername: m.user.username,
                        mID: m.id,
                        mentionedUsername: mentioned.user.username,
                        mentionedID: mentioned.id,
                      }));
                      c.send(i18n.__('admin.tempRole.removedAccessNotice', {
                        mentionedUsername: mentioned.user.username,
                        theirRoleName: theirRole.name,
                      })).catch((err) => { helper.myLogger.error(err); });
                    })
                    .catch((err) => {
                      helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.initdb.roleCheckQuery') + ' 11 :' + err);
                    });
                })
                .catch((err) => {
                  helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.initdb.roleCheckQuery') + ' 10 :' + err);
                });
              return;
            }

            // ADD TIME TO A USER
            else if (args[0] === 'add') {
              if (!Number(args[2])) {
                message.reply(i18n.__('errors.invalidDays', {
                  configCMDPrefix: config.cmdPrefix,
                  command,
                  mentionedUsername: mentioned.username,
                  daRole: daRole.name,
                })).catch((err) => { helper.myLogger.error(err); });
                return;
              }

              if (args[1] && !mentioned) {
                message.reply(i18n.__('errors.missingMentionAddTime')).catch((err) => { helper.myLogger.error(err); });
                return;
              }
              if (!args[2]) {
                message.reply(i18n.__('errors.missingDays', {
                  mentionedUsername: mentioned.username,
                })).catch((err) => { helper.myLogger.error(err); });
                return;
              }
              await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}"`)
                .then(async (row) => {
                  if (!row[0]) {
                    message.reply(i18n.__('errors.notInDb', {
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
                      helper.myLogger.log(helper.GetTimestamp() + i18n.__('admin.tempRole.addedDaysLog', {
                        mentionedUsername: mentioned.username,
                        mentionedID: mentioned.id,
                        days,
                        mUserUsername: m.user.username,
                        mID: m.id,
                        daRole: daRole.name,
                      }));
                      c.send(i18n.__('messages.timeAdded', {
                        mentionedUsername: mentioned.username,
                        finalDate,
                        startDateTime,
                      }));

                      mentioned.send(i18n.__('dm.accessExtended', {
                        mentionedUsername: mentioned.username,
                        finalDate,
                      })).catch((error) => {
                        helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.dmFailed', {
                          memberID: mentioned.id,
                          err: error,
                        }));
                      }).catch((err) => { helper.myLogger.error(err); });
                    })
                    .catch((err) => {
                      helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.initdb.roleCheckQuery') + ' 14: ' + err);
                    });
                })
                .catch((err) => {
                  helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.initdb.roleCheckQuery') + ' 13: ' + err);
                });
              return;
            } else if (!Number(args[1])) {
              message.reply(i18n.__('errors.invalidDays', {
                configCMDPrefix: config.cmdPrefix,
                command,
                mentionedUsername: mentioned.username,
                daRole: daRole.name,
              })).catch((err) => { console.log(err); });
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
                      helper.myLogger.info(helper.GetTimestamp() + i18n.__('admin.tempRole.assignedRoleLog', {
                        mentionedUsername: mentioned.user.username,
                        mentionedID: mentioned.id,
                        daRole: daRole.name,
                        mUserUsername: m.user.username,
                        mID: m.id,
                      }));
                      helper.myLogger.info(helper.GetTimestamp() + 'User has been added to DB: %s %s', mentioned.user.username, daRole.name);
                      c.send(i18n.__('messages.tempRoleAssigned', {
                        mentionedUsername: mentioned.user.username,
                        daRole: daRole.name,
                        finalDateDisplay,
                      }));

                      mentioned.send(i18n.__('dm.accessExpiresWithMap', {
                        mentionedUsername: mentioned.user.username,
                        finalDateDisplay,
                        map: config.mapMain.url,
                      })).catch((error) => {
                        helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.dmFailed', {
                          memberID: mentioned.id,
                          err: error,
                        }));
                      }).catch((err) => { helper.myLogger.error(err); });
                    })
                    .catch((err) => {
                      helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.initdb.roleCheckQuery') + ' 16: ' + err);
                    });
                } else {
                  c.send(i18n.__('errors.userAlreadyHasRole', {
                    daRole: daRole.name,
                    configCMDPrefix: config.cmdPrefix,
                    mentionedUsername: mentioned.user.username,
                  }));
                }
              })
              .catch((err) => {
                helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.initdb.roleCheckQuery') + ' 16: ' + err);
              });
          }
        }
      } else {
        c.send(i18n.__('errors.notAllowed')).catch((err) => { helper.myLogger.error(helper.GetTimestamp() + err); });
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
          helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.configAdminRoleMissing', {
            configAdminRoleName: adminRoleName,
          }));
        }
        let ModR = g.roles.cache.find((role) => role.id === modRoleName);
        if (!ModR) {
          ModR = { id: '111111111111111111' };
          helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.configModRoleMissing', {
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
            c.send(i18n.__('errors.notAllowedHelp', {
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
  const m = message.member;

  const paypal_description = i18n.__('paypal.thanks');
  const paypal_title = i18n.__('paypal.subscribe');
  if (config.paypal.enabled === 'yes') {
    const embedMSG = new MessageEmbed()
      .setColor('0xFF0000')
      .setTitle(paypal_title)
      .setURL(config.paypal.url)
      .setThumbnail(config.paypal.img)
      .setDescription(paypal_description);
    m.send({ embeds: [embedMSG] }).catch((err) => { helper.myLogger.error(err); });
  }
  message.delete();
}

async function check(message, args) {
  const c = message.channel;
  const g = message.channel.guild;
  const m = message.member;
  const msg = message.content;
  let messageRoleID = '';
  let daRole = '';

  if (message.mentions.roles.first()) {
    messageRoleID = message.mentions.roles.first().id;
    daRole = message.member.guild.roles.cache.get(messageRoleID);
  } else {
    messageRoleID = defaultDonatorRole;
    daRole = message.member.guild.roles.cache.get(messageRoleID);
  }

  args = msg.split(' ').slice(1);

  if (!args[0] && defaultDonatorRole === '') {
    c.send(i18n.__('errors.checkRolePromptMention', {
      configCMDPrefix: config.cmdPrefix,
    }));
    return;
  }

  // CHECK ROLE EXIST
  const rName = g.roles.cache.find((rName) => rName.name === daRole.name);
  if (!rName) {
    c.send(i18n.__('errors.roleNotFound'));
    return;
  }

  // CHECK DATABASE FOR ROLES
  await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${m.id}" AND temporaryRole="${daRole.name}" AND guild_id="${g.id}"`)
    .then(async (row) => {
      if (!row[0]) {
        c.send(i18n.__('errors.authorNotInDbForRole', {
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
      message.delete();
      m.send(i18n.__('messages.selfRoleExpiryInfo', {
        rowTempRole: row[0].temporaryRole,
        finalDate,
        startDateTime,
      })).catch((err) => { helper.myLogger.error(err); });
    })
    .catch((err) => {
      helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.initdb.roleCheckQuery') + ' 8: ' + err);
    });
}

async function map(message) {
  /// GET CHANNEL INFO
  const m = message.member;

  if (config.mapMain.enabled === 'yes') {
    message.delete();
    m.send(i18n.__('messages.webmap', {
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
                  helper.myLogger.error(helper.GetTimestamp() + i18n.__('admin.tempRole.leftMarkedLog', {
                    name,
                    memberID: member.id,
                  }));
                  bot.channels.cache.get(c).send(i18n.__('admin.tempRole.leftNotice', {
                    name,
                  }));
                })
                .catch((err) => {
                  helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.initdb.roleCheckQuery') + ' 2 :' + err);
                });
            }
            if (rows[0]) {
              await sqlConnectionDiscord.query(`DELETE FROM temporary_roles WHERE userID="${userID}" AND guild_id="${guildID}"`)
                .then(async () => {
                  const name = member.user.username.replace(/[^a-zA-Z0-9]/g, '');
                  helper.myLogger.error(helper.GetTimestamp() + i18n.__('admin.tempRole.leftRemovedLog', {
                    name,
                    memberID: member.id,
                  }));
                  bot.channels.cache.get(c).send(i18n.__('admin.tempRole.leftRemovedNotice', {
                    name,
                  }));
                })
                .catch((err) => {
                  helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.initdb.guildMemberRemove') + ' 2: ' + err);
                });
            }
          })
          .catch((err) => {
            helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.initdb.guildMemberRemove') + ' 1: ' + err);
          });
      }
    })
    .catch((err) => {
      helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.initdb.mainChannelId') + ' 2: ' + err);
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

async function register(message, args) {
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
              helper.myLogger.log(helper.GetTimestamp() + i18n.__('admin.registration.modRoleAdded', {
                guild_name,
                modRole,
              }));
              c.send(i18n.__('messages.modRoleRegistered', {
                modRole,
              }));
            });
        } else {
          c.send(i18n.__('messages.modRoleAlreadyRegistered', {
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
              helper.myLogger.log(helper.GetTimestamp() + i18n.__('admin.registration.adminRoleAdded', {
                guild_name,
                adminRole,
              }));
              c.send(i18n.__('messages.adminRoleRegistered', {
                adminRole,
              }));
            });
        } else {
          c.send(i18n.__('messages.adminRoleAlreadyRegistered', {
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
              helper.myLogger.log(helper.GetTimestamp() + i18n.__('admin.registration.channelAdded'));
              c.send(i18n.__('messages.channelRegistered', {
                adminRole,
              }));
            });
        } else {
          c.send(i18n.__('messages.channelAlreadyRegistered'));
        }
      });
  }

  if (args[0] === 'adminchannel') {
    const channelID = message.mentions.channels.first().id;

    await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id="${guild_id}" AND adminChannelID="${channelID}"`)
      .then(async (rows) => {
        // Update all entries from the database
        if (!rows[0]) {
          await sqlConnectionDiscord.query(`UPDATE registration SET adminChannelID = ${channelID} WHERE guild_id="${guild_id}"`)
            .then(async () => {
              helper.myLogger.log(helper.GetTimestamp() + i18n.__('admin.registration.adminChannelAdded'));
              c.send(i18n.__('messages.adminChannelRegistered', {
                adminRole,
              }));
            });
        } else {
          c.send(i18n.__('messages.adminChannelAlreadyRegistered'));
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
              helper.myLogger.log(helper.GetTimestamp() + i18n.__('admin.registration.serverAdded', {
                guild_name,
                guild_id,
              }));
              c.send(i18n.__('messages.serverRegistered', {
                guild_name,
              }));
            });
        } else {
          c.send(i18n.__('messages.serverAlreadyRegistered', {
            guild_name,
          }));
        }
      })
      .catch((err) => {
        helper.myLogger.error(helper.GetTimestamp() + '[InitDB] Failed to execute query in Server registration: ' + err);
      });
  }
  message.delete();
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
