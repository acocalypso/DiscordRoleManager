const {
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  PermissionsBitField,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} = require('discord.js');
const config = require('../config/config.json');
const sqlConnectionDiscord = require('./database/database_discord');
const helper = require('./helper');
const i18n = require('./i18n');

const registerSessions = new Map();

const commands = [
  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Set up this server for DiscordRoleManager'),
  new SlashCommandBuilder()
    .setName('temprole')
    .setDescription('Manage temporary roles')
    .addSubcommand((sub) => sub
      .setName('add')
      .setDescription('Add a temporary role to a user')
      .addUserOption((opt) => opt.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption((opt) => opt.setName('days').setDescription('Days').setRequired(true))
      .addRoleOption((opt) => opt.setName('role').setDescription('Role').setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('remove')
      .setDescription('Remove a temporary role from a user')
      .addUserOption((opt) => opt.setName('user').setDescription('User').setRequired(true))
      .addRoleOption((opt) => opt.setName('role').setDescription('Role').setRequired(false)))
    .addSubcommand((sub) => sub
      .setName('check')
      .setDescription('Check a user\'s temporary role')
      .addUserOption((opt) => opt.setName('user').setDescription('User').setRequired(true))
      .addRoleOption((opt) => opt.setName('role').setDescription('Role').setRequired(false))),
  new SlashCommandBuilder()
    .setName('check')
    .setDescription('Check your temporary role')
    .addRoleOption((opt) => opt.setName('role').setDescription('Role').setRequired(false)),
  new SlashCommandBuilder()
    .setName('map')
    .setDescription('Get the web map link'),
  new SlashCommandBuilder()
    .setName('paypal')
    .setDescription('Get the PayPal link'),
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show help')
    .addStringOption((opt) => opt
      .setName('scope')
      .setDescription('Help scope')
      .addChoices(
        { name: 'mods', value: 'mods' },
      )),
].map((cmd) => cmd.toJSON());

async function registerSlashCommands() {
  if (!config.clientID) {
    helper.myLogger.error(i18n.__('errors.missingClientId'));
    return;
  }

  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    if (config.guildID) {
      await rest.put(Routes.applicationGuildCommands(config.clientID, config.guildID), { body: commands });
      helper.myLogger.log(`${i18n.__('register.slashRegistered')} (guild)`);
    } else {
      await rest.put(Routes.applicationCommands(config.clientID), { body: commands });
      helper.myLogger.log(`${i18n.__('register.slashRegistered')} (global)`);
    }
  } catch (error) {
    helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.slashRegisterFailed', { err: error }));
  }
}

async function isRegistered(guildId) {
  const rows = await sqlConnectionDiscord.query(`SELECT * FROM registration WHERE guild_id="${guildId}"`);
  return rows && rows[0];
}

function hasAdminPermission(interaction) {
  if (interaction.memberPermissions && interaction.memberPermissions.has(PermissionsBitField.Flags.Administrator)) {
    return true;
  }
  if (interaction.user && interaction.user.id === config.ownerID) {
    return true;
  }
  return false;
}

async function handleRegister(interaction) {
  if (!interaction.guild) {
    await interaction.reply({ content: i18n.__('errors.guildOnly'), ephemeral: true });
    return;
  }

  if (!hasAdminPermission(interaction)) {
    await interaction.reply({ content: i18n.__('errors.notAllowed'), ephemeral: true });
    return;
  }

  registerSessions.set(interaction.user.id, {
    adminRoleId: null,
    modRoleId: null,
    mainChannelId: null,
    adminChannelId: null,
  });

  const adminRoleSelect = new RoleSelectMenuBuilder()
    .setCustomId('register:adminRole')
    .setPlaceholder(i18n.__('register.adminRolePlaceholder'))
    .setMinValues(1)
    .setMaxValues(1);

  const modRoleSelect = new RoleSelectMenuBuilder()
    .setCustomId('register:modRole')
    .setPlaceholder(i18n.__('register.modRolePlaceholder'))
    .setMinValues(0)
    .setMaxValues(1);

  const mainChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('register:mainChannel')
    .setPlaceholder(i18n.__('register.mainChannelPlaceholder'))
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(1)
    .setMaxValues(1);

  const adminChannelSelect = new ChannelSelectMenuBuilder()
    .setCustomId('register:adminChannel')
    .setPlaceholder(i18n.__('register.adminChannelPlaceholder'))
    .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
    .setMinValues(1)
    .setMaxValues(1);

  const saveButton = new ButtonBuilder()
    .setCustomId('register:save')
    .setLabel(i18n.__('register.save'))
    .setStyle(ButtonStyle.Primary);

  const cancelButton = new ButtonBuilder()
    .setCustomId('register:cancel')
    .setLabel(i18n.__('register.cancel'))
    .setStyle(ButtonStyle.Secondary);

  await interaction.reply({
    content: i18n.__('register.instructions'),
    components: [
      new ActionRowBuilder().addComponents(adminRoleSelect),
      new ActionRowBuilder().addComponents(modRoleSelect),
      new ActionRowBuilder().addComponents(mainChannelSelect),
      new ActionRowBuilder().addComponents(adminChannelSelect),
      new ActionRowBuilder().addComponents(saveButton, cancelButton),
    ],
    ephemeral: true,
  });
}
async function handleRegisterSave(interaction) {
  const session = registerSessions.get(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: i18n.__('register.sessionExpired'), ephemeral: true });
    return;
  }

  const { adminRoleId, modRoleId, mainChannelId, adminChannelId } = session;
  if (!adminRoleId || !mainChannelId || !adminChannelId) {
    await interaction.reply({ content: i18n.__('register.missingRequired'), ephemeral: true });
    return;
  }

  const adminRole = interaction.guild.roles.cache.get(adminRoleId);
  const modRole = modRoleId ? interaction.guild.roles.cache.get(modRoleId) : null;
  const mainChannel = interaction.guild.channels.cache.get(mainChannelId);
  const adminChannel = interaction.guild.channels.cache.get(adminChannelId);

  if (!adminRole || (modRoleId && !modRole) || !mainChannel || !adminChannel) {
    await interaction.reply({ content: i18n.__('register.invalidInput'), ephemeral: true });
    return;
  }

  const existing = await isRegistered(interaction.guild.id);
  const modRoleValue = modRoleId ? `"${modRoleId}"` : 'NULL';
  if (existing) {
    await sqlConnectionDiscord.query(
      `UPDATE registration SET guild_name="${interaction.guild.name}", mainChannelID="${mainChannelId}", adminRoleName="${adminRoleId}", modRoleName=${modRoleValue}, adminChannelID="${adminChannelId}" WHERE guild_id="${interaction.guild.id}"`,
    );
    await interaction.reply({ content: i18n.__('register.updated'), ephemeral: true });
    registerSessions.delete(interaction.user.id);
    return;
  }

  const values = `${interaction.guild.id},'${interaction.guild.name}','${mainChannelId}','${adminRoleId}',${modRoleValue},'${adminChannelId}'`;
  await sqlConnectionDiscord.query(`INSERT INTO registration (guild_id, guild_name, mainChannelID, adminRoleName, modRoleName, adminChannelID) VALUES(${values});`);
  await interaction.reply({ content: i18n.__('register.success'), ephemeral: true });
  registerSessions.delete(interaction.user.id);
}

