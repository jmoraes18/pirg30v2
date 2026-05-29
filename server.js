require('dotenv').config();
const express      = require('express');
const fetch        = require('node-fetch');
const https        = require('https');
const fs           = require('fs');
const { execSync } = require('child_process');

const app   = express();
const agent = new https.Agent({ rejectUnauthorized: false });

// ── Configuração via .env ─────────────────────────────────────────────────────
const UNIFI_HOST = 'https://localhost:8443';
const UNIFI_USER = process.env.UNIFI_USER || 'admin';
const UNIFI_PASS = process.env.UNIFI_PASS || '';
const UNIFI_SITE = process.env.UNIFI_SITE || 'default';

const AG_USER = process.env.AG_USER || 'admin';
const AG_PASS = process.env.AG_PASS || '';
const AG_AUTH = 'Basic ' + Buffer.from(AG_USER + ':' + AG_PASS).toString('base64');

const NVD_HOST    = process.env.NVD_HOST    || 'https://192.168.200.100';
const NVD_USER    = process.env.NVD_USER    || 'admin';
const NVD_PASS    = process.env.NVD_PASS    || '';
const NVD_CAMERAS = parseInt(process.env.NVD_CAMERAS || '6');

let uniCookie   = '';
let uniCookieAt = 0;

// ── UniFi ─────────────────────────────────────────────────────────────────────
async function unifiLogin() {
  const r = await fetch(UNIFI_HOST + '/api/login', {
    method: 'POST', agent,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: UNIFI_USER, password: UNIFI_PASS })
  });
  if (!r.ok) throw new Error('UniFi login falhou: ' + r.status);
  uniCookie   = r.headers.get('set-cookie') || '';
  uniCookieAt = Date.now();
}

async function unifiFetch(path) {
  if (!uniCookie || Date.now() - uniCookieAt > 25 * 60 * 1000) await unifiLogin();
  const r = await fetch(UNIFI_HOST + path, { agent, headers: { Cookie: uniCookie } });
  if (r.status === 401) { uniCookie = ''; return unifiFetch(path); }
  const text = await r.text();
  try { return JSON.parse(text); }
  catch { throw new Error('UniFi resposta inválida: ' + text.slice(0, 100)); }
}

// ── NVD Intelbras (Digest Auth) ───────────────────────────────────────────────
function md5(str) {
  return require('crypto').createHash('md5').update(str).digest('hex');
}

async function nvdFetch(p) {
  const r1      = await fetch(NVD_HOST + p, { agent });
  const wwwAuth = r1.headers.get('www-authenticate') || '';
  if (!wwwAuth.includes('Digest')) return r1.text();
  const realm  = (wwwAuth.match(/realm="([^"]+)"/)  || [])[1] || '';
  const nonce  = (wwwAuth.match(/nonce="([^"]+)"/)  || [])[1] || '';
  const qop    = (wwwAuth.match(/qop="?([^",]+)"?/) || [])[1] || '';
  const nc     = '00000001';
  const cnonce = Math.random().toString(36).slice(2, 10);
  const ha1    = md5(`${NVD_USER}:${realm}:${NVD_PASS}`);
  const ha2    = md5(`GET:${p}`);
  const resp   = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`);
  const authHeader = `Digest username="${NVD_USER}", realm="${realm}", nonce="${nonce}", uri="${p}", ` +
    (qop ? `qop=${qop}, nc=${nc}, cnonce="${cnonce}", ` : '') +
    `response="${resp}"`;
  return fetch(NVD_HOST + p, { agent, headers: { Authorization: authHeader } }).then(r => r.text());
}

function parseKV(text) {
  const obj = {};
  (text || '').split('\n').forEach(line => {
    const idx = line.indexOf('=');
    if (idx > 0) obj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  });
  return obj;
}

function bytesToGB(b) { return (parseFloat(b) / 1073741824).toFixed(1); }

// ── Sistema ───────────────────────────────────────────────────────────────────
function readSys(p, fallback = '0') {
  try { return fs.readFileSync(p, 'utf8').trim(); } catch { return fallback; }
}

function getCpuUsage() {
  try {
    const out = execSync("top -bn1 | grep 'Cpu(s)'", { timeout: 2000 }).toString();
    const m   = out.match(/(\d+\.\d+)\s+id/);
    return m ? Math.round(100 - parseFloat(m[1])) : 0;
  } catch { return 0; }
}

function getUptime() {
  const secs = parseFloat(readSys('/proc/uptime').split(' ')[0]);
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`;
}

