const axios = require('axios');
const https = require('https');
const config = require('../config/config');

const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  maxSockets: 10
});

const craftyClient = axios.create({
  baseURL: `${config.craftyUrl}/api/v2`,
  headers: { Authorization: `Bearer ${config.craftyToken}` },
  httpsAgent,
  timeout: 8000
});

// Cache ข้อมูลสถิติ 3 วินาที ลดภาระการยิงซ้ำซ้อน
let statsCache = { data: null, expiresAt: 0 };
let inflightStatsPromise = null;

function invalidateStatsCache() {
  statsCache = { data: null, expiresAt: 0 };
}

async function getServerStats(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && statsCache.data && now < statsCache.expiresAt) {
    return statsCache.data;
  }
  if (inflightStatsPromise) return inflightStatsPromise;

  inflightStatsPromise = craftyRequest('get', `/servers/${config.serverId}/stats`, null, 2)
    .then(res => {
      statsCache = { data: res.data.data, expiresAt: Date.now() + 3000 };
      return statsCache.data;
    })
    .finally(() => {
      inflightStatsPromise = null;
    });

  return inflightStatsPromise;
}

async function craftyRequest(method, url, data = null, retries = 3) {
  if (method.toLowerCase() !== 'get') invalidateStatsCache();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const opts = { method, url };
      if (data !== null) {
        opts.data = data;
        if (typeof data === 'string') opts.headers = { 'Content-Type': 'text/plain' };
      }
      return await craftyClient.request(opts);
    } catch (err) {
      if (err.response?.status === 400 || err.response?.status === 401 || err.response?.status === 403) {
        console.error(`[Crafty API Auth/Req Error] ${method.toUpperCase()} ${url} ->`, err.response?.data || err.message);
        throw err;
      }
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, attempt * 1500));
    }
  }
}

module.exports = { craftyRequest, getServerStats, invalidateStatsCache };