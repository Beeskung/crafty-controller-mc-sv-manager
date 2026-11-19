const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { getServerStats } = require('../services/craftyApi');
const { checkPermission } = require('../utils/permissions');
const { buildLiveDashboard } = require('../utils/ui');

const STATE_FILE = path.join(__dirname, '../dashboard_state.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dashboard')
    .setDescription('[Admin+] เปิดแผงควบคุม Live Dashboard แบบปุ่มกดอัปเดตสด'),
  async execute(interaction) {
    if (!(await checkPermission(interaction, 'admin'))) return;

    await interaction.deferReply();
    const stats = await getServerStats(true);
    const payload = buildLiveDashboard(stats, true);
    const msg = await interaction.editReply(payload);

    fs.writeFileSync(STATE_FILE, JSON.stringify({ channelId: msg.channelId, messageId: msg.id }, null, 2));
  }
};