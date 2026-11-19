const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const sass = require('sass');
const config = require('../config/config');
const { craftyRequest, getServerStats } = require('./craftyApi');
const {
  parseProperties,
  saveProperties,
  restorePropertiesBackup,
  applyModdedPreset
} = require('./propertiesService');
const {
  safeCompare,
  verifyPasswordHash,
  createSessionToken,
  verifySessionToken,
  createAuditHash,
  sanitizeMcText,
  sanitizeMcUsername,
  createRateLimiter
} = require('../utils/security');

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      cookies[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
    }
  });
  return cookies;
}

function setupWebhookServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '512kb' }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });

  app.use('/api', createRateLimiter(60000, 90));

  try {
    const scssEntry = path.join(__dirname, '../scss/main.scss');
    if (fs.existsSync(scssEntry)) {
      const compiled = sass.compile(scssEntry, { style: 'compressed' });
      fs.writeFileSync(path.join(__dirname, '../public/style.css'), compiled.css);
      console.log('🎨 คอมไพล์ Sass (scss/main.scss -> public/style.css) สำเร็จ');
    }
  } catch (scssErr) {
    console.error('⚠️ คอมไพล์ Sass ไม่สำเร็จ:', scssErr.message);
  }
  
  app.use(express.static(path.join(__dirname, '../public')));

  function requireAuth(req, res, next) {
    if (!config.dashboardPasswordHash) {
      return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่า DASHBOARD_PASSWORD_HASH ใน .env.secret' });
    }
    const cookies = parseCookies(req.headers.cookie);
    if (!verifySessionToken(cookies.mc_dash_session)) {
      return res.status(401).json({ error: 'Unauthorized: กรุณาเข้าสู่ระบบก่อน' });
    }
    next();
  }

  // --- ระบบ Authentication ---
  app.post('/api/auth/login', (req, res) => {
    const { password } = req.body || {};
    if (!verifyPasswordHash(password, config.dashboardPasswordHash)) {
      return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
    }
    const token = createSessionToken(86400);
    res.setHeader('Set-Cookie', `mc_dash_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
    res.json({ success: true });
  });

  app.post('/api/auth/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'mc_dash_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
    res.json({ success: true });
  });

  app.get('/api/auth/check', requireAuth, (req, res) => {
    res.json({ authenticated: true });
  });

  // --- ควบคุมพลังงานเซิร์ฟเวอร์ ---
  app.post('/api/server/:action', requireAuth, async (req, res) => {
    const allowedActions = ['start_server', 'stop_server', 'restart_server', 'backup_server', 'kill_server'];
    const { action } = req.params;
    if (!allowedActions.includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    try {
      await craftyRequest('post', `/servers/${config.serverId}/action/${action}`);
      const auditId = createAuditHash('web-dashboard', action);
      res.json({ success: true, auditId, message: `สั่ง ${action} เรียบร้อยแล้ว` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- API สำหรับ server.properties GUI ---
  app.get('/api/properties', requireAuth, (req, res) => {
    try {
      const data = parseProperties();
      res.json({ success: true, ...data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/properties', requireAuth, (req, res) => {
    try {
      const count = saveProperties(req.body.properties);
      const auditId = createAuditHash('web-properties', `updated:${count}`);
      res.json({
        success: true,
        auditId,
        message: `บันทึกค่า ${count} รายการสำเร็จ (สำรองไฟล์ .bak แล้ว — กรุณา Restart เซิร์ฟเวอร์เพื่อให้มีผล)`
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/properties/restore', requireAuth, (req, res) => {
    try {
      restorePropertiesBackup();
      const auditId = createAuditHash('web-properties', 'restore-bak');
      res.json({ success: true, auditId, message: 'กู้คืนค่าจาก server.properties.bak เรียบร้อยแล้ว' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/properties/preset-modded', requireAuth, (req, res) => {
    try {
      const count = applyModdedPreset();
      const auditId = createAuditHash('web-properties', 'preset-modded');
      res.json({ success: true, auditId, message: `ปรับใช้พรีเซ็ต Crazy Craft 1.16.5 (${count} รายการ) สำเร็จ!` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- API สำหรับ Live Console & คำสั่ง ---
  app.get('/api/logs', requireAuth, async (req, res) => {
    try {
      const logRes = await craftyRequest('get', `/servers/${config.serverId}/logs`, null, 1);
      const raw = Array.isArray(logRes.data?.data) ? logRes.data.data : [];
      const lines = raw.slice(-45).map(l => String(l).replace(/\x1b\[[0-9;]*m/g, ''));
      res.json({ success: true, lines });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/console', requireAuth, async (req, res) => {
    const cmdText = sanitizeMcText(req.body?.command, 250);
    if (!cmdText) return res.status(400).json({ error: 'กรุณาระบุคำสั่ง' });
    try {
      await craftyRequest('post', `/servers/${config.serverId}/stdin`, cmdText);
      const auditId = createAuditHash('web-console', cmdText);
      res.json({ success: true, auditId, command: cmdText });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- API จัดการผู้เล่นด่วน (Whitelist / OP / Kick) ---
  app.post('/api/player', requireAuth, async (req, res) => {
    const { action, player } = req.body || {};
    const cleanPlayer = sanitizeMcUsername(player);
    if (!cleanPlayer) return res.status(400).json({ error: 'ชื่อตัวละครไม่ถูกต้อง' });

    const cmdMap = {
      whitelist_add: `whitelist add ${cleanPlayer}`,
      whitelist_remove: `whitelist remove ${cleanPlayer}`,
      op: `op ${cleanPlayer}`,
      deop: `deop ${cleanPlayer}`,
      kick: `kick ${cleanPlayer} ถูกเชิญออกจากเซิร์ฟเวอร์โดยผู้ดูแลระบบ`
    };
    const mcCmd = cmdMap[action];
    if (!mcCmd) return res.status(400).json({ error: 'ไม่รองรับคำสั่งนี้' });

    try {
      await craftyRequest('post', `/servers/${config.serverId}/stdin`, mcCmd);
      const auditId = createAuditHash('web-player', mcCmd);
      res.json({ success: true, auditId, message: `รันคำสั่ง /${mcCmd} สำเร็จ` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- API ดูรายการไฟล์ Backup ---
  app.get('/api/backups', requireAuth, (req, res) => {
    try {
      const safeId = String(config.serverId || '').replace(/[^a-zA-Z0-9-]/g, '');
      const backupDir = fs.existsSync(`/crafty/backups/${safeId}`)
        ? `/crafty/backups/${safeId}`
        : path.resolve(__dirname, `../../crafty_backups/${safeId}`);

      if (!fs.existsSync(backupDir)) return res.json({ success: true, files: [] });

      const files = fs.readdirSync(backupDir)
        .filter(f => f.endsWith('.zip') || f.endsWith('.tar.gz'))
        .map(name => {
          const stat = fs.statSync(path.join(backupDir, name));
          return {
            name,
            sizeMB: (stat.size / (1024 * 1024)).toFixed(2),
            modified: stat.mtime
          };
        })
        .sort((a, b) => new Date(b.modified) - new Date(a.modified));

      res.json({ success: true, files });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Webhook Relay จาก Crafty ---
  app.post('/webhook/crafty', async (req, res) => {
    const secret = req.query.secret || req.headers['x-webhook-secret'];
    if (config.webhookSecret && !safeCompare(secret, config.webhookSecret)) {
      return res.status(401).json({ error: 'Unauthorized webhook secret' });
    }

    try {
      const raw = req.body;
      const combinedText = raw?.embeds?.[0]?.description || raw?.content || raw?.text || JSON.stringify(raw);
      const titleMatch = combinedText.match(/TITLE:\s*(.+)/i);
      const eventMatch = combinedText.match(/EVENT:\s*(.+)/i);
      const msgMatch = combinedText.match(/MESSAGE:\s*([\s\S]*)/i);

      const cleanMsg = (msgMatch ? msgMatch[1] : combinedText).replace(/\x1b\[[0-9;]*m/g, '').trim().slice(0, 900);
      const cleanEvent = (eventMatch ? eventMatch[1] : 'System Update').trim().slice(0, 80);

      let playerLine = 'ไม่ทราบสถานะ';
      try {
        const s = await getServerStats();
        playerLine = s.running ? `🟢 ${s.online ?? 0} / ${s.max ?? 0} คน` : '🔴 ออฟไลน์';
      } catch (_) {}

      const payload = {
        username: 'Crafty Sentinel',
        avatar_url: 'https://craftycontrol.com/assets/images/crafty_logo.png',
        embeds: [{
          author: { name: '⚙️ SYSTEM MONITOR • CrazyCraft-Updated', icon_url: 'https://craftycontrol.com/assets/images/crafty_logo.png' },
          title: titleMatch ? titleMatch[1].trim() : 'แจ้งเตือนสถานะเซิร์ฟเวอร์',
          color: 0x3B82F6,
          fields: [
            { name: '📌 เหตุการณ์', value: `\`${cleanEvent}\``, inline: true },
            { name: '👥 ผู้เล่นออนไลน์', value: playerLine, inline: true },
            { name: '🌐 Server IP', value: `\`${config.serverIp}\``, inline: false },
            { name: '📄 รายละเอียด', value: `\`\`\`yaml\n${cleanMsg}\n\`\`\``, inline: false }
          ],
          footer: { text: 'Crafty Sentinel • Secured Relay' },
          timestamp: new Date().toISOString()
        }]
      };

      if (config.webhookUrl) {
        await axios.post(config.webhookUrl, payload, { timeout: 8000 });
      }
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- Socket.io Real-time Telemetry ---
  io.use((socket, next) => {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    if (!verifySessionToken(cookies.mc_dash_session)) {
      return next(new Error('Unauthorized'));
    }
    next();
  });

  setInterval(async () => {
    if (io.engine.clientsCount === 0) return;
    try {
      const stats = await getServerStats();
      io.emit('server_stats', {
        running: stats.running,
        online: stats.online,
        max: stats.max,
        cpu: stats.cpu,
        mem: stats.mem,
        version: stats.version,
        players: stats.players
      });
    } catch (_) {}
  }, 4000);

  server.listen(config.webhookPort, '0.0.0.0', () => {
    console.log(`📡 Advanced Control Center & Webhook Relay ทำงานที่พอร์ต ${config.webhookPort}`);
  });
}

module.exports = { setupWebhookServer };