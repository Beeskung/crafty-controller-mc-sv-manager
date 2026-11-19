const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const secretPath = path.join(rootDir, '.env.secret');
const examplePath = path.join(rootDir, '.env.example');

if (!fs.existsSync(secretPath)) {
  console.log('⚠️ ไม่พบไฟล์ .env.secret ข้ามการซิงก์');
  process.exit(0);
}

const lines = fs.readFileSync(secretPath, 'utf-8').split(/\r?\n/);
const sanitizedLines = lines.map(line => {
  const trimmed = line.trim();
  // คงบรรทัดว่างและคอมเมนต์หัวข้อไว้เหมือนเดิม
  if (!trimmed || trimmed.startsWith('#') || !line.includes('=')) {
    return line;
  }
  const key = line.split('=')[0].trim();
  return `${key}=`;
});

const output = sanitizedLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
fs.writeFileSync(examplePath, output, 'utf-8');
console.log('✅ ซิงก์โครงสร้างตัวแปรไปยัง .env.example เรียบร้อยแล้ว');