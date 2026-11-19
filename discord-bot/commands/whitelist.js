const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../config/config');
const { craftyRequest } = require('../services/craftyApi');
const { checkPermission } = require('../utils/permissions');
const { sanitizeMcUsername, createAuditHash } = require('../utils/security');
const { COLORS } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('[Admin+] จัดการรายชื่อผู้เล่นใน Whitelist')
    .addStringOption(opt => opt.setName('mode').setDescription('เลือกการทำงาน').setRequired(true)
      .addChoices(
        { name: '➕ เพิ่มชื่อผู้เล่น (add)', value: 'add' },
        { name: '➖ ลบชื่อผู้เล่น (remove)', value: 'remove' },
        { name: '📋 ดูรายชื่อทั้งหมด (list)', value: 'list' }
      ))
    .addStringOption(opt => opt.setName('player').setDescription('ชื่อตัวละคร Minecraft').setRequired(false)),
  async execute(interaction) {
    if (!(await checkPermission(interaction, 'admin'))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const mode = interaction.options.getString('mode');
    const cleanPlayer = sanitizeMcUsername(interaction.options.getString('player'));

    if (mode !== 'list' && !cleanPlayer) {
      return interaction.editReply('⚠️ กรุณาระบุชื่อตัวละคร Minecraft ที่ถูกต้อง (ตัวอักษรภาษาอังกฤษ ตัวเลข หรือ `_`)');
    }

    const cmd = mode === 'list' ? 'whitelist list' : `whitelist ${mode} ${cleanPlayer}`;
    await craftyRequest('post', `/servers/${config.serverId}/stdin`, cmd);
    const auditId = createAuditHash(interaction.user.id, cmd);

    const embed = new EmbedBuilder()
      .setTitle('📜 อัปเดตระบบ Whitelist เรียบร้อย')
      .setColor(mode === 'remove' ? COLORS.WARNING : COLORS.ONLINE)
      .addFields(
        { name: 'คำสั่งที่ทำงาน', value: `\`/${cmd}\``, inline: true },
        { name: 'Audit Hash', value: `\`#${auditId}\``, inline: true }
      );

    await interaction.editReply({ embeds: [embed] });
  }
};