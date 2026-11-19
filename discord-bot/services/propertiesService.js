const fs = require('fs');
const path = require('path');
const config = require('../config/config');

// คำอธิบายและประเภท Input สำหรับแสดงผลบน GUI
const PROPERTY_SCHEMA = {
  motd: { category: 'ทั่วไป', label: 'ข้อความหน้าเซิร์ฟเวอร์ (MOTD)', type: 'text', desc: 'ข้อความที่แสดงใต้ชื่อเซิร์ฟเวอร์ในหน้ารายชื่อ Multiplayer' },
  'max-players': { category: 'ทั่วไป', label: 'จำนวนผู้เล่นสูงสุด', type: 'number', desc: 'เพดานผู้เล่นสูงสุด (หากเปิด Dynamic Max Players ค่านี้จะถูกปรับอัตโนมัติ)' },
  gamemode: { category: 'เกมเพลย์', label: 'โหมดการเล่นเริ่มต้น', type: 'select', options: ['survival', 'creative', 'adventure', 'spectator'], desc: 'โหมดเกมสำหรับผู้เล่นที่เข้าเซิร์ฟเวอร์ครั้งแรก' },
  difficulty: { category: 'เกมเพลย์', label: 'ระดับความยาก', type: 'select', options: ['peaceful', 'easy', 'normal', 'hard'], desc: 'ระดับความยากของมอนสเตอร์และความหิว' },
  hardcore: { category: 'เกมเพลย์', label: 'โหมด Hardcore', type: 'boolean', desc: 'หากเปิดใช้งาน ผู้เล่นที่ตายจะถูกเปลี่ยนเป็น Spectator ทันที' },
  pvp: { category: 'เกมเพลย์', label: 'เปิดการต่อสู้ระหว่างผู้เล่น (PVP)', type: 'boolean', desc: 'อนุญาตให้ผู้เล่นโจมตีกันเองได้' },
  'allow-flight': { category: 'เกมเพลย์', label: 'อนุญาตให้บิน (Allow Flight)', type: 'boolean', desc: 'จำเป็นต้องเปิดเป็น true สำหรับ Modpack ที่มีไอเทมบินหรือ Morph' },
  'enable-command-block': { category: 'เกมเพลย์', label: 'เปิดใช้งาน Command Block', type: 'boolean', desc: 'อนุญาตให้ใช้งานบล็อกคำสั่งในเกม' },
  'view-distance': { category: 'ประสิทธิภาพ', label: 'ระยะการมองเห็น (View Distance)', type: 'number', desc: 'รัศมี Chunk รอบตัวผู้เล่น (แนะนำ 6-8 สำหรับ Modpack 1.16.5)' },
  'max-tick-time': { category: 'ประสิทธิภาพ', label: 'เวลาสูงสุดต่อ 1 Tick (ms)', type: 'number', desc: 'ตั้งเป็น 120000 ขึ้นไปเพื่อป้องกันเซิร์ฟเวอร์ดับตอนโหลดม็อดหนัก' },
  'network-compression-threshold': { category: 'ประสิทธิภาพ', label: 'เกณฑ์บีบอัดข้อมูลเครือข่าย', type: 'number', desc: 'ขนาด Packet ขั้นต่ำที่จะบีบอัด (ค่ามาตรฐาน 256)' },
  'entity-broadcast-range-percentage': { category: 'ประสิทธิภาพ', label: 'ระยะแสดงผล Entity (%)', type: 'number', desc: 'ลดเหลือ 80 เพื่อลดอาการแลคจากมอนสเตอร์จำนวนมาก' },
  'level-seed': { category: 'โลกและการเกิด', label: 'Seed ของโลก', type: 'text', desc: 'รหัสสร้างแผนที่ (มีผลเฉพาะตอนสร้างโลกใหม่)' },
  'level-type': { category: 'โลกและการเกิด', label: 'รูปแบบโลก (Level Type)', type: 'text', desc: 'เช่น default, flat, biomesoplenty' },
  'allow-nether': { category: 'โลกและการเกิด', label: 'เปิดมิติ Nether', type: 'boolean', desc: 'อนุญาตให้ผู้เล่นเข้าประตูมิติ Nether ได้' },
  'spawn-monsters': { category: 'โลกและการเกิด', label: 'เกิดมอนสเตอร์', type: 'boolean', desc: 'เปิด/ปิดการเกิดของมอนสเตอร์ในโลก' },
  'spawn-animals': { category: 'โลกและการเกิด', label: 'เกิดสัตว์ทั่วไป', type: 'boolean', desc: 'เปิด/ปิดการเกิดของสัตว์' },
  'spawn-npcs': { category: 'โลกและการเกิด', label: 'เกิดชาวบ้าน (Villagers)', type: 'boolean', desc: 'เปิด/ปิดการเกิดของ NPC และหมู่บ้าน' },
  'spawn-protection': { category: 'ความปลอดภัย', label: 'รัศมีป้องกันจุดเกิด (บล็อก)', type: 'number', desc: 'ป้องกันผู้เล่นทั่วไปทุบบล็อกรอบจุดเกิด (0 = ปิด)' },
  'white-list': { category: 'ความปลอดภัย', label: 'เปิดใช้งาน Whitelist', type: 'boolean', desc: 'อนุญาตเฉพาะผู้เล่นที่มีรายชื่อใน Whitelist เท่านั้น' },
  'enforce-whitelist': { category: 'ความปลอดภัย', label: 'เตะผู้เล่นที่ไม่อยู่ใน Whitelist ทันที', type: 'boolean', desc: 'เตะผู้เล่นออกทันทีเมื่อสั่ง Reload Whitelist' },
  'online-mode': { category: 'ความปลอดภัย', label: 'ตรวจสอบไอดีแท้ (Online Mode)', type: 'boolean', desc: 'true = เฉพาะไอดีแท้, false = รองรับไอดีเถื่อน/Launcher' },
  'server-port': { category: 'ความปลอดภัย', label: 'พอร์ตเซิร์ฟเวอร์', type: 'number', desc: 'พอร์ตหลักของ Minecraft (ค่าเริ่มต้น 25565)' }
};

