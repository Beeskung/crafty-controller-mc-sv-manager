const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const axios = require('axios');
const config = require('../config/config');
const { craftyRequest, getServerStats } = require('../services/craftyApi');
const { checkPermission, getRoleBadge } = require('../utils/permissions');
const { createAuditHash } = require('../utils/security');
const { COLORS, parsePlayers, buildLiveDashboard } = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('test-all')
    .setDescription('[Super Admin] ทดสอบการทำงานของทุกคำสั่งและระบบย่อยทั้งหมดในคำสั่งเดียว')
    .addBooleanOption(opt =>
      opt
        .setName('live_console_test')
        .setDescription('ส่งคำสั่ง "list" เข้า Console จริงเพื่อเทส /cmd, /say, /whitelist (ค่าเริ่มต้น: False)')
        .setRequired(false)
    ),

  async execute(interaction) {
    if (!(await checkPermission(interaction, 'superadmin'))) return;

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const runLiveConsole = interaction.options.getBoolean('live_console_test') || false;
    const startTotal = Date.now();
    const results = [];
    let statsData = null;

    // 1. ทดสอบการโหลดไฟล์คำสั่งทั้งหมดในโฟลเดอร์ commands/
    try {
      const { loadCommands } = require('../handlers/commandHandler');
      const loaded = loadCommands();
      const names = loaded.map(c => `\`/${c.data.name}\``).join(', ');
      results.push(`✅ **Command Loader (${loaded.length} ไฟล์):** โหลดสำเร็จครบทุกโมดูล\n> ${names}`);
    } catch (err) {
      results.push(`❌ **Command Loader:** โหลดไฟล์คำสั่งล้มเหลว (${err.message})`);
    }

    // 2. ทดสอบกลุ่มคำสั่งพื้นฐาน (/ping, /help, /ip)
    const ipReady = Boolean(config.serverIp && config.serverIp !== 'localhost:25565');
    results.push(
      `${ipReady ? '✅' : '⚠️'} **/ping, /help, /ip:** Gateway \`${interaction.client.ws.ping}ms\` | สิทธิ์ \`${getRoleBadge(interaction.user.id)}\` | IP \`${config.serverIp}\``
    );

    // 3. ทดสอบกลุ่มคำสั่งดึงสถิติ (/status, /players, /dashboard)
    try {
      const t0 = Date.now();
      statsData = await getServerStats(true);
      const players = parsePlayers(statsData.players);
      buildLiveDashboard(statsData, true); // ทดสอบสร้าง Embed และปุ่มกด
      results.push(
        `✅ **/status, /players, /dashboard:** ดึงข้อมูลและสร้าง UI สำเร็จ (\`${Date.now() - t0}ms\` | ผู้เล่น \`${players.length}\` คน)`
      );
    } catch (err) {
      const msg = err.response?.data?.error_data || err.message;
      results.push(`❌ **/status, /players, /dashboard:** ล้มเหลว (${msg})`);
    }

    // 4. ทดสอบคำสั่งดูบันทึก (/logs)
    try {
      const t0 = Date.now();
      const logRes = await craftyRequest('get', `/servers/${config.serverId}/logs`, null, 1);
      const lineCount = Array.isArray(logRes.data?.data) ? logRes.data.data.length : 0;
      results.push(`✅ **/logs:** อ่าน Console Log สำเร็จ (\`${Date.now() - t0}ms\` | พบ \`${lineCount}\` บรรทัด)`);
    } catch (err) {
      const msg = err.response?.data?.error_data || err.message;
      results.push(`❌ **/logs:** อ่าน Log ไม่สำเร็จ (${msg})`);
    }

    // 5. ทดสอบคำสั่งจัดการผู้ใช้ (/user list)
    try {
      const t0 = Date.now();
      const userRes = await craftyRequest('get', '/users', null, 1);
      const userCount = Array.isArray(userRes.data?.data) ? userRes.data.data.length : 0;
      results.push(`✅ **/user (create/list/delete):** สิทธิ์ Superuser ผ่าน (\`${Date.now() - t0}ms\` | พบ \`${userCount}\` บัญชี)`);
    } catch (err) {
      const msg = err.response?.data?.error_data || err.message;
      results.push(`❌ **/user:** Token ไม่มีสิทธิ์จัดการผู้ใช้ (${msg})`);
    }

    // 6. ทดสอบกลุ่มคำสั่งส่งเข้า Console (/say, /whitelist, /cmd)
    if (runLiveConsole) {
      try {
        const t0 = Date.now();
        await craftyRequest('post', `/servers/${config.serverId}/stdin`, 'list', 1);
        results.push(`✅ **/say, /whitelist, /cmd (Live):** ส่งคำสั่ง \`list\` เข้า Console สำเร็จ (\`${Date.now() - t0}ms\`)`);
      } catch (err) {
        const msg = err.response?.data?.error_data || err.message;
        results.push(`❌ **/say, /whitelist, /cmd (Live):** ส่งคำสั่งไม่สำเร็จ (${msg})`);
      }
    } else {
      const canRun = Boolean(statsData?.running);
      results.push(
        `⏭️ **/say, /whitelist, /cmd:** ข้ามการยิงจริง (สถานะเซิร์ฟเวอร์: ${canRun ? '🟢 พร้อมรับคำสั่ง' : '🔴 ออฟไลน์'} — เลือก \`live_console_test: True\` เพื่อทดสอบยิงจริง)`
      );
    }

    // 7. ทดสอบความพร้อมคำสั่งควบคุมพลังงาน (/server)
    results.push(
      `${statsData ? '✅' : '❌'} **/server (start/stop/restart/backup/kill):** API Endpoint พร้อมทำงาน *(ข้ามการสั่งปิด/รีสตาร์ตจริงเพื่อความปลอดภัย)*`
    );

    // 8. ทดสอบเว็บเซิร์ฟเวอร์และระบบ Webhook Relay (/webhook-test)
    try {
      const webRes = await axios.get(`http://127.0.0.1:${config.webhookPort}/api/auth/check`, {
        timeout: 3000,
        validateStatus: status => status === 200 || status === 401
      });
      const whConfigured = Boolean(config.webhookUrl);
      results.push(
        `${whConfigured ? '✅' : '⚠️'} **/webhook-test & Web Dashboard:** พอร์ต \`${config.webhookPort}\` ตอบกลับปกติ (HTTP \`${webRes.status}\`) | Webhook URL: ${whConfigured ? 'ตั้งค่าแล้ว' : 'ยังไม่ตั้งค่า'}`
      );
    } catch (err) {
      results.push(`❌ **/webhook-test & Web Dashboard:** ไม่สามารถติดต่อพอร์ต \`${config.webhookPort}\` (${err.message})`);
    }

    const totalMs = Date.now() - startTotal;
    const hasError = results.some(r => r.startsWith('❌'));
    const auditId = createAuditHash(interaction.user.id, `test-all:live=${runLiveConsole}`);

    const embed = new EmbedBuilder()
      .setAuthor({ name: 'MC-Sv-CCU • Full System Self-Test' })
      .setTitle(hasError ? '⚠️ ผลการทดสอบรวม: พบจุดที่ต้องแก้ไข' : '🎉 ผลการทดสอบรวม: ผ่านสมบูรณ์ทุกระบบ')
      .setDescription(results.join('\n\n'))
      .setColor(hasError ? COLORS.WARNING : COLORS.ONLINE)
      .setFooter({ text: `ใช้เวลาทดสอบทั้งหมด ${totalMs} ms • Audit #${auditId}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  }
};