// ── Rotas ─────────────────────────────────────────────────────────────────────
app.use(express.static('public'));
app.use('/snapshots', express.static('/home/joao/snapshots'));

app.get('/api/stats', async (req, res) => {
  try {
    const [apData, agStats, agStatus] = await Promise.all([
      unifiFetch('/api/s/' + UNIFI_SITE + '/stat/device'),
      fetch('http://localhost:80/control/stats',  { headers: { Authorization: AG_AUTH } }).then(r => r.json()),
      fetch('http://localhost:80/control/status', { headers: { Authorization: AG_AUTH } }).then(r => r.json())
    ]);

    // NVD
    let nvd = { online: false, name: 'NVD - RG30', diskTotal: '—', diskUsed: '—', diskPct: 0, diskState: '—', cameras: NVD_CAMERAS };
    try {
      const [nameRaw, storageRaw] = await Promise.all([
        nvdFetch('/cgi-bin/magicBox.cgi?action=getMachineName'),
        nvdFetch('/cgi-bin/storageDevice.cgi?action=getDeviceAllInfo')
      ]);
      const nameKV    = parseKV(nameRaw);
      const storageKV = parseKV(storageRaw);
      const total     = storageKV['list.info[0].Detail[0].TotalBytes'] || '0';
      const used      = storageKV['list.info[0].Detail[0].UsedBytes']  || '0';
      const state     = storageKV['list.info[0].State'] || '—';
      const pct       = parseFloat(total) > 0 ? Math.round((parseFloat(used) / parseFloat(total)) * 100) : 0;
      nvd = {
        online: true,
        name:       nameKV['name'] || 'NVD - RG30',
        diskTotal:  bytesToGB(total) + ' GB',
        diskUsed:   bytesToGB(used)  + ' GB',
        diskPct:    pct,
        diskState:  state === 'Success' ? 'saudável' : state,
        cameras:    NVD_CAMERAS
      };
    } catch { /* NVD offline */ }

    const aps = (apData.data || [])
      .filter(d => d.type === 'uap')
      .map(ap => ({
        name:    ap.name || ap.model || 'AP',
        state:   ap.state,
        clients: ap.num_sta || 0,
        band:    (ap.radio_table || []).map(r => r.radio === 'ng' ? '2.4G' : '5G').join('+')
      }));

    const memInfo  = readSys('/proc/meminfo');
    const memTotal = parseInt((memInfo.match(/MemTotal:\s+(\d+)/)     || [0,0])[1]);
    const memAvail = parseInt((memInfo.match(/MemAvailable:\s+(\d+)/) || [0,0])[1]);
    const tempRaw  = parseInt(readSys('/sys/class/thermal/thermal_zone0/temp', '0'));

    const services = { unifi: true, adguard: !!agStatus, motion: false };
    try { execSync('systemctl is-active --quiet motion'); services.motion = true; } catch {}

    res.json({
      aps,
      adguard: {
        queries:    agStats.num_dns_queries       || 0,
        blocked:    agStats.num_blocked_filtering || 0,
        pct:        agStats.num_dns_queries > 0
                      ? ((agStats.num_blocked_filtering / agStats.num_dns_queries) * 100).toFixed(1)
                      : '0.0',
        topBlocked: (agStats.top_blocked_domains || []).slice(0, 5)
      },
      nvd,
      system: {
        temp:     Math.round(tempRaw / 1000),
        cpu:      getCpuUsage(),
        ramUsed:  Math.round((memTotal - memAvail) / 1024),
        ramTotal: Math.round(memTotal / 1024),
        uptime:   getUptime()
      },
      services
    });
  } catch (err) {
    uniCookie = '';
    res.status(500).json({ error: err.message });
  }
});

app.listen(3500, '0.0.0.0', () => console.log('[Dashboard API] http://localhost:3500'));
