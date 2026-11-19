const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config/config');
const { getServerStats } = require('../services/craftyApi');
const { COLORS } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ip')
    .setDescription('แสดง IP / โดเมนสำหรับเข้าเล่นเซิร์ฟเวอร์ Minecraft'),
  async execute(interaction) {
    await interaction.deferReply();
    const s = await getServerStats();

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Crazy Craft Updated • Connection Info' })
      .setTitle('🌐 ข้อมูลการเชื่อมต่อเข้าเล่นเซิร์ฟเวอร์')
      .setColor(s.running ? COLORS.ONLINE : COLORS.OFFLINE)
      .addFields(
        { name: '📋 Server Address (คัดลอกไปวางในเกม)', value: `\`\`\`fix\n${config.serverIp}\n\`\`\`` },
        { name: '📡 สถานะ', value: s.running ? '🟢 **ออนไลน์**' : '🔴 **ปิดปรับปรุง**', inline: true },
        { name: '👥 ผู้เล่น', value: `**${s.online ?? 0} / ${s.max ?? 0}** คน`, inline: true },
        { name: '📦 Modpack', value: `\`Forge ${s.version || '1.16.5'}\``, inline: true }
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};