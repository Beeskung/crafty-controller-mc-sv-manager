const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const config = require('../config/config');
const { craftyRequest } = require('../services/craftyApi');
const { checkPermission, isSuperAdmin } = require('../utils/permissions');
const { createAuditHash } = require('../utils/security');
const { COLORS } = require('../utils/ui');

const ACTION_LABELS = {
  start_server: { title: '🟢 สั่งเปิดเซิร์ฟเวอร์', color: COLORS.ONLINE },
  stop_server: { title: '🔴 สั่งปิดเซิร์ฟเวอร์', color: COLORS.OFFLINE },
  restart_server: { title: '🔄 สั่งรีสตาร์ตเซิร์ฟเวอร์', color: COLORS.PRIMARY },
  backup_server: { title: '💾 สั่งสำรองข้อมูล (Backup)', color: COLORS.SUPER },
  kill_server: { title: '💀 บังคับปิดเซิร์ฟเวอร์ฉุกเฉิน (Kill)', color: COLORS.OFFLINE }
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('server')
    .setDescription('[Admin+] ควบคุมการทำงานของเซิร์ฟเวอร์')
    .addStringOption(opt => opt.setName('action').setDescription('เลือกคำสั่งควบคุม').setRequired(true)
      .addChoices(
        { name: '🟢 Start (เปิดเซิร์ฟเวอร์)', value: 'start_server' },
        { name: '🔴 Stop (ปิดเซิร์ฟเวอร์)', value: 'stop_server' },
        { name: '🔄 Restart (รีสตาร์ต)', value: 'restart_server' },
        { name: '💾 Backup (สำรองข้อมูล)', value: 'backup_server' },
        { name: '💀 Kill (บังคับปิด - เฉพาะ Super Admin)', value: 'kill_server' }
      )),
  async execute(interaction) {
    const action = interaction.options.getString('action');
    if (action === 'kill_server' && !isSuperAdmin(interaction.user.id)) {
      return checkPermission(interaction, 'superadmin');
    }
    if (!(await checkPermission(interaction, 'admin'))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    await craftyRequest('post', `/servers/${config.serverId}/action/${action}`);
    const auditId = createAuditHash(interaction.user.id, action);
    const meta = ACTION_LABELS[action] || { title: action, color: COLORS.PRIMARY };

    const embed = new EmbedBuilder()
      .setTitle(meta.title)
      .setDescription(`ส่งคำสั่ง \`${action}\` ไปยัง Crafty Controller เรียบร้อยแล้ว`)
      .setColor(meta.color)
      .setFooter({ text: `ผู้สั่งงาน: ${interaction.user.tag} • Audit #${auditId}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};