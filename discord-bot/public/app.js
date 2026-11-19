let socket = null;
let allProperties = [];
let dirtyChanges = {};
let activeCategory = 'ทั้งหมด';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showAudit(text, isError = false) {
  const badge = document.getElementById('audit-badge');
  badge.textContent = text;
  badge.style.color = isError ? 'var(--red)' : 'var(--green)';
}

async function checkAuth() {
  const res = await fetch('/api/auth/check');
  if (res.ok) {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    connectSocket();
    fetchLogs();
    loadProperties();
    fetchBackups();
  }
}

document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });

  if (res.ok) {
    document.getElementById('login-password').value = '';
    await checkAuth();
  } else {
    const data = await res.json();
    errEl.textContent = data.error || 'เข้าสู่ระบบไม่สำเร็จ';
  }
});

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' });
  location.reload();
}

function switchTab(panelId, btnEl) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(panelId).classList.remove('hidden');
  btnEl.classList.add('active');
}

function connectSocket() {
  if (socket) return;
  socket = io();

  socket.on('server_stats', data => {
    const statusEl = document.getElementById('server-status');
    statusEl.textContent = data.running ? '🟢 ออนไลน์' : '🔴 ออฟไลน์';
    statusEl.className = data.running ? 'badge online' : 'badge offline';

    const online = Number(data.online || 0);
    const max = Number(data.max || 0);
    document.getElementById('player-count').textContent = `${online} / ${max}`;
    document.getElementById('player-bar').style.width = `${max > 0 ? (online / max) * 100 : 0}%`;

    const cpu = Number(data.cpu || 0);
    document.getElementById('cpu-usage').textContent = `${cpu}%`;
    document.getElementById('cpu-bar').style.width = `${Math.min(100, cpu)}%`;

    document.getElementById('ram-usage').textContent = data.mem || '0 MB';
    if (data.version) document.getElementById('server-version').textContent = `Forge ${data.version}`;

    // อัปเดตรายชื่อผู้เล่นออนไลน์
    const box = document.getElementById('online-players-box');
    let list = Array.isArray(data.players) ? data.players : [];
    if (typeof data.players === 'string') {
      list = data.players.replace(/^\[|\]$/g, '').split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    }
    box.innerHTML = list.length > 0
      ? list.map(p => `<span class="player-chip" onclick="selectPlayer('${escapeHtml(p)}')">🟩 ${escapeHtml(p)}</span>`).join('')
      : 'ไม่มีผู้เล่นออนไลน์อยู่ในขณะนี้';
  });

  setInterval(() => {
    if (!document.getElementById('tab-console').classList.contains('hidden')) {
      fetchLogs();
    }
  }, 6000);
}

async function sendPowerAction(action) {
  if (!confirm(`ยืนยันคำสั่ง ${action} หรือไม่?`)) return;
  const res = await fetch(`/api/server/${action}`, { method: 'POST' });
  const data = await res.json();
  showAudit(res.ok ? `✅ ${data.message} (#${data.auditId})` : `❌ ${data.error}`, !res.ok);
}

async function fetchLogs() {
  const res = await fetch('/api/logs');
  if (!res.ok) return;
  const data = await res.json();
  const box = document.getElementById('console-output');
  box.textContent = (data.lines || []).join('\n') || 'ไม่มีข้อมูล Console Log';
  box.scrollTop = box.scrollHeight;
}

document.getElementById('console-form').addEventListener('submit', async e => {
  e.preventDefault();
  const input = document.getElementById('console-cmd');
  const command = input.value.trim();
  if (!command) return;

  const res = await fetch('/api/console', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ command })
  });
  const data = await res.json();
  if (res.ok) {
    input.value = '';
    showAudit(`💻 ส่งคำสั่ง /${data.command} (#${data.auditId})`);
    setTimeout(fetchLogs, 800);
  } else {
    showAudit(`❌ ${data.error}`, true);
  }
});

// --- server.properties GUI ---
async function loadProperties() {
  const res = await fetch('/api/properties');
  const data = await res.json();
  if (!res.ok) {
    document.getElementById('prop-list').textContent = `❌ ${data.error}`;
    return;
  }
  allProperties = data.items || [];
  dirtyChanges = {};
  updateDirtyBadge();

  const bakBtn = document.getElementById('btn-restore-bak');
  if (data.hasBackup) bakBtn.classList.remove('hidden');
  else bakBtn.classList.add('hidden');

  const categories = ['ทั้งหมด', ...new Set(allProperties.map(i => i.category))];
  document.getElementById('prop-categories').innerHTML = categories
    .map(cat => `<button class="cat-pill ${cat === activeCategory ? 'active' : ''}" onclick="setCategory('${escapeHtml(cat)}')">${escapeHtml(cat)}</button>`)
    .join('');

  renderProperties();
}

function setCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(el => {
    el.classList.toggle('active', el.textContent === cat);
  });
  renderProperties();
}

function updateDirtyBadge() {
  document.getElementById('dirty-count').textContent = Object.keys(dirtyChanges).length;
}

function onPropChange(key, newValue, originalValue) {
  if (String(newValue) === String(originalValue)) {
    delete dirtyChanges[key];
  } else {
    dirtyChanges[key] = String(newValue);
  }
  updateDirtyBadge();
  const card = document.getElementById(`prop-card-${key}`);
  if (card) card.classList.toggle('dirty', Object.prototype.hasOwnProperty.call(dirtyChanges, key));
}

