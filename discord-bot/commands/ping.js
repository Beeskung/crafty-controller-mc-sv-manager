const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getServerStats } = require('../services/craftyApi');
const { COLORS } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('ทดสอบความเร็วการตอบสนองของบอทและ Crafty API'),
  async execute(interaction) {
    const start = Date.now();
    let apiStatus = '🟢 เชื่อมต่อปกติ';
    let apiMs = 0;

    try {
      await getServerStats(true);
      apiMs = Date.now() - start;
    } catch (e) {
      apiStatus = `🔴 ขัดข้อง (${e.response?.status || 'Timeout'})`;
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'MC-Sv-CCU • System Latency' })
      .setTitle('🏓 Pong! ผลการทดสอบการเชื่อมต่อ')
      .setColor(COLORS.PRIMARY)
      .addFields(
        { name: '📡 Discord Gateway', value: `\`${interaction.client.ws.ping} ms\``, inline: true },
        { name: '⚡ Crafty API', value: `\`${apiMs} ms\``, inline: true },
        { name: '🔌 สถานะ API', value: apiStatus, inline: true }
      )
      .setTimestamp();
    await interaction.reply({ embeds: [embed] });
  }
};