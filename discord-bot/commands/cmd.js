const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../config/config');
const { craftyRequest } = require('../services/craftyApi');
const { checkPermission } = require('../utils/permissions');
const { sanitizeMcText, createAuditHash } = require('../utils/security');
const { COLORS } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cmd')
    .setDescription('[Super Admin] ส่งคำสั่ง Console ตรงเข้าเซิร์ฟเวอร์')
    .addStringOption(opt => opt.setName('command').setDescription('คำสั่งคอนโซล').setRequired(true)),
  async execute(interaction) {
    if (!(await checkPermission(interaction, 'superadmin'))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const cmdText = sanitizeMcText(interaction.options.getString('command'), 250);
    await craftyRequest('post', `/servers/${config.serverId}/stdin`, cmdText);
    const auditId = createAuditHash(interaction.user.id, `cmd:${cmdText}`);

    const embed = new EmbedBuilder()
      .setTitle('💻 ส่งคำสั่งเข้า Console สำเร็จ')
      .setDescription(`\`\`\`bash\n> ${cmdText}\n\`\`\``)
      .setColor(COLORS.SUPER)
      .setFooter({ text: `Audit Hash: #${auditId}` });

    await interaction.editReply({ embeds: [embed] });
  }
};