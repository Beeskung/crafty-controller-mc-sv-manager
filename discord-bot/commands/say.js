const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../config/config');
const { craftyRequest } = require('../services/craftyApi');
const { checkPermission } = require('../utils/permissions');
const { sanitizeMcText, createAuditHash } = require('../utils/security');
const { COLORS } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('[Admin+] ส่งข้อความประกาศเข้าไปในแชตเซิร์ฟเวอร์ Minecraft')
    .addStringOption(opt => opt.setName('message').setDescription('ข้อความประกาศ').setMaxLength(180).setRequired(true)),
  async execute(interaction) {
    if (!(await checkPermission(interaction, 'admin'))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const cleanMsg = sanitizeMcText(interaction.options.getString('message'), 180);
    const sender = sanitizeMcText(interaction.member?.displayName || interaction.user.username, 24);
    const auditId = createAuditHash(interaction.user.id, `say:${cleanMsg}`);

    await craftyRequest('post', `/servers/${config.serverId}/stdin`, `say [Discord] ${sender}: ${cleanMsg}`);

    const embed = new EmbedBuilder()
      .setTitle('📢 ส่งประกาศเข้าเซิร์ฟเวอร์สำเร็จ')
      .setColor(COLORS.PRIMARY)
      .setDescription(`\`\`\`[Discord] ${sender}: ${cleanMsg}\`\`\``)
      .setFooter({ text: `Audit Hash: #${auditId}` });

    await interaction.editReply({ embeds: [embed] });
  }
};