const i18n = require('./i18n');
const sqlConnectionDiscord = require('./database/database_discord');
const helper = require('./helper');

const wait = async (ms) => new Promise((done) => setTimeout(done, ms));

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

exports.leftserver = leftserver;
exports.guildMemberRemove = guildMemberRemove;
exports.getMember = getMember;
