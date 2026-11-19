const crypto = require('crypto');
const config = require('../config/config');

// เปรียบเทียบค่าลับแบบ Timing-Safe (ป้องกัน Timing Attack)
function safeCompare(a, b) {
  if (!a || !b) return false;
  const hashA = crypto.createHash('sha256').update(String(a)).digest();
  const hashB = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

// ตรวจสอบรหัสผ่านกับ scrypt hash (รูปแบบ salt:hash)
function verifyPasswordHash(plainPassword, storedHash) {
  if (!plainPassword || !storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedKey = crypto.scryptSync(String(plainPassword), salt, keyBuffer.length);
  if (keyBuffer.length !== derivedKey.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

// สร้างและตรวจสอบ Session Token ด้วย HMAC-SHA256
function createSessionToken(ttlSeconds = 86400) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const nonce = crypto.randomBytes(12).toString('hex');
  const payload = `${exp}.${nonce}`;
  const sig = crypto.createHmac('sha256', config.sessionSecret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [expStr, nonce, sig] = parts;
  if (Number(expStr) < Math.floor(Date.now() / 1000)) return false;

  const expectedSig = crypto.createHmac('sha256', config.sessionSecret).update(`${expStr}.${nonce}`).digest('hex');
  return safeCompare(sig, expectedSig);
}

// สร้างรหัสอ้างอิง Audit Log (SHA-256 ย่อ 12 หลัก)
function createAuditHash(actorId, action) {
  return crypto
    .createHash('sha256')
    .update(`${actorId}:${action}:${Date.now()}:${config.sessionSecret}`)
    .digest('hex')
    .slice(0, 12);
}

// บังข้อมูลลับก่อนแสดงใน Log หรือหน้า Diagnostics
function maskSecret(secret) {
  const s = String(secret || '');
  if (s.length <= 8) return '********';
  return `${s.slice(0, 4)}...${s.slice(-4)} (SHA256:${crypto.createHash('sha256').update(s).digest('hex').slice(0, 8)})`;
}

// ป้องกัน Minecraft Command Injection (ลบขึ้นบรรทัดใหม่และอักขระควบคุม)
function sanitizeMcText(input, maxLen = 200) {
  return String(input || '')
    .replace(/[\r\n\x00-\x1F\x7F§]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function sanitizeMcUsername(input) {
  return String(input || '').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16);
}

// Rate Limiter สำหรับ Express ป้องกันการยิงรัว
function createRateLimiter(windowMs = 60000, maxRequests = 45) {
  const hits = new Map();
  setInterval(() => hits.clear(), windowMs).unref();

  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const count = (hits.get(ip) || 0) + 1;
    hits.set(ip, count);
    if (count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }
    next();
  };
}

module.exports = {
  safeCompare,
  verifyPasswordHash,
  createSessionToken,
  verifySessionToken,
  createAuditHash,
  maskSecret,
  sanitizeMcText,
  sanitizeMcUsername,
  createRateLimiter
};