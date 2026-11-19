const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const COLORS = {
  ONLINE: 0x22C55E,
  OFFLINE: 0xEF4444,
  PRIMARY: 0x3B82F6,
  WARNING: 0xF59E0B,
  SUPER: 0xA855F7,
  NEUTRAL: 0x64748B
};

function createProgressBar(percent, length = 10) {
  const safePct = Math.max(0, Math.min(100, Number(percent) || 0));
  const filled = Math.round((safePct / 100) * length);
  return `\`${'▰'.repeat(filled)}${'▱'.repeat(length - filled)}\` **${safePct.toFixed(1)}%**`;
}

function parsePlayers(rawPlayers) {
  if (!rawPlayers) return [];
  if (Array.isArray(rawPlayers)) return rawPlayers;
  if (typeof rawPlayers === 'string') {
    try {
      const parsed = JSON.parse(rawPlayers.replace(/'/g, '"'));
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {
      return rawPlayers.replace(/^\[|\]$/g, '').split(',').map(p => p.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    }
  }
  return [];
}

function buildLiveDashboard(stats, selfHealEnabled = true) {
  const isRunning = Boolean(stats.running);
  const serverName = stats.server_id?.server_name || 'CrazyCraft-Updated';
  const online = Number(stats.online || 0);
  const max = Number(stats.max || 0);
  const playerPct = max > 0 ? (online / max) * 100 : 0;

  const embed = new EmbedBuilder()
    .setAuthor({ name: 'MC-Sv-CCU • Control Center', iconURL: 'https://craftycontrol.com/assets/images/crafty_logo.png' })
    .setTitle(`🖥️ แผงควบคุมเซิร์ฟเวอร์ — ${serverName}`)
    .setDescription(isRunning ? '🟢 **เซิร์ฟเวอร์เปิดให้บริการตามปกติ**' : '🔴 **เซิร์ฟเวอร์ปิดอยู่ในขณะนี้**')
    .setColor(isRunning ? COLORS.ONLINE : COLORS.OFFLINE)
    .addFields(
      { name: '👥 ผู้เล่นออนไลน์', value: `**${online} / ${max}** คน\n${createProgressBar(playerPct, 8)}`, inline: true },
      { name: '⚡ ภาระงาน CPU', value: `${createProgressBar(stats.cpu, 8)}`, inline: true },
      { name: '🧠 หน่วยความจำ RAM', value: `\`${stats.mem || '0 MB'}\`\n📦 Ver: \`${stats.version || '1.16.5'}\``, inline: true },
      { name: '🛡️ ระบบ Self-Healing Watchdog', value: selfHealEnabled ? '✅ **เปิดทำงานอัตโนมัติ**' : '⏸️ **ปิดชั่วคราว**', inline: false }
    )
    .setFooter({ text: 'อัปเดตสดทุก 20 วินาที • แถวบน: Admin+ | แถวล่าง: Super Admin' })
    .setTimestamp();

  const adminRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dash_start').setLabel('Start').setEmoji('🟢').setStyle(ButtonStyle.Success).setDisabled(isRunning),
    new ButtonBuilder().setCustomId('dash_stop').setLabel('Stop').setEmoji('🔴').setStyle(ButtonStyle.Danger).setDisabled(!isRunning),
    new ButtonBuilder().setCustomId('dash_restart').setLabel('Restart').setEmoji('🔄').setStyle(ButtonStyle.Primary).setDisabled(!isRunning),
    new ButtonBuilder().setCustomId('dash_backup').setLabel('Backup').setEmoji('💾').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dash_refresh').setLabel('Refresh').setEmoji('🔁').setStyle(ButtonStyle.Secondary)
  );

  const superAdminRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dash_kill').setLabel('Kill Server').setEmoji('💀').setStyle(ButtonStyle.Danger).setDisabled(!isRunning),
    new ButtonBuilder().setCustomId('dash_console').setLabel('Console').setEmoji('💻').setStyle(ButtonStyle.Secondary).setDisabled(!isRunning),
    new ButtonBuilder()
      .setCustomId('dash_selfheal')
      .setLabel(selfHealEnabled ? 'Self-Heal: ON' : 'Self-Heal: OFF')
      .setEmoji('🛡️')
      .setStyle(selfHealEnabled ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  return { embeds: [embed], components: [adminRow, superAdminRow] };
}

module.exports = { COLORS, createProgressBar, parsePlayers, buildLiveDashboard };