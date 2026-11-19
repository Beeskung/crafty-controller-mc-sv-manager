const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { parseProperties, saveProperties, applyModdedPreset } = require('../services/propertiesService');
const { checkPermission } = require('../utils/permissions');
const { createAuditHash } = require('../utils/security');
const { COLORS } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('properties')
    .setDescription('[Super Admin] ดูและแก้ไขไฟล์ server.properties จาก Discord')
    .addSubcommand(sub =>
      sub.setName('get').setDescription('ค้นหาและดูค่าตั้งค่าใน server.properties')
        .addStringOption(o => o.setName('key').setDescription('ชื่อคีย์ เช่น difficulty, view-distance, allow-flight').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('set').setDescription('แก้ไขค่าใน server.properties (สำรอง .bak อัตโนมัติ)')
        .addStringOption(o => o.setName('key').setDescription('ชื่อคีย์ เช่น difficulty, pvp, view-distance').setRequired(true))
        .addStringOption(o => o.setName('value').setDescription('ค่าใหม่ เช่น hard, true, 8').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('preset-modded').setDescription('ปรับค่า server.properties ให้เหมาะกับ Crazy Craft 1.16.5 อัตโนมัติ')
    ),

  async execute(interaction) {
    if (!(await checkPermission(interaction, 'superadmin'))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const sub = interaction.options.getSubcommand();

    if (sub === 'get') {
      const searchKey = interaction.options.getString('key').toLowerCase();
      const { items } = parseProperties();
      const matched = items.filter(i => i.key.toLowerCase().includes(searchKey)).slice(0, 10);

      if (matched.length === 0) {
        return interaction.editReply(`🔍 ไม่พบการตั้งค่าที่ตรงกับ \`${searchKey}\``);
      }

      const desc = matched.map(m => `• **${m.key}** = \`${m.value}\`\n  > *${m.desc}*`).join('\n');
      const embed = new EmbedBuilder()
        .setTitle(`⚙️ ผลการค้นหา server.properties (${matched.length} รายการ)`)
        .setDescription(desc)
        .setColor(COLORS.PRIMARY);
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'set') {
      const key = interaction.options.getString('key').trim();
      const value = interaction.options.getString('value').trim();
      saveProperties({ [key]: value });
      const auditId = createAuditHash(interaction.user.id, `prop:${key}=${value}`);

      const embed = new EmbedBuilder()
        .setTitle('✅ อัปเดต server.properties สำเร็จ')
        .setDescription(`เปลี่ยนค่า \`${key}\` เป็น \`${value}\` เรียบร้อยแล้ว\n*(สำรองไฟล์เดิมไว้ที่ \`server.properties.bak\` — กรุณา Restart เซิร์ฟเวอร์เพื่อให้มีผล)*`)
        .setColor(COLORS.ONLINE)
        .setFooter({ text: `Audit Hash: #${auditId}` });
      return interaction.editReply({ embeds: [embed] });
    }

    if (sub === 'preset-modded') {
      const count = applyModdedPreset();
      const auditId = createAuditHash(interaction.user.id, 'prop:preset-modded');
      return interaction.editReply(
        `🚀 ปรับใช้พรีเซ็ต **Crazy Craft 1.16.5 (${count} รายการ)** สำเร็จ! (เปิด \`allow-flight=true\`, \`max-tick-time=120000\`, \`view-distance=8\`) • Audit \`#${auditId}\``
      );
    }
  }
};