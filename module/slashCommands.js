const {
  SlashCommandBuilder,
  REST,
  Routes,
  ActionRowBuilder,
  PermissionsBitField,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  MessageFlags,
} = require('discord.js');
const config = require('../config/config.json');
const sqlConnectionDiscord = require('./database/database_discord');
const helper = require('./helper');
const i18n = require('./i18n');

const registerSessions = new Map();
const tempRoleSessions = new Map();

const commands = [
  new SlashCommandBuilder()
    .setName('register')
    .setDescription('Set up this server for DiscordRoleManager'),
  new SlashCommandBuilder()
    .setName('temprole')
    .setDescription('Manage temporary roles')
    .addSubcommand((sub) => sub
      .setName('add')
      .setDescription('Add or extend a temporary role'))
    .addSubcommand((sub) => sub
      .setName('remove')
      .setDescription('Remove a temporary role from a user'))
    .addSubcommand((sub) => sub
      .setName('check')
      .setDescription('Check a user\'s temporary role')),
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
    await interaction.reply({ content: i18n.__('errors.guildOnly'), flags: MessageFlags.Ephemeral });
    return;
  }

  if (!hasAdminPermission(interaction)) {
    await interaction.reply({ content: i18n.__('errors.notAllowed'), flags: MessageFlags.Ephemeral });
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
    flags: MessageFlags.Ephemeral,
  });
}
async function handleRegisterSave(interaction) {
  const session = registerSessions.get(interaction.user.id);
  if (!session) {
    await interaction.reply({ content: i18n.__('register.sessionExpired'), flags: MessageFlags.Ephemeral });
    return;
  }

  const { adminRoleId, modRoleId, mainChannelId, adminChannelId } = session;
  if (!adminRoleId || !mainChannelId || !adminChannelId) {
    await interaction.reply({ content: i18n.__('register.missingRequired'), flags: MessageFlags.Ephemeral });
    return;
  }

  const adminRole = interaction.guild.roles.cache.get(adminRoleId);
  const modRole = modRoleId ? interaction.guild.roles.cache.get(modRoleId) : null;
  const mainChannel = interaction.guild.channels.cache.get(mainChannelId);
  const adminChannel = interaction.guild.channels.cache.get(adminChannelId);

  if (!adminRole || (modRoleId && !modRole) || !mainChannel || !adminChannel) {
    await interaction.reply({ content: i18n.__('register.invalidInput'), flags: MessageFlags.Ephemeral });
    return;
  }

  const existing = await isRegistered(interaction.guild.id);
  const modRoleValue = modRoleId ? `"${modRoleId}"` : 'NULL';
  if (existing) {
    await sqlConnectionDiscord.query(
      `UPDATE registration SET guild_name="${interaction.guild.name}", mainChannelID="${mainChannelId}", adminRoleName="${adminRoleId}", modRoleName=${modRoleValue}, adminChannelID="${adminChannelId}" WHERE guild_id="${interaction.guild.id}"`,
    );
    await interaction.reply({ content: i18n.__('register.updated'), flags: MessageFlags.Ephemeral });
    registerSessions.delete(interaction.user.id);
    return;
  }

  const values = `${interaction.guild.id},'${interaction.guild.name}','${mainChannelId}','${adminRoleId}',${modRoleValue},'${adminChannelId}'`;
  await sqlConnectionDiscord.query(`INSERT INTO registration (guild_id, guild_name, mainChannelID, adminRoleName, modRoleName, adminChannelID) VALUES(${values});`);
  await interaction.reply({ content: i18n.__('register.success'), flags: MessageFlags.Ephemeral });
  registerSessions.delete(interaction.user.id);
}