async function ensureRegistered(interaction) {
  if (!interaction.guild) {
    await interaction.reply({ content: i18n.__('errors.guildOnly'), ephemeral: true });
    return false;
  }

  const row = await isRegistered(interaction.guild.id);
  if (!row) {
    await interaction.reply({ content: i18n.__('errors.registerRequired'), ephemeral: true });
    return false;
  }

  return row;
}

async function handleTemprole(interaction) {
  const registration = await ensureRegistered(interaction);
  if (!registration) return;

  const sub = interaction.options.getSubcommand();
  const g = interaction.guild;
  const m = interaction.member;

  const adminRoleId = registration.adminRoleName;
  const modRoleId = registration.modRoleName;

  const AdminR = g.roles.cache.find((role) => role.id === adminRoleId) || { id: '111111111111111111' };
  const ModR = g.roles.cache.find((role) => role.id === modRoleId) || { id: '111111111111111111' };

  if (!m.roles.cache.has(ModR.id) && !m.roles.cache.has(AdminR.id) && m.id !== config.ownerID) {
    await interaction.reply({ content: i18n.__('errors.notAllowed'), ephemeral: true });
    return;
  }

  const mentioned = interaction.options.getUser('user', true);
  const role = interaction.options.getRole('role') || g.roles.cache.get(config.defaultDonatorRole);

  if (!role) {
    await interaction.reply({ content: i18n.__('errors.checkRolePromptMention', { configCMDPrefix: config.cmdPrefix }), ephemeral: true });
    return;
  }

  if (sub === 'check') {
    const row = await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}"`);
    if (!row[0]) {
      await interaction.reply({ content: i18n.__('errors.notInDbForRole', { mentionedUsername: mentioned.username, daRole: role.name }), ephemeral: true });
      return;
    }

    const startDateVal = new Date(row[0].startDate * 1000);
    const endDateVal = new Date(row[0].endDate * 1000);
    const startDateTime = await helper.formatTimeString(startDateVal);
    const finalDate = await helper.formatTimeString(endDateVal);

    await interaction.reply({ content: i18n.__('messages.roleExpiryInfo', {
      mentionedUsername: mentioned.username,
      rowTempRole: row[0].temporaryRole,
      finalDate,
      startDateTime,
    }), ephemeral: true });
    return;
  }

  if (sub === 'remove') {
    const row = await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}" AND temporaryRole="${role.name}"`);
    if (!row[0]) {
      await interaction.reply({ content: i18n.__('errors.notInDbForRole', { mentionedUsername: mentioned.username, daRole: role.name }), ephemeral: true });
      return;
    }

    const guildMember = await g.members.fetch(mentioned.id);
    await guildMember.roles.remove(role, 'Donation Expired');
    await sqlConnectionDiscord.query(`DELETE FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}" AND temporaryRole="${role.name}"`);

    helper.myLogger.log(helper.GetTimestamp() + i18n.__('admin.tempRole.removedAccessLog', {
      mUserUsername: m.user.username,
      mID: m.id,
      mentionedUsername: mentioned.username,
      mentionedID: mentioned.id,
    }));

    await interaction.reply({ content: i18n.__('admin.tempRole.removedAccessNotice', {
      mentionedUsername: mentioned.username,
      theirRoleName: role.name,
    }), ephemeral: true });
    return;
  }

  if (sub === 'add') {
    const days = interaction.options.getInteger('days', true);
    const row = await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}"`);
    if (!row[0]) {
      await interaction.reply({ content: i18n.__('errors.notInDb', { mentionedUsername: mentioned.username }), ephemeral: true });
      return;
    }

    const startDateVal = new Date(row[0].startDate * 1000);
    const startDateTime = await helper.formatTimeString(startDateVal);
    let finalDate = Number(row[0].endDate * 1000) + Number(days * 86400000);

    const name = mentioned.username.replace(/[^a-zA-Z0-9]/g, '');
    await sqlConnectionDiscord.query(`UPDATE temporary_roles SET endDate="${Math.round(finalDate / 1000)}", notified=0, username="${name}" WHERE userID="${mentioned.id}" AND temporaryRole="${role.name}" AND guild_id="${g.id}"`);

    const endDateVal = new Date(finalDate);
    finalDate = await helper.formatTimeString(endDateVal);

    helper.myLogger.log(helper.GetTimestamp() + i18n.__('admin.tempRole.addedDaysLog', {
      mentionedUsername: mentioned.username,
      mentionedID: mentioned.id,
      days,
      mUserUsername: m.user.username,
      mID: m.id,
      daRole: role.name,
    }));

    await interaction.reply({ content: i18n.__('messages.timeAdded', {
      mentionedUsername: mentioned.username,
      finalDate,
      startDateTime,
    }), ephemeral: true });

    try {
      await mentioned.send(i18n.__('dm.accessExtended', {
        mentionedUsername: mentioned.username,
        finalDate,
      }));
    } catch (error) {
      helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.dmFailed', {
        memberID: mentioned.id,
        err: error,
      }));
    }
  }
}

