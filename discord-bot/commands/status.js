const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getServerStats } = require('../services/craftyApi');
const { COLORS, createProgressBar } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('status')
    .setDescription('ตรวจสอบสถานะเซิร์ฟเวอร์ Minecraft และทรัพยากรเครื่อง'),
  async execute(interaction) {
    await interaction.deferReply();
    const s = await getServerStats();
    const online = Number(s.online || 0);
    const max = Number(s.max || 0);
    const pct = max > 0 ? (online / max) * 100 : 0;

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'MC-Sv-CCU • Live Telemetry' })
      .setTitle(`🎮 สถานะเซิร์ฟเวอร์: ${s.server_id?.server_name || 'CrazyCraft-Updated'}`)
      .setColor(s.running ? COLORS.ONLINE : COLORS.OFFLINE)
      .addFields(
        { name: '🔌 สถานะการทำงาน', value: s.running ? '🟢 **ออนไลน์ (Online)**' : '🔴 **ออฟไลน์ (Offline)**', inline: true },
        { name: '📦 เวอร์ชัน', value: `\`${s.version || '1.16.5'}\``, inline: true },
        { name: '👥 จำนวนผู้เล่น', value: `**${online} / ${max}** คน\n${createProgressBar(pct, 8)}`, inline: false },
        { name: '⚡ CPU Load', value: createProgressBar(s.cpu, 8), inline: true },
        { name: '🧠 RAM Usage', value: `\`${s.mem || '0 MB'}\``, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};