function getPropertiesFilePath() {
  const safeId = String(config.serverId || '').replace(/[^a-zA-Z0-9-]/g, '');
  if (!safeId) throw new Error('ไม่พบค่า SERVER_ID ในการตั้งค่า');

  const dockerPath = `/crafty/servers/${safeId}/server.properties`;
  if (fs.existsSync(dockerPath)) return dockerPath;

  const localPath = path.resolve(__dirname, `../../crafty_servers/${safeId}/server.properties`);
  if (fs.existsSync(localPath)) return localPath;

  throw new Error(`ไม่พบไฟล์ server.properties สำหรับเซิร์ฟเวอร์ ${safeId}`);
}

function parseProperties() {
  const filePath = getPropertiesFilePath();
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/);
  const items = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eqIdx = line.indexOf('=');
    const key = line.slice(0, eqIdx).trim();
    const value = line.slice(eqIdx + 1).trim();
    const meta = PROPERTY_SCHEMA[key] || {
      category: 'อื่นๆ (Advanced)',
      label: key,
      type: value === 'true' || value === 'false' ? 'boolean' : /^-?\d+$/.test(value) ? 'number' : 'text',
      desc: 'ค่าตั้งค่าเพิ่มเติมของเซิร์ฟเวอร์หรือม็อด'
    };

    items.push({
      key,
      value,
      category: meta.category,
      label: meta.label,
      type: meta.type,
      options: meta.options || null,
      desc: meta.desc
    });
  }

  return {
    filePath,
    hasBackup: fs.existsSync(`${filePath}.bak`),
    items
  };
}

function saveProperties(updates) {
  if (!updates || typeof updates !== 'object') {
    throw new Error('รูปแบบข้อมูลอัปเดตไม่ถูกต้อง');
  }

  const filePath = getPropertiesFilePath();
  const originalContent = fs.readFileSync(filePath, 'utf-8');

  // สำรองไฟล์เดิมก่อนเขียนทับเสมอ
  fs.writeFileSync(`${filePath}.bak`, originalContent, 'utf-8');

  // ล้างอักขระขึ้นบรรทัดใหม่ป้องกัน Injection
  const cleanUpdates = {};
  for (const [rawKey, rawVal] of Object.entries(updates)) {
    const safeKey = String(rawKey).replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safeKey) continue;
    const safeVal = String(rawVal ?? '').replace(/[\r\n\x00]/g, '').trim();
    cleanUpdates[safeKey] = safeVal;
  }

  const lines = originalContent.split(/\r?\n/);
  const updatedKeys = new Set();

  const newLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return line;
    const eqIdx = line.indexOf('=');
    const key = line.slice(0, eqIdx).trim();
    if (Object.prototype.hasOwnProperty.call(cleanUpdates, key)) {
      updatedKeys.add(key);
      return `${key}=${cleanUpdates[key]}`;
    }
    return line;
  });

  // เพิ่มคีย์ใหม่ที่ยังไม่มีในไฟล์เดิม
  for (const [key, val] of Object.entries(cleanUpdates)) {
    if (!updatedKeys.has(key)) {
      newLines.push(`${key}=${val}`);
    }
  }

  fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
  return Object.keys(cleanUpdates).length;
}

function restorePropertiesBackup() {
  const filePath = getPropertiesFilePath();
  const bakPath = `${filePath}.bak`;
  if (!fs.existsSync(bakPath)) {
    throw new Error('ไม่พบไฟล์สำรอง server.properties.bak');
  }
  fs.copyFileSync(bakPath, filePath);
}

function applyModdedPreset() {
  return saveProperties({
    'allow-flight': 'true',
    'view-distance': '8',
    'max-tick-time': '120000',
    'entity-broadcast-range-percentage': '80',
    'spawn-protection': '0',
    'enable-command-block': 'true'
  });
}

module.exports = {
  parseProperties,
  saveProperties,
  restorePropertiesBackup,
  applyModdedPreset
};