async function handleCheck(interaction) {
  const registration = await ensureRegistered(interaction);
  if (!registration) return;

  const g = interaction.guild;
  const m = interaction.member;
  const role = interaction.options.getRole('role') || g.roles.cache.get(config.defaultDonatorRole);

  if (!role) {
    await interaction.reply({ content: i18n.__('errors.checkRolePromptMention', { configCMDPrefix: config.cmdPrefix }), ephemeral: true });
    return;
  }

  const row = await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${m.id}" AND temporaryRole="${role.name}" AND guild_id="${g.id}"`);
  if (!row[0]) {
    await interaction.reply({ content: i18n.__('errors.authorNotInDbForRole', { mAuthorUsername: interaction.user.username, daRole: role.name }), ephemeral: true });
    return;
  }

  const startDateVal = new Date(row[0].startDate * 1000);
  const endDateVal = new Date(row[0].endDate * 1000);
  const startDateTime = await helper.formatTimeString(startDateVal);
  const finalDate = await helper.formatTimeString(endDateVal);

  await interaction.reply({ content: i18n.__('messages.selfRoleExpiryInfo', {
    rowTempRole: row[0].temporaryRole,
    finalDate,
    startDateTime,
  }), ephemeral: true });
}

async function handleMap(interaction) {
  const registration = await ensureRegistered(interaction);
  if (!registration) return;

  if (config.mapMain.enabled !== 'yes') {
    await interaction.reply({ content: i18n.__('errors.mapDisabled'), ephemeral: true });
    return;
  }

  await interaction.reply({ content: i18n.__('messages.webmap', { configMapUrl: config.mapMain.url }), ephemeral: true });
}

