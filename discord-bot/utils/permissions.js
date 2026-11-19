const { MessageFlags } = require('discord.js');
const config = require('../config/config');

function isSuperAdmin(userId) {
  return config.superAdmins.includes(userId);
}

function isAdmin(userId) {
  return isSuperAdmin(userId) || config.admins.includes(userId);
}

function getRoleBadge(userId) {
  if (isSuperAdmin(userId)) return '⚡ Super Admin';
  if (isAdmin(userId)) return '🛡️ Admin';
  return '👤 User ทั่วไป';
}

async function checkPermission(interaction, requiredLevel) {
  const userId = interaction.user.id;
  if (requiredLevel === 'superadmin' && !isSuperAdmin(userId)) {
    await interaction.reply({
      content: `⛔ **ปฏิเสธการเข้าถึง** — คำสั่งนี้สงวนสิทธิ์เฉพาะ **Super Admin** เท่านั้น\n> สิทธิ์ปัจจุบันของคุณ: **${getRoleBadge(userId)}**`,
      flags: MessageFlags.Ephemeral
    });
    return false;
  }
  if (requiredLevel === 'admin' && !isAdmin(userId)) {
    await interaction.reply({
      content: `⛔ **ปฏิเสธการเข้าถึง** — คำสั่งนี้สำหรับ **Admin** ขึ้นไปเท่านั้น\n> สิทธิ์ปัจจุบันของคุณ: **${getRoleBadge(userId)}**`,
      flags: MessageFlags.Ephemeral
    });
    return false;
  }
  return true;
}

module.exports = { isSuperAdmin, isAdmin, getRoleBadge, checkPermission };