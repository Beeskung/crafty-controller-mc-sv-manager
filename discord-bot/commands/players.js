const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getServerStats } = require('../services/craftyApi');
const { checkPermission } = require('../utils/permissions');
const { COLORS, parsePlayers, createProgressBar } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('players')
    .setDescription('[Admin+] ดูรายชื่อผู้เล่นที่ออนไลน์อยู่และการใช้ทรัพยากร'),
  async execute(interaction) {
    if (!(await checkPermission(interaction, 'admin'))) return;

    await interaction.deferReply();
    const s = await getServerStats();
    const players = parsePlayers(s.players);

    const listFormatted = players.length > 0
      ? players.map((name, idx) => `> **${idx + 1}.** 🟩 \`${name}\``).join('\n')
      : '> *ไม่มีผู้เล่นออนไลน์อยู่ในขณะนี้*';

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'MC-Sv-CCU • Player Monitor' })
      .setTitle(`👥 รายชื่อผู้เล่นออนไลน์ (${s.online ?? 0} / ${s.max ?? 0} คน)`)
      .setDescription(listFormatted)
      .setColor(s.running ? COLORS.ONLINE : COLORS.NEUTRAL)
      .addFields(
        { name: '⚡ CPU', value: createProgressBar(s.cpu, 8), inline: true },
        { name: '🧠 RAM', value: `\`${s.mem || '0 MB'}\``, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};