const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const envPath = path.resolve(__dirname, '../../.env.secret');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [k, ...v] = trimmed.split('=');
    if (!process.env[k.trim()]) {
      process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

const cleanEnv = val => String(val || '').trim().replace(/^["']|["']$/g, '');

module.exports = {
  token: cleanEnv(process.env.DISCORD_TOKEN),
  clientId: cleanEnv(process.env.DISCORD_CLIENT_ID || process.env.DISCORD_CIENT_ID),
  guildId: cleanEnv(process.env.DISCORD_GUILD),
  logChannelId: cleanEnv(process.env.DISCORD_LOG_CHANNEL_ID),
  webhookUrl: cleanEnv(process.env.DISCORD_WEBHOOK_URL),
  webhookSecret: cleanEnv(process.env.WEBHOOK_RELAY_SECRET),
  webhookPort: Number(process.env.WEBHOOK_PORT || 3005),
  craftyUrl: cleanEnv(process.env.CRAFTY_URL) || 'https://crafty_controller:8443',
  craftyToken: cleanEnv(process.env.API_TOKEN),
  serverId: cleanEnv(process.env.SERVER_ID),
  serverIp: cleanEnv(process.env.SERVER_IP) || 'localhost:25565',
  dashboardPasswordHash: cleanEnv(process.env.DASHBOARD_PASSWORD_HASH),
  sessionSecret: cleanEnv(process.env.SESSION_SECRET) || crypto.randomBytes(32).toString('hex'),
  superAdmins: cleanEnv(process.env.DISCORD_SUPER_ADMIN_IDS).split(',').map(id => id.trim()).filter(Boolean),
  admins: cleanEnv(process.env.DISCORD_ADMIN_IDS).split(',').map(id => id.trim()).filter(Boolean)
};