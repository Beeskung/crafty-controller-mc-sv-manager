const {
  Client,
  GatewayIntentBits,
  Events,
  MessageFlags,
  REST,
  Routes,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config/config');
const { loadCommands } = require('./handlers/commandHandler');
const { craftyRequest, getServerStats } = require('./services/craftyApi');
const { setupWebhookServer } = require('./services/webhookServer');
const { isAdmin, isSuperAdmin } = require('./utils/permissions');
const { buildLiveDashboard } = require('./utils/ui');
const { sanitizeMcText, createAuditHash } = require('./utils/security');

process.on('unhandledRejection', err => console.error('[Self-Heal] Unhandled Rejection:', err));
process.on('uncaughtException', err => console.error('[Self-Heal] Uncaught Exception:', err));

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const commands = loadCommands();

const DASHBOARD_STATE_FILE = path.join(__dirname, 'dashboard_state.json');
let expectedServerRunning = false;
let manualStopFlag = false;
let selfHealEnabled = true;

client.once(Events.ClientReady, async c => {
  console.log(`✅ Discord Bot ออนไลน์ในชื่อ: ${c.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(config.token);
  const body = commands.map(cmd => cmd.data.toJSON());

  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body });
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), { body });
  }

  setupWebhookServer();

  try {
    const s = await getServerStats(true);
    expectedServerRunning = Boolean(s.running);
  } catch (_) {}

  // ลูป Watchdog + Auto-Refresh Dashboard ทุก 20 วินาที
  setInterval(async () => {
    try {
      fs.writeFileSync('/tmp/bot_healthy', Date.now().toString());
      const s = await getServerStats(true);
      const isRunning = Boolean(s.running);

      if (isRunning) {
        expectedServerRunning = true;
        manualStopFlag = false;
      } else if (selfHealEnabled && expectedServerRunning && !manualStopFlag) {
        console.warn('[Self-Healing] ตรวจพบเซิร์ฟเวอร์ดับกะทันหัน กำลังสั่งเปิดใหม่...');
        await craftyRequest('post', `/servers/${config.serverId}/action/start_server`);
        expectedServerRunning = true;
      }

      if (fs.existsSync(DASHBOARD_STATE_FILE)) {
        const state = JSON.parse(fs.readFileSync(DASHBOARD_STATE_FILE, 'utf-8'));
        const ch = await client.channels.fetch(state.channelId).catch(() => null);
        const msg = ch ? await ch.messages.fetch(state.messageId).catch(() => null) : null;
        if (msg) {
          await msg.edit(buildLiveDashboard(s, selfHealEnabled));
        } else {
          fs.unlinkSync(DASHBOARD_STATE_FILE);
        }
      }
    } catch (_) {}
  }, 20000);
});

client.on(Events.InteractionCreate, async interaction => {
  const uid = interaction.user.id;

  // 1. จัดการปุ่มกดบน Live Dashboard
  if (interaction.isButton()) {
    if (!isAdmin(uid)) {
      return interaction.reply({ content: '⛔ คุณไม่มีสิทธิ์กดปุ่มควบคุม', flags: MessageFlags.Ephemeral });
    }
    if (['dash_kill', 'dash_console', 'dash_selfheal'].includes(interaction.customId) && !isSuperAdmin(uid)) {
      return interaction.reply({ content: '⛔ ปุ่มนี้สงวนสิทธิ์เฉพาะ **Super Admin** เท่านั้น', flags: MessageFlags.Ephemeral });
    }

    if (interaction.customId === 'dash_console') {
      const modal = new ModalBuilder().setCustomId('modal_console_submit').setTitle('💻 ส่งคำสั่งเข้า Console');
      const input = new TextInputBuilder()
        .setCustomId('console_cmd_text')
        .setLabel('คำสั่ง Minecraft (ไม่ต้องใส่ / นำหน้า)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      return interaction.showModal(modal);
    }

    await interaction.deferUpdate();
    try {
      const actionMap = {
        dash_start: 'start_server',
        dash_stop: 'stop_server',
        dash_restart: 'restart_server',
        dash_backup: 'backup_server',
        dash_kill: 'kill_server'
      };

      if (interaction.customId === 'dash_selfheal') {
        selfHealEnabled = !selfHealEnabled;
      } else if (actionMap[interaction.customId]) {
        const act = actionMap[interaction.customId];
        manualStopFlag = act === 'stop_server' || act === 'kill_server';
        expectedServerRunning = !manualStopFlag;
        await craftyRequest('post', `/servers/${config.serverId}/action/${act}`);
        createAuditHash(uid, act);
      }

      await new Promise(r => setTimeout(r, 1200));
      const stats = await getServerStats(true);
      return interaction.editReply(buildLiveDashboard(stats, selfHealEnabled));
    } catch (err) {
      return interaction.followUp({ content: `❌ ดำเนินการไม่สำเร็จ: ${err.message}`, flags: MessageFlags.Ephemeral });
    }
  }

  // 2. จัดการ Console Modal
  if (interaction.isModalSubmit() && interaction.customId === 'modal_console_submit') {
    if (!isSuperAdmin(uid)) {
      return interaction.reply({ content: '⛔ สงวนสิทธิ์เฉพาะ Super Admin', flags: MessageFlags.Ephemeral });
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const cmdText = sanitizeMcText(interaction.fields.getTextInputValue('console_cmd_text'), 250);
    await craftyRequest('post', `/servers/${config.serverId}/stdin`, cmdText);
    const auditId = createAuditHash(uid, `modal:${cmdText}`);
    return interaction.editReply(`💻 ส่งคำสั่งสำเร็จ: \`${cmdText}\` (Audit \`#${auditId}\`)`);
  }

  // 3. จัดการ Slash Commands
  if (!interaction.isChatInputCommand()) return;
  const command = commands.find(c => c.data.name === interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (err) {
    console.error(`[Command Error:${interaction.commandName}]`, err);
    const errDetail = err.response?.data?.error_data || err.message;
    const msg = { content: `❌ เกิดข้อผิดพลาด: \`${errDetail}\``, flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) await interaction.followUp(msg);
    else await interaction.reply(msg);
  }
});

client.login(config.token);