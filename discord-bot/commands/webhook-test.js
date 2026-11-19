const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const config = require('../config/config');
const { checkPermission } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('webhook-test')
    .setDescription('[Super Admin] ทดสอบส่ง Custom Webhook ผ่าน Relay'),
  async execute(interaction) {
    if (!(await checkPermission(interaction, 'superadmin'))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    await axios.post(`http://127.0.0.1:${config.webhookPort}/webhook/crafty?secret=${encodeURIComponent(config.webhookSecret)}`, {
      text: 'TITLE: ทดสอบระบบแจ้งเตือน Crafty Sentinel\nEVENT: Diagnostic Webhook Test\nMESSAGE: การเชื่อมต่อ Webhook Relay และระบบความปลอดภัยทำงานสมบูรณ์!'
    });
    await interaction.editReply('✅ ส่งทดสอบ **Crafty Sentinel Webhook** เข้าช่อง Discord เรียบร้อยแล้ว');
  }
};