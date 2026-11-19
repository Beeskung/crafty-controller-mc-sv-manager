const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../config/config');
const { craftyRequest, getServerStats } = require('../services/craftyApi');
const { checkPermission } = require('../utils/permissions');
const { maskSecret } = require('../utils/security');
const { COLORS } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test')
    .setDescription('[Super Admin] วินิจฉัยระบบเชิงลึกและตรวจสอบความปลอดภัย'),
  async execute(interaction) {
    if (!(await checkPermission(interaction, 'superadmin'))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const t0 = Date.now();
    let apiDiag = '❌ เชื่อมต่อไม่สำเร็จ';
    let userPermDiag = '⚠️ จำกัดสิทธิ์';

    try {
      const s = await getServerStats(true);
      apiDiag = `✅ ปกติ (${Date.now() - t0} ms) — \`${s.server_id?.server_name || 'Connected'}\``;
    } catch (e) {
      apiDiag = `❌ Error ${e.response?.status || ''}: ${e.response?.data?.error_data || e.message}`;
    }

    try {
      await craftyRequest('get', '/users', null, 1);
      userPermDiag = '✅ Full Superuser Access';
    } catch (e) {
      userPermDiag = `⚠️ Missing Users Permission (${e.response?.status || e.message})`;
    }

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'MC-Sv-CCU • Security & System Diagnostics' })
      .setTitle('🧪 รายงานผลการทดสอบระบบเชิงลึก')
      .setColor(COLORS.SUPER)
      .addFields(
        { name: '1. Discord Gateway', value: `✅ ออนไลน์ (\`${interaction.client.ws.ping} ms\`)`, inline: true },
        { name: '2. Crafty API Status', value: apiDiag, inline: true },
        { name: '3. Token Permission Level', value: userPermDiag, inline: false },
        { name: '4. API Token Fingerprint', value: `\`${maskSecret(config.craftyToken)}\``, inline: false },
        { name: '5. Web Dashboard Auth', value: config.dashboardPasswordHash ? '🔒 **เปิดใช้งาน (scrypt Hash)**' : '⚠️ **ยังไม่ตั้งรหัสผ่าน**', inline: true },
        { name: '6. Bot Uptime', value: `⏱️ \`${Math.floor(process.uptime())} วินาที\``, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};