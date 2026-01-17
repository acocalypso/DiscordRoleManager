const bcrypt = require('bcrypt');
const sqlConnectionDiscord = require('../../module/database/database_discord');
const helper = require('../../module/helper');
const config = require('../../config/config.json');

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
  const { userId, role } = req.body;
  if (!userId || !role) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }

  try {
    await sqlConnectionDiscord.query('DELETE FROM temporary_roles WHERE userID = ? AND temporaryRole = ?;', [userId, role]);
    res.json({ ok: true });
  } catch (err) {
    helper.myLogger.error(helper.GetTimestamp() + `[DeleteUser] Failed to delete user: ${err}`);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};
