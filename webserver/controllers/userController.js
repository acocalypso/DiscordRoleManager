const bcrypt = require('bcrypt');
const sqlConnectionDiscord = require('../../module/database/database_discord');
const helper = require('../../module/helper');
const i18n = require('../../module/i18n');
const config = require('../../config/config.json');

async function resolveDefaultRoleId(guildId) {
  if (config.defaultDonatorRole) {
    return config.defaultDonatorRole;
  }
  const rows = await sqlConnectionDiscord.query(
    'SELECT defaultRoleId FROM registration WHERE guild_id = ?;',
    [guildId]
  );
  return rows[0]?.defaultRoleId || null;
}

exports.csrf = (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
};

exports.session = (req, res) => {
  if (req.session && req.session.loggedin === true) {
    res.json({ loggedIn: true, username: req.session.username });
    return;
  }
  res.json({ loggedIn: false });
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Missing credentials' });
    return;
  }

  try {
    const rows = await sqlConnectionDiscord.query('SELECT password FROM login WHERE username = ?', [username]);
    if (!rows[0]) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (!bcrypt.compareSync(password, rows[0].password)) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    req.session.loggedin = true;
    req.session.username = username;
    res.json({ username });
  } catch (err) {
    helper.myLogger.error(helper.GetTimestamp() + `[Login] Failed to authenticate: ${err}`);
    res.status(500).json({ error: 'Login failed' });
  }
};