async function ensureRegistered(interaction) {
  if (!interaction.guild) {
    await interaction.reply({ content: i18n.__('errors.guildOnly'), flags: MessageFlags.Ephemeral });
    return false;
  }

  const row = await isRegistered(interaction.guild.id);
  if (!row) {
    await interaction.reply({ content: i18n.__('errors.registerRequired'), flags: MessageFlags.Ephemeral });
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
    await interaction.reply({ content: i18n.__('errors.notAllowed'), flags: MessageFlags.Ephemeral });
    return;
  }

  const openTempRoleForm = async (action) => {
    tempRoleSessions.set(interaction.user.id, {
      userId: null,
      roleId: null,
      days: null,
      action,
    });

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('temprole:user')
      .setPlaceholder(i18n.__('temprole.userPlaceholder'))
      .setMinValues(1)
      .setMaxValues(1);

    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId('temprole:role')
      .setPlaceholder(i18n.__('temprole.rolePlaceholder'))
      .setMinValues(0)
      .setMaxValues(1);

    const cancelButton = new ButtonBuilder()
      .setCustomId('temprole:cancel')
      .setLabel(i18n.__('temprole.cancel'))
      .setStyle(ButtonStyle.Secondary);

    const components = [
      new ActionRowBuilder().addComponents(userSelect),
      new ActionRowBuilder().addComponents(roleSelect),
    ];

    if (action === 'add') {
      const daysSelect = new StringSelectMenuBuilder()
        .setCustomId('temprole:daysSelect')
        .setPlaceholder(i18n.__('temprole.daysPlaceholder'))
        .addOptions(
          { label: '7', value: '7' },
          { label: '14', value: '14' },
          { label: '30', value: '30' },
          { label: '60', value: '60' },
          { label: '90', value: '90' },
          { label: '180', value: '180' },
          { label: '365', value: '365' },
          { label: i18n.__('temprole.customDays'), value: 'custom' },
        );

      const daysButton = new ButtonBuilder()
        .setCustomId('temprole:setDays')
        .setLabel(i18n.__('temprole.setDays'))
        .setStyle(ButtonStyle.Primary);

      const saveButton = new ButtonBuilder()
        .setCustomId('temprole:save')
        .setLabel(i18n.__('temprole.save'))
        .setStyle(ButtonStyle.Success);

      components.push(new ActionRowBuilder().addComponents(daysSelect));
      components.push(new ActionRowBuilder().addComponents(daysButton, saveButton, cancelButton));
      await interaction.reply({
        content: i18n.__('temprole.instructionsAdd'),
        components,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const actionButton = new ButtonBuilder()
      .setCustomId(action === 'remove' ? 'temprole:remove' : 'temprole:check')
      .setLabel(i18n.__(action === 'remove' ? 'temprole.remove' : 'temprole.check'))
      .setStyle(action === 'remove' ? ButtonStyle.Danger : ButtonStyle.Primary);

    components.push(new ActionRowBuilder().addComponents(actionButton, cancelButton));
    await interaction.reply({
      content: i18n.__(action === 'remove' ? 'temprole.instructionsRemove' : 'temprole.instructionsCheck'),
      components,
      flags: MessageFlags.Ephemeral,
    });
  };

  if (sub === 'check') {
    await openTempRoleForm('check');
    return;
  }

  if (sub === 'remove') {
    await openTempRoleForm('remove');
    return;
  }

  if (sub === 'add') {
    await openTempRoleForm('add');
  }
}

async function handleCheck(interaction) {
  const registration = await ensureRegistered(interaction);
  if (!registration) return;

  const g = interaction.guild;
  const m = interaction.member;
  const role = interaction.options.getRole('role') || g.roles.cache.get(config.defaultDonatorRole);

  if (!role) {
    await interaction.reply({ content: i18n.__('errors.checkRolePromptMention', { configCMDPrefix: config.cmdPrefix }), flags: MessageFlags.Ephemeral });
    return;
  }

  const row = await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${m.id}" AND temporaryRole="${role.name}" AND guild_id="${g.id}"`);
  if (!row[0]) {
    await interaction.reply({ content: i18n.__('errors.authorNotInDbForRole', { mAuthorUsername: interaction.user.username, daRole: role.name }), flags: MessageFlags.Ephemeral });
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
  }), flags: MessageFlags.Ephemeral });
}