function renderProperties() {
  const keyword = document.getElementById('prop-search').value.toLowerCase().trim();
  const filtered = allProperties.filter(item => {
    const matchCat = activeCategory === 'ทั้งหมด' || item.category === activeCategory;
    const matchText = !keyword || item.key.toLowerCase().includes(keyword) || item.label.toLowerCase().includes(keyword) || item.desc.toLowerCase().includes(keyword);
    return matchCat && matchText;
  });

  const container = document.getElementById('prop-list');
  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:var(--muted)">ไม่พบการตั้งค่าที่ตรงกับคำค้นหา</p>';
    return;
  }

  container.innerHTML = filtered.map(item => {
    const currentVal = Object.prototype.hasOwnProperty.call(dirtyChanges, item.key) ? dirtyChanges[item.key] : item.value;
    const isDirty = Object.prototype.hasOwnProperty.call(dirtyChanges, item.key);
    let controlHtml = '';

    if (item.type === 'boolean') {
      const checked = currentVal === 'true' ? 'checked' : '';
      controlHtml = `
        <label class="switch">
          <input type="checkbox" ${checked} onchange="onPropChange('${escapeHtml(item.key)}', this.checked ? 'true' : 'false', '${escapeHtml(item.value)}')">
          <span class="slider"></span>
          <span>${currentVal === 'true' ? 'เปิด (true)' : 'ปิด (false)'}</span>
        </label>`;
    } else if (item.type === 'select' && item.options) {
      const opts = item.options.map(o => `<option value="${escapeHtml(o)}" ${o === currentVal ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
      controlHtml = `<select onchange="onPropChange('${escapeHtml(item.key)}', this.value, '${escapeHtml(item.value)}')">${opts}</select>`;
    } else if (item.type === 'number') {
      controlHtml = `<input type="number" value="${escapeHtml(currentVal)}" oninput="onPropChange('${escapeHtml(item.key)}', this.value, '${escapeHtml(item.value)}')">`;
    } else {
      controlHtml = `<input type="text" value="${escapeHtml(currentVal)}" oninput="onPropChange('${escapeHtml(item.key)}', this.value, '${escapeHtml(item.value)}')">`;
    }

    return `
      <div id="prop-card-${escapeHtml(item.key)}" class="prop-item ${isDirty ? 'dirty' : ''}">
        <div>
          <div class="prop-title">${escapeHtml(item.label)}</div>
          <div class="prop-key">${escapeHtml(item.key)}</div>
          <div class="prop-desc">${escapeHtml(item.desc)}</div>
        </div>
        <div class="prop-control">${controlHtml}</div>
      </div>`;
  }).join('');
}

async function savePropertiesUI() {
  const keys = Object.keys(dirtyChanges);
  if (keys.length === 0) {
    return showAudit('⚠️ ยังไม่มีการแก้ไขค่าใดๆ', true);
  }
  const res = await fetch('/api/properties', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties: dirtyChanges })
  });
  const data = await res.json();
  showAudit(res.ok ? `✅ ${data.message}` : `❌ ${data.error}`, !res.ok);
  if (res.ok) await loadProperties();
}

async function applyModdedPresetUI() {
  if (!confirm('ปรับค่า server.properties ให้เหมาะกับ Crazy Craft 1.16.5 (เปิด allow-flight, max-tick-time=120000, view-distance=8) หรือไม่?')) return;
  const res = await fetch('/api/properties/preset-modded', { method: 'POST' });
  const data = await res.json();
  showAudit(res.ok ? `🚀 ${data.message}` : `❌ ${data.error}`, !res.ok);
  if (res.ok) await loadProperties();
}

async function restoreBackupUI() {
  if (!confirm('กู้คืนค่าทั้งหมดจากไฟล์สำรอง server.properties.bak หรือไม่?')) return;
  const res = await fetch('/api/properties/restore', { method: 'POST' });
  const data = await res.json();
  showAudit(res.ok ? `↩️ ${data.message}` : `❌ ${data.error}`, !res.ok);
  if (res.ok) await loadProperties();
}

// --- ผู้เล่น & Backup ---
function selectPlayer(name) {
  document.getElementById('target-player-name').value = name;
}

async function sendPlayerAction(action) {
  const player = document.getElementById('target-player-name').value.trim();
  if (!player) return showAudit('⚠️ กรุณากรอกชื่อตัวละครก่อน', true);

  const res = await fetch('/api/player', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, player })
  });
  const data = await res.json();
  showAudit(res.ok ? `✅ ${data.message} (#${data.auditId})` : `❌ ${data.error}`, !res.ok);
}

async function fetchBackups() {
  const res = await fetch('/api/backups');
  if (!res.ok) return;
  const data = await res.json();
  const list = document.getElementById('backup-list');
  if (!data.files || data.files.length === 0) {
    list.innerHTML = '<p style="color:var(--muted)">ยังไม่มีไฟล์ Backup ในระบบ</p>';
    return;
  }
  list.innerHTML = data.files.map(f => `
    <div class="backup-row">
      <div>
        <strong>📦 ${escapeHtml(f.name)}</strong><br>
        <small style="color:var(--muted)">${new Date(f.modified).toLocaleString('th-TH')}</small>
      </div>
      <span class="badge online">${escapeHtml(f.sizeMB)} MB</span>
    </div>`).join('');
}

checkAuth();