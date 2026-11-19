const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getRoleBadge, isAdmin, isSuperAdmin } = require('../utils/permissions');
const { COLORS } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('แสดงคู่มือคำสั่งทั้งหมดตามระดับสิทธิ์ของคุณ'),
  async execute(interaction) {
    const uid = interaction.user.id;
    const color = isSuperAdmin(uid) ? COLORS.SUPER : isAdmin(uid) ? COLORS.ONLINE : COLORS.NEUTRAL;

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'MC-Sv-CCU • Command Guide' })
      .setTitle('📖 คู่มือการใช้งานบอทจัดการเซิร์ฟเวอร์')
      .setDescription(`ระดับสิทธิ์ของคุณในระบบ: **${getRoleBadge(uid)}**`)
      .setColor(color)
      .addFields(
        {
          name: '👤 คำสั่งทั่วไป (สมาชิกทุกคนใช้ได้)',
          value: '• `/ping` — ทดสอบความเร็วบอทและ API\n• `/ip` — ดูที่อยู่เซิร์ฟเวอร์และวิธีเข้าเล่น\n• `/status` — เช็กสถานะออนไลน์และทรัพยากร\n• `/help` — เปิดหน้าคู่มือนี้'
        },
        {
          name: '🛡️ คำสั่งระดับ Admin (ทีมงาน)',
          value: '• `/players` — ดูรายชื่อผู้เล่นออนไลน์สด\n• `/say` — ส่งข้อความประกาศเข้าแชตในเกม\n• `/whitelist` — เพิ่ม/ลบรายชื่อเข้าเล่น\n• `/dashboard` — เปิดแผงปุ่มกดควบคุมสด\n• `/server` — สั่ง Start / Stop / Restart / Backup'
        },
        {
          name: '⚡ คำสั่งเฉพาะ Super Admin',
          value: '• `/test` — วินิจฉัยระบบและความปลอดภัย\n• `/webhook-test` — ทดสอบการ์ดแจ้งเตือน Sentinel\n• `/logs` — ดึงหน้าต่าง Console Log สด\n• `/cmd` — รันคำสั่งระดับ Console โดยตรง\n• `/user` — สร้าง/ดู/ลบบัญชีผู้ใช้ใน Crafty'
        }
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
};