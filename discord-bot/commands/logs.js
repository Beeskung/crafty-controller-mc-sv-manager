const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../config/config');
const { craftyRequest } = require('../services/craftyApi');
const { checkPermission } = require('../utils/permissions');
const { COLORS } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logs')
    .setDescription('[Super Admin] ดึง Console Log ล่าสุดจากเซิร์ฟเวอร์')
    .addIntegerOption(opt => opt.setName('lines').setDescription('จำนวนบรรทัด (5-30)').setMinValue(5).setMaxValue(30).setRequired(false)),
  async execute(interaction) {
    if (!(await checkPermission(interaction, 'superadmin'))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const lines = interaction.options.getInteger('lines') || 15;
    const res = await craftyRequest('get', `/servers/${config.serverId}/logs`);
    const raw = Array.isArray(res.data.data) ? res.data.data : [];
    const text = raw.slice(-lines).map(l => String(l).replace(/\x1b\[[0-9;]*m/g, '')).join('\n').slice(-1800);

    const embed = new EmbedBuilder()
      .setTitle(`📜 Console Logs ล่าสุด (${lines} บรรทัด)`)
      .setDescription(`\`\`\`log\n${text || 'ไม่มีข้อมูล Log'}\n\`\`\``)
      .setColor(COLORS.NEUTRAL)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};