async function handlePaypal(interaction) {
  const registration = await ensureRegistered(interaction);
  if (!registration) return;

  if (config.paypal.enabled !== 'yes') {
    await interaction.reply({ content: i18n.__('errors.paypalDisabled'), ephemeral: true });
    return;
  }

  await interaction.reply({ content: i18n.__('messages.paypalLink', { configPaypalUrl: config.paypal.url }), ephemeral: true });
}

async function handleHelp(interaction) {
  const registration = await ensureRegistered(interaction);
  if (!registration) return;

  const scope = interaction.options.getString('scope');
  if (scope === 'mods') {
    await interaction.reply({ content: i18n.__('messages.helpMods', { configCMDPrefix: config.cmdPrefix }), ephemeral: true });
    return;
  }

  await interaction.reply({ content: i18n.__('messages.helpUser', { configCMDPrefix: config.cmdPrefix, mapEnabled: config.mapMain.enabled, paypalEnabled: config.paypal.enabled }), ephemeral: true });
}

async function handleInteraction(interaction) {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'register') {
      await handleRegister(interaction);
      return;
    }

    if (interaction.commandName === 'temprole') {
      await handleTemprole(interaction);
      return;
    }

    if (interaction.commandName === 'check') {
      await handleCheck(interaction);
      return;
    }

    if (interaction.commandName === 'map') {
      await handleMap(interaction);
      return;
    }

    if (interaction.commandName === 'paypal') {
      await handlePaypal(interaction);
      return;
    }

    if (interaction.commandName === 'help') {
      await handleHelp(interaction);
    }
  }

  if (interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu()) {
    const session = registerSessions.get(interaction.user.id);
    if (!session) {
      await interaction.reply({ content: i18n.__('register.sessionExpired'), ephemeral: true });
      return;
    }

    const [scope] = interaction.values;
    if (interaction.customId === 'register:adminRole') {
      session.adminRoleId = scope;
    } else if (interaction.customId === 'register:modRole') {
      session.modRoleId = scope || null;
    } else if (interaction.customId === 'register:mainChannel') {
      session.mainChannelId = scope;
    } else if (interaction.customId === 'register:adminChannel') {
      session.adminChannelId = scope;
    }

    registerSessions.set(interaction.user.id, session);
    await interaction.deferUpdate();
    return;
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'register:cancel') {
      registerSessions.delete(interaction.user.id);
      await interaction.reply({ content: i18n.__('register.cancelled'), ephemeral: true });
      return;
    }

    if (interaction.customId === 'register:save') {
      await handleRegisterSave(interaction);
    }
  }
}

module.exports = {
  registerSlashCommands,
  handleInteraction,
};
