/* eslint-disable no-use-before-define */
/* eslint-disable no-restricted-syntax */
const i18nmodule = require('i18n-nodejs');
const sqlConnectionDiscord = require('./database/database_discord');
const helper = require('./helper');
const config = require('../config/config.json');
const discordcommands = require('./discordcommands');

const i18nconfig = {
  lang: config.language,
  langFile: './../../locale/locale.json',
};

const i18n = new i18nmodule(i18nconfig.lang, i18nconfig.langFile);

async function updateUsernameIfMissing(member, name) {
  if (!member) return;

  const query = `UPDATE temporary_roles SET username="${name}" WHERE userID="${member.id}" AND guild_id="${member.guild.id}"`;

  try {
    await sqlConnectionDiscord.query(query);
    helper.myLogger.log(i18n.__('Updated the username for {{memberId}} to {{name}}', { memberID: member.id, name }));
  } catch (err) {
    handleError('[InitDB] Failed to execute role check query', err);
  }
}

async function updateGuildIDIfMissing(member, guild) {
  if (!member || !guild) return;

  const query = `UPDATE temporary_roles SET guild_id="${guild.id}" WHERE userID="${member.id}"`;

  try {
    await sqlConnectionDiscord.query(query);
    helper.myLogger.log(helper.GetTimestamp() + i18n.__('Updated guild_id for {{name}}', { name }));
  } catch (err) {
    handleError('[InitDB] Failed to execute role check query', err);
  }
}

async function deleteExpiredRole(bot, rows, member, rName, guild) {
  try {
    await member.roles.remove(rName);
    await sqlConnectionDiscord.query(`DELETE FROM temporary_roles WHERE userID='${member.id}' AND temporaryRole='${rName.name}' AND guild_id="${guild.id}"`);

    const result = await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id=${guild.id}`);

    bot.channels.cache.get(result[0].adminChannelID).send(i18n.__('⚠ {{rowUsername}} has **left** the server and **lost** their role of: **{{rNameName}}** - their **temporary** access has __EXPIRED__ 😭', {
      rowUsername: member.user.username,
      rNameName: rName.name,
    }));

    helper.myLogger.log(helper.GetTimestamp() + i18n.__('[ADMIN] [TEMPORARY-ROLE] {{rowUsername}} - {{rowUserID}} has left the server and lost their role: {{rNameName}} ... time EXPIRED', {
      rowUsername: member.user.username,
      rowUserID: member.id,
      rNameName: rName.name,
    }));
  } catch (error) {
    handleError(`Could not remove the ${rName.name} role from ${member.user.username}!`, error);
  }
}

async function sendExpirationNotification(member, rName, guild) {
  const result = await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id=${guild.id}`);

  member.send(i18n.__('Hello {{memberUsername}}!\n\nYour role **{{rNameName}}** on **{{configServerName}}** has been removed.\nIf you want to continue, please do another donation.\n\nThank you.\nPaypal: {{configPaypalUrl}}', {
    memberUsername: member.user.username,
    rNameName: rName.name,
    configServerName: result[0].guild_name,
    configPaypalUrl: config.paypal.url,
  })).catch((err) => {
    console.error(err);
  });

  if (config.specialmode.enabled === 'yes') {
    const hideRole = config.specialmode.hideRole;
    member.roles.add(hideRole);
  }

  await sqlConnectionDiscord.query(`DELETE FROM temporary_roles WHERE userID='${member.id}' AND temporaryRole='${rName.name}' AND guild_id="${member.guild.id}"`)
    .catch((err) => {
      console.error(helper.GetTimestamp() + i18n.__('[InitDB] Failed to execute role check query') + ' 2: ' + err);
      process.exit(-1);
    });

  helper.myLogger.log(helper.GetTimestamp() + i18n.__('[ADMIN] [TEMPORARY-ROLE] {{memberUsername}} - {{memberId}} have lost their role: {{rNameName}} ... time EXPIRED', {
    memberUsername: member.user.username,
    memberId: member.id,
    rNameName: rName.name,
  }));
}

async function housekeeping(bot) {
  const timeNow = Date.now();
  helper.myLogger.log(helper.GetTimestamp() + 'housekeeping started');

  try {
    const rows = await sqlConnectionDiscord.query('SELECT * FROM temporary_roles');

    if (!rows[0]) {
      helper.myLogger.log(i18n.__('No one is in the DataBase'));
      return;
    }

    for (const row of rows) {
      const dbTime = parseInt(row.endDate, 10) * 1000;
      const notify = row.notified;
      const daysLeft = dbTime - timeNow;
      const leftServer = row.leftServer;
      const serverID = row.guild_id;

      const guild = bot.guilds.cache.get(serverID);
      const rName = guild?.roles.cache.find((r) => r.name.toLowerCase() === row.temporaryRole.toLowerCase());
      const member = await discordcommands.getMember(bot, row.userID, row.guild_id);

      if (!member && !leftServer) continue;

      const name = member.user.username.replace(/[^a-zA-Z0-9]/g, '');

      if (!row.username && !leftServer) {
        await updateUsernameIfMissing(member, name);
      }

      if (!leftServer && !row.guild_id) {
        await updateGuildIDIfMissing(member, guild);
      }

      if (daysLeft < 1) {
        await deleteExpiredRole(bot, rows, member, rName, guild);
      }

      if (daysLeft < 432000000 && notify === 0 && !leftServer) {
        const endDateVal = new Date();
        endDateVal.setTime(dbTime);
        const finalDate = await helper.formatTimeString(endDateVal);

        await sendExpirationNotification(member, rName, guild, finalDate);
      }
    }
  } catch (err) {
    handleError('[InitDB] Failed to execute role check query', err);
  }
}

function handleError(message, error) {
  helper.myLogger.error(helper.GetTimestamp() + i18n.__(message) + ': ' + error);
}

exports.housekeeping = housekeeping;
