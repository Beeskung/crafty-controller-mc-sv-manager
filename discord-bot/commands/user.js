const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { craftyRequest } = require('../services/craftyApi');
const { checkPermission } = require('../utils/permissions');
const { createAuditHash } = require('../utils/security');
const { COLORS } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('[Super Admin] จัดการบัญชีผู้ใช้ใน Crafty Controller')
    .addSubcommand(sub => sub.setName('create').setDescription('สร้างผู้ใช้ใหม่')
      .addStringOption(o => o.setName('username').setDescription('ชื่อผู้ใช้').setRequired(true))
      .addStringOption(o => o.setName('password').setDescription('รหัสผ่าน (8+ ตัวอักษร)').setMinLength(8).setRequired(true))
      .addStringOption(o => o.setName('role').setDescription('สิทธิ์').setRequired(true)
        .addChoices({ name: '⚡ Super Admin', value: 'Super Admin' }, { name: '🔧 Staff', value: 'Staff' }, { name: '👤 User', value: 'User' })))
    .addSubcommand(sub => sub.setName('list').setDescription('ดูรายชื่อผู้ใช้ทั้งหมด'))
    .addSubcommand(sub => sub.setName('delete').setDescription('ลบผู้ใช้ด้วย ID')
      .addIntegerOption(o => o.setName('user_id').setDescription('User ID').setRequired(true))),
  async execute(interaction) {
    if (!(await checkPermission(interaction, 'superadmin'))) return;
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const username = interaction.options.getString('username').replace(/[^a-zA-Z0-9_-]/g, '');
      const password = interaction.options.getString('password');
      const role = interaction.options.getString('role');
      await craftyRequest('post', '/users', {
        username,
        password,
        confirm_password: password,
        email: `${username}@crafty.local`,
        enabled: true,
        superuser: role === 'Super Admin',
        lang: 'en_EN'
      });
      const auditId = createAuditHash(interaction.user.id, `user-create:${username}`);
      return interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('✅ สร้างผู้ใช้ Crafty สำเร็จ').setColor(COLORS.ONLINE)
          .addFields({ name: 'Username', value: `\`${username}\``, inline: true }, { name: 'Role', value: role, inline: true })
          .setFooter({ text: `Audit #${auditId}` })]
      });
    }

    if (sub === 'list') {
      const res = await craftyRequest('get', '/users');
      const list = (res.data.data || [])
        .map(u => `• **[ID: ${u.user_id}]** \`${u.username}\` — ${u.superuser ? '⚡ Super Admin' : '👤 User'}`)
        .join('\n');
      return interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('📋 รายชื่อผู้ใช้ใน Crafty Controller').setDescription(list || 'ไม่พบข้อมูล').setColor(COLORS.PRIMARY)]
      });
    }

    if (sub === 'delete') {
      const uid = interaction.options.getInteger('user_id');
      await craftyRequest('delete', `/users/${uid}`);
      const auditId = createAuditHash(interaction.user.id, `user-delete:${uid}`);
      return interaction.editReply(`🗑️ ลบบัญชีผู้ใช้ **ID: ${uid}** สำเร็จ (Audit \`#${auditId}\`)`);
    }
  }
};