async function handleMap(interaction) {
  const registration = await ensureRegistered(interaction);
  if (!registration) return;

  if (config.mapMain.enabled !== 'yes') {
    await interaction.reply({ content: i18n.__('errors.mapDisabled'), flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ content: i18n.__('messages.webmap', { configMapUrl: config.mapMain.url }), flags: MessageFlags.Ephemeral });
}

async function handlePaypal(interaction) {
  const registration = await ensureRegistered(interaction);
  if (!registration) return;

  if (config.paypal.enabled !== 'yes') {
    await interaction.reply({ content: i18n.__('errors.paypalDisabled'), flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ content: i18n.__('messages.paypalLink', { configPaypalUrl: config.paypal.url }), flags: MessageFlags.Ephemeral });
}

async function handleHelp(interaction) {
  const registration = await ensureRegistered(interaction);
  if (!registration) return;

  const scope = interaction.options.getString('scope');
  if (scope === 'mods') {
    await interaction.reply({ content: i18n.__('messages.helpMods', { configCMDPrefix: config.cmdPrefix }), flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.reply({ content: i18n.__('messages.helpUser', { configCMDPrefix: config.cmdPrefix, mapEnabled: config.mapMain.enabled, paypalEnabled: config.paypal.enabled }), flags: MessageFlags.Ephemeral });
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
      if (interaction.customId.startsWith('register:')) {
        const session = registerSessions.get(interaction.user.id);
        if (!session) {
          await interaction.reply({ content: i18n.__('register.sessionExpired'), flags: MessageFlags.Ephemeral });
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
  }

  if (interaction.isUserSelectMenu() || interaction.isRoleSelectMenu()) {
    const session = tempRoleSessions.get(interaction.user.id);
    if (!session) {
      return;
    }

    const [value] = interaction.values;
    if (interaction.customId === 'temprole:user') {
      session.userId = value;
    } else if (interaction.customId === 'temprole:role') {
      session.roleId = value || null;
    }

    tempRoleSessions.set(interaction.user.id, session);
    await interaction.deferUpdate();
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'temprole:daysSelect') {
    const session = tempRoleSessions.get(interaction.user.id);
    if (!session) {
      await interaction.reply({ content: i18n.__('temprole.sessionExpired'), flags: MessageFlags.Ephemeral });
      return;
    }

    const [value] = interaction.values;
    if (value === 'custom') {
      const modal = new ModalBuilder()
        .setCustomId('temprole:daysModal')
        .setTitle(i18n.__('temprole.daysTitle'));

      const daysInput = new TextInputBuilder()
        .setCustomId('temprole:days')
        .setLabel(i18n.__('temprole.daysLabel'))
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('30')
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(daysInput));
      await interaction.showModal(modal);
      return;
    }

    session.days = Number(value);
    tempRoleSessions.set(interaction.user.id, session);
    await interaction.reply({ content: i18n.__('temprole.daysSaved', { days: session.days }), flags: MessageFlags.Ephemeral });
  }

  if (interaction.isButton()) {
    if (interaction.customId === 'register:cancel') {
      registerSessions.delete(interaction.user.id);
      await interaction.reply({ content: i18n.__('register.cancelled'), flags: MessageFlags.Ephemeral });
      return;
    }

    if (interaction.customId === 'register:save') {
      await handleRegisterSave(interaction);
      return;
    }

    if (interaction.customId === 'temprole:cancel') {
      tempRoleSessions.delete(interaction.user.id);
      await interaction.reply({ content: i18n.__('temprole.cancelled'), flags: MessageFlags.Ephemeral });
      return;
    }

    if (interaction.customId === 'temprole:setDays') {
      try {
        const modal = new ModalBuilder()
          .setCustomId('temprole:daysModal')
          .setTitle(i18n.__('temprole.daysTitle'));

        const daysInput = new TextInputBuilder()
          .setCustomId('temprole:days')
          .setLabel(i18n.__('temprole.daysLabel'))
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('30')
          .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(daysInput));
        await interaction.showModal(modal);
      } catch (error) {
        helper.myLogger.error(helper.GetTimestamp() + `[TEMPOROLE] Show modal failed: ${error}`);
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: i18n.__('temprole.modalFailed'), flags: MessageFlags.Ephemeral });
        }
      }
      return;
    }

    if (interaction.customId === 'temprole:save') {
      const session = tempRoleSessions.get(interaction.user.id);
      if (!session) {
        await interaction.reply({ content: i18n.__('temprole.sessionExpired'), flags: MessageFlags.Ephemeral });
        return;
      }

      if (session.action !== 'add') {
        await interaction.reply({ content: i18n.__('temprole.sessionExpired'), flags: MessageFlags.Ephemeral });
        return;
      }

      const { userId, roleId, days } = session;
      if (!userId || !days) {
        await interaction.reply({ content: i18n.__('temprole.missingRequired'), flags: MessageFlags.Ephemeral });
        return;
      }

      const g = interaction.guild;
      const m = interaction.member;
      const role = roleId ? g.roles.cache.get(roleId) : g.roles.cache.get(config.defaultDonatorRole);
      if (!role) {
        await interaction.reply({ content: i18n.__('temprole.missingRole'), flags: MessageFlags.Ephemeral });
        return;
      }

      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      }

      const respond = async (payload) => {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(payload);
          return;
        }
        await interaction.reply(payload);
      };

      const mentioned = await g.members.fetch(userId);

      const notifyMember = async (content) => {
        await mentioned.send(content).catch((err) => {
          helper.myLogger.error(helper.GetTimestamp() + i18n.__('errors.dmFailed', {
            memberID: mentioned.id,
            err,
          }));
        });
      };

      const row = await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND temporaryRole="${role.name}" AND guild_id="${g.id}"`);
      const now = new Date().getTime();

      if (!row[0]) {
        const finalDate = now + (Number(days) * 86400000);
        const finalDateDisplay = await helper.formatTimeString(new Date(finalDate));
        const name = mentioned.user.username.replace(/[^a-zA-Z0-9]/g, '');
        const values = `${mentioned.user.id},'${role.name}',${Math.round(now / 1000)},${Math.round(finalDate / 1000)},${m.id},0,'${name}',0,${g.id}`;
        try {
          await sqlConnectionDiscord.query(`INSERT INTO temporary_roles (userID, temporaryRole, startDate, endDate, addedBy, notified, username, leftServer, guild_id) VALUES(${values}) ON DUPLICATE KEY UPDATE startDate=VALUES(startDate), endDate=VALUES(endDate), addedBy=VALUES(addedBy), notified=0, username=VALUES(username), leftServer=0, guild_id=VALUES(guild_id);`);
          try {
            await mentioned.roles.add(role);
          } catch (err) {
            helper.myLogger.error(err);
            await sqlConnectionDiscord.query(`DELETE FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}" AND temporaryRole="${role.name}"`);
            const reason = err?.code === 50013 ? i18n.__('errors.missingRolePermissions') : (err?.message || 'Unknown error');
            await respond({
              content: i18n.__('errors.roleAssignFailed', {
                rNameName: role.name,
                memberUsername: mentioned.user.username,
                reason,
              }),
              flags: MessageFlags.Ephemeral,
            });
            return;
          }
        } catch (error) {
          helper.myLogger.error(helper.GetTimestamp() + `[TEMPOROLE] Insert failed: ${error}`);
          await respond({ content: i18n.__('temprole.saveFailed'), flags: MessageFlags.Ephemeral });
          return;
        }

        await notifyMember(i18n.__('messages.tempRoleAssigned', {
          mentionedUsername: mentioned.user.username,
          daRole: role.name,
          finalDateDisplay,
        }));

        await respond({ content: i18n.__('temprole.assigned', {
          mentionedUsername: mentioned.user.username,
          daRole: role.name,
          finalDateDisplay,
        }), flags: MessageFlags.Ephemeral });
      } else {
        let finalDate = Number(row[0].endDate * 1000) + Number(days * 86400000);
        const name = mentioned.user.username.replace(/[^a-zA-Z0-9]/g, '');
        try {
          await sqlConnectionDiscord.query(`UPDATE temporary_roles SET endDate="${Math.round(finalDate / 1000)}", notified=0, username="${name}" WHERE userID="${mentioned.id}" AND temporaryRole="${role.name}" AND guild_id="${g.id}"`);
        } catch (error) {
          helper.myLogger.error(helper.GetTimestamp() + `[TEMPOROLE] Update failed: ${error}`);
          await respond({ content: i18n.__('temprole.saveFailed'), flags: MessageFlags.Ephemeral });
          return;
        }
        finalDate = await helper.formatTimeString(new Date(finalDate));

        await notifyMember(i18n.__('dm.accessExtended', {
          mentionedUsername: mentioned.user.username,
          finalDate,
        }));

        await respond({ content: i18n.__('temprole.extended', {
          mentionedUsername: mentioned.user.username,
          daRole: role.name,
          finalDate,
        }), flags: MessageFlags.Ephemeral });
      }

      tempRoleSessions.delete(interaction.user.id);
      return;
    }

    if (interaction.customId === 'temprole:remove') {
      const session = tempRoleSessions.get(interaction.user.id);
      if (!session) {
        await interaction.reply({ content: i18n.__('temprole.sessionExpired'), flags: MessageFlags.Ephemeral });
        return;
      }

      const { userId, roleId } = session;
      if (!userId) {
        await interaction.reply({ content: i18n.__('temprole.missingUser'), flags: MessageFlags.Ephemeral });
        return;
      }

      const g = interaction.guild;
      const m = interaction.member;
      const role = roleId ? g.roles.cache.get(roleId) : g.roles.cache.get(config.defaultDonatorRole);
      if (!role) {
        await interaction.reply({ content: i18n.__('temprole.missingRole'), flags: MessageFlags.Ephemeral });
        return;
      }

      const mentioned = await g.members.fetch(userId);
      const row = await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}" AND temporaryRole="${role.name}"`);
      if (!row[0]) {
        await interaction.reply({ content: i18n.__('errors.notInDbForRole', { mentionedUsername: mentioned.user.username, daRole: role.name }), flags: MessageFlags.Ephemeral });
        return;
      }

      try {
        await mentioned.roles.remove(role, 'Donation Expired');
      } catch (err) {
        helper.myLogger.error(err);
        const reason = err?.code === 50013 ? i18n.__('errors.missingRolePermissions') : (err?.message || 'Unknown error');
        await interaction.reply({
          content: i18n.__('errors.roleRemoveFailed', {
            rNameName: role.name,
            memberUsername: mentioned.user.username,
            reason,
          }),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      await sqlConnectionDiscord.query(`DELETE FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}" AND temporaryRole="${role.name}"`);

      helper.myLogger.log(helper.GetTimestamp() + i18n.__('admin.tempRole.removedAccessLog', {
        mUserUsername: m.user.username,
        mID: m.id,
        mentionedUsername: mentioned.user.username,
        mentionedID: mentioned.id,
      }));

      await interaction.reply({ content: i18n.__('admin.tempRole.removedAccessNotice', {
        mentionedUsername: mentioned.user.username,
        theirRoleName: role.name,
      }), flags: MessageFlags.Ephemeral });

      tempRoleSessions.delete(interaction.user.id);
      return;
    }

    if (interaction.customId === 'temprole:check') {
      const session = tempRoleSessions.get(interaction.user.id);
      if (!session) {
        await interaction.reply({ content: i18n.__('temprole.sessionExpired'), flags: MessageFlags.Ephemeral });
        return;
      }

      const { userId, roleId } = session;
      if (!userId) {
        await interaction.reply({ content: i18n.__('temprole.missingUser'), flags: MessageFlags.Ephemeral });
        return;
      }

      const g = interaction.guild;
      const role = roleId ? g.roles.cache.get(roleId) : g.roles.cache.get(config.defaultDonatorRole);
      if (!role) {
        await interaction.reply({ content: i18n.__('temprole.missingRole'), flags: MessageFlags.Ephemeral });
        return;
      }

      const mentioned = await g.members.fetch(userId);
      const row = await sqlConnectionDiscord.query(`SELECT * FROM temporary_roles WHERE userID="${mentioned.id}" AND guild_id="${g.id}" AND temporaryRole="${role.name}"`);
      if (!row[0]) {
        await interaction.reply({ content: i18n.__('errors.notInDbForRole', { mentionedUsername: mentioned.user.username, daRole: role.name }), flags: MessageFlags.Ephemeral });
        return;
      }

      const startDateVal = new Date(row[0].startDate * 1000);
      const endDateVal = new Date(row[0].endDate * 1000);
      const startDateTime = await helper.formatTimeString(startDateVal);
      const finalDate = await helper.formatTimeString(endDateVal);

      await interaction.reply({ content: i18n.__('messages.roleExpiryInfo', {
        mentionedUsername: mentioned.user.username,
        rowTempRole: row[0].temporaryRole,
        finalDate,
        startDateTime,
      }), flags: MessageFlags.Ephemeral });

      tempRoleSessions.delete(interaction.user.id);
      return;
    }
  }

  if (interaction.isModalSubmit() && interaction.customId === 'temprole:daysModal') {
    const session = tempRoleSessions.get(interaction.user.id);
    if (!session) {
      await interaction.reply({ content: i18n.__('temprole.sessionExpired'), flags: MessageFlags.Ephemeral });
      return;
    }

    const daysValue = interaction.fields.getTextInputValue('temprole:days').trim();
    const days = Number(daysValue);
    if (!Number.isInteger(days) || days <= 0) {
      await interaction.reply({ content: i18n.__('temprole.invalidDays'), flags: MessageFlags.Ephemeral });
      return;
    }

    session.days = days;
    tempRoleSessions.set(interaction.user.id, session);
    await interaction.reply({ content: i18n.__('temprole.daysSaved', { days }), flags: MessageFlags.Ephemeral });
  }
}

module.exports = {
  registerSlashCommands,
  handleInteraction,
};