exports.logout = (req, res) => {
  if (!req.session) {
    res.json({ ok: true });
    return;
  }
  req.session.destroy((err) => {
    if (err) {
      helper.myLogger.error(helper.GetTimestamp() + `[Logout] Failed to destroy session: ${err}`);
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    res.json({ ok: true });
  });
};

exports.listGuilds = async (req, res) => {
  try {
    const results = await sqlConnectionDiscord.query(
      'SELECT guild_id as guildId, guild_name as guildName FROM registration;'
    );
    res.json({ guilds: results });
  } catch (err) {
    helper.myLogger.error(helper.GetTimestamp() + `[Guilds] Failed to list guilds: ${err}`);
    res.status(500).json({ error: 'Failed to load guilds' });
  }
};

exports.listMembers = async (req, res) => {
  const bot = req.app.get('discordBot');
  if (!bot) {
    res.status(500).json({ error: 'Discord client unavailable' });
    return;
  }

  const { guildId } = req.params;
  try {
    const guild = bot.guilds.cache.get(guildId);
    if (!guild) {
      res.status(404).json({ error: 'Guild not found' });
      return;
    }

    await guild.members.fetch();
    const members = guild.members.cache.map((member) => ({
      id: member.id,
      username: member.user.username,
      tag: member.user.tag,
      displayName: member.displayName,
      bot: member.user.bot,
    }));

    res.json({ members });
  } catch (err) {
    helper.myLogger.error(helper.GetTimestamp() + `[GuildMembers] Failed to list members: ${err}`);
    res.status(500).json({ error: 'Failed to load members' });
  }
};

exports.listRoles = async (req, res) => {
  const bot = req.app.get('discordBot');
  if (!bot) {
    res.status(500).json({ error: 'Discord client unavailable' });
    return;
  }

  const { guildId } = req.params;
  try {
    const guild = bot.guilds.cache.get(guildId);
    if (!guild) {
      res.status(404).json({ error: 'Guild not found' });
      return;
    }

    const roles = guild.roles.cache
      .filter((role) => role.id !== guild.id && !role.managed)
      .sort((a, b) => b.position - a.position)
      .map((role) => ({
        id: role.id,
        name: role.name,
        color: role.color,
      }));

    res.json({ roles });
  } catch (err) {
    helper.myLogger.error(helper.GetTimestamp() + `[GuildRoles] Failed to list roles: ${err}`);
    res.status(500).json({ error: 'Failed to load roles' });
  }
};

exports.listUsers = async (req, res) => {
  try {
    const results = await sqlConnectionDiscord.query(
      'SELECT temporary_roles.userID as userID, temporary_roles.username, temporary_roles.temporaryRole, temporary_roles.guild_id as guildId, registration.guild_name as guildName, FROM_UNIXTIME(temporary_roles.endDate) as endDate FROM temporary_roles LEFT JOIN registration ON temporary_roles.guild_id = registration.guild_id;'
    );
    res.json({ users: results });
  } catch (err) {
    helper.myLogger.error(helper.GetTimestamp() + `[Users] Failed to list users: ${err}`);
    res.status(500).json({ error: 'Failed to load users' });
  }
};

exports.createUser = async (req, res) => {
  const { userId, username, role, guildId } = req.body;
  if (!userId || !username || !role) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const resolvedGuildId = guildId || config.guildID || null;
  try {
    await sqlConnectionDiscord.query(
      'INSERT INTO temporary_roles (userID, temporaryRole, startDate, endDate, addedBy, notified, username, leftServer, guild_id) VALUES (?, ?, 0, 0, 0, 0, ?, 0, ?) ON DUPLICATE KEY UPDATE username=VALUES(username), guild_id=VALUES(guild_id);',
      [userId, role, username, resolvedGuildId]
    );
    res.json({ ok: true });
  } catch (err) {
    helper.myLogger.error(helper.GetTimestamp() + `[ManualDBEntry] Failed to create user: (${err})`);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

exports.updateUser = async (req, res) => {
  const {
    originalUserId,
    originalRole,
    userId,
    username,
    role,
    guildId,
  } = req.body;

  if (!originalUserId || !originalRole || !userId || !username || !role) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  const resolvedGuildId = guildId || config.guildID || null;
  try {
    await sqlConnectionDiscord.query(
      'UPDATE temporary_roles SET userID = ?, temporaryRole = ?, username = ?, guild_id = ? WHERE userID = ? AND temporaryRole = ?;',
      [userId, role, username, resolvedGuildId, originalUserId, originalRole]
    );
    res.json({ ok: true });
  } catch (err) {
    helper.myLogger.error(helper.GetTimestamp() + `[EditUser] Failed to update user: ${err}`);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

exports.deleteUser = async (req, res) => {
  const bot = req.app.get('discordBot');
  if (!bot) {
    res.status(500).json({ error: 'Discord client unavailable' });
    return;
  }

  const { userId, role, guildId } = req.body;
  if (!userId || !role || !guildId) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    const guild = bot.guilds.cache.get(guildId);
    if (!guild) {
      res.status(404).json({ error: 'Guild not found' });
      return;
    }

    const dbRow = await sqlConnectionDiscord.query(
      'SELECT * FROM temporary_roles WHERE userID = ? AND temporaryRole = ? AND guild_id = ?;',
      [userId, role, guildId]
    );

    if (!dbRow[0]) {
      res.status(404).json({ error: 'Entry not found in database' });
      return;
    }

    const discordRole = guild.roles.cache.find((r) => r.name === role);
    if (!discordRole) {
      res.status(404).json({ error: 'Role not found in guild' });
      return;
    }

    const member = await guild.members.fetch(userId);
    try {
      await member.roles.remove(discordRole, 'Removed via web interface');
    } catch (err) {
      helper.myLogger.error(helper.GetTimestamp() + `[DeleteUser] Failed to remove role: ${err}`);
      const reason = err?.code === 50013 ? 'Missing permissions to manage this role.' : (err?.message || 'Unknown error');
      res.status(403).json({ error: `Cannot remove role ${role}: ${reason}` });
      return;
    }

    await sqlConnectionDiscord.query(
      'DELETE FROM temporary_roles WHERE userID = ? AND temporaryRole = ? AND guild_id = ?;',
      [userId, role, guildId]
    );
    res.json({ ok: true });
  } catch (err) {
    helper.myLogger.error(helper.GetTimestamp() + `[DeleteUser] Failed to delete user: ${err}`);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

exports.assignTempRole = async (req, res) => {
  const bot = req.app.get('discordBot');
  if (!bot) {
    res.status(500).json({ error: 'Discord client unavailable' });
    return;
  }

  let { guildId, userId, roleId, days } = req.body;
  const parsedDays = Number(days);
  if (!guildId || !userId || !Number.isInteger(parsedDays) || parsedDays <= 0) {
    res.status(400).json({ error: 'Missing or invalid fields' });
    return;
  }

  if (!roleId) {
    roleId = await resolveDefaultRoleId(guildId);
  }
  if (!roleId) {
    res.status(400).json({ error: 'No role selected and no default role configured.' });
    return;
  }

  try {
    const guild = bot.guilds.cache.get(guildId);
    if (!guild) {
      res.status(404).json({ error: 'Guild not found' });
      return;
    }

    const role = guild.roles.cache.get(roleId);
    if (!role) {
      res.status(404).json({ error: 'Role not found' });
      return;
    }

    const member = await guild.members.fetch(userId);
    const now = Date.now();

    const existing = await sqlConnectionDiscord.query(
      'SELECT * FROM temporary_roles WHERE userID = ? AND temporaryRole = ? AND guild_id = ?;',
      [member.id, role.name, guild.id]
    );

    let endDate;
    if (!existing[0]) {
      endDate = now + (parsedDays * 86400000);
      const name = member.user.username.replace(/[^a-zA-Z0-9]/g, '');
      await sqlConnectionDiscord.query(
        'INSERT INTO temporary_roles (userID, temporaryRole, startDate, endDate, addedBy, notified, username, leftServer, guild_id) VALUES (?, ?, ?, ?, 0, 0, ?, 0, ?);',
        [member.id, role.name, Math.round(now / 1000), Math.round(endDate / 1000), name, guild.id]
      );
    } else {
      endDate = (Number(existing[0].endDate) * 1000) + (parsedDays * 86400000);
      const name = member.user.username.replace(/[^a-zA-Z0-9]/g, '');
      await sqlConnectionDiscord.query(
        'UPDATE temporary_roles SET endDate = ?, notified = 0, username = ? WHERE userID = ? AND temporaryRole = ? AND guild_id = ?;',
        [Math.round(endDate / 1000), name, member.id, role.name, guild.id]
      );
    }

    if (!member.roles.cache.has(role.id)) {
      try {
        await member.roles.add(role);
      } catch (err) {
        helper.myLogger.error(helper.GetTimestamp() + `[TempRole] Failed to add role: ${err}`);
        if (!existing[0]) {
          await sqlConnectionDiscord.query(
            'DELETE FROM temporary_roles WHERE userID = ? AND temporaryRole = ? AND guild_id = ?;',
            [member.id, role.name, guild.id]
          );
        }
        const reason = err?.code === 50013 ? 'Missing permissions to manage this role.' : (err?.message || 'Unknown error');
        res.status(403).json({ error: `Cannot assign role ${role.name}: ${reason}` });
        return;
      }
    }

    const finalDate = await helper.formatTimeString(new Date(endDate));

    if (!existing[0]) {
      await member.send(i18n.__('messages.tempRoleAssigned', {
        mentionedUsername: member.user.username,
        daRole: role.name,
        finalDateDisplay: finalDate,
      })).catch((err) => {
        helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.dmFailed', {
          memberID: member.id,
          err,
        }));
      });
    } else {
      await member.send(i18n.__('dm.accessExtended', {
        mentionedUsername: member.user.username,
        finalDate,
      })).catch((err) => {
        helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.dmFailed', {
          memberID: member.id,
          err,
        }));
      });
    }
    res.json({ ok: true, finalDate });
  } catch (err) {
    helper.myLogger.error(helper.GetTimestamp() + `[TempRole] Failed to assign role: ${err}`);
    res.status(500).json({ error: 'Failed to assign role' });
  }
};
