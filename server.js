const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile } = require('child_process');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const KANBAN_PATH = path.join(ROOT, 'kanban.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(data));
}

function sendText(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(data);
}

function runCommand(file, args = []) {
  return new Promise((resolve) => {
    execFile(file, args, { timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({
        ok: !error,
        code: error && typeof error.code === 'number' ? error.code : 0,
        stdout: stdout || '',
        stderr: stderr || '',
        error: error ? error.message : null
      });
    });
  });
}

function parseOverviewTable(output) {
  const lines = output.split('\n');
  const map = {};
  let inOverview = false;
  for (const line of lines) {
    if (line.trim() === 'Overview') {
      inOverview = true;
      continue;
    }
    if (inOverview && line.trim() === 'Security audit') {
      break;
    }
    if (!inOverview) continue;

    const match = line.match(/^│\s*(.*?)\s*│\s*(.*?)\s*│$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim();
    if (key && key !== 'Item' && value && !/^[-└┌├┬┴]+$/.test(key)) {
      map[key] = value;
    }
  }
  return map;
}

function parseSecurityAudit(output) {
  const summaryMatch = output.match(/Summary:\s*(\d+) critical\s*·\s*(\d+) warn\s*·\s*(\d+) info/i);
  const counts = summaryMatch
    ? {
        critical: Number(summaryMatch[1]),
        warn: Number(summaryMatch[2]),
        info: Number(summaryMatch[3])
      }
    : { critical: 0, warn: 0, info: 0 };

  const issues = [];
  const lines = output.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const severityOnly = lines[i].trim().match(/^(CRITICAL|WARN|INFO)$/i);
    const severityInline = lines[i].trim().match(/^(CRITICAL|WARN|INFO)\s+(.+)$/i);
    if (!severityOnly && !severityInline) continue;

    const severity = (severityOnly || severityInline)[1].toUpperCase();
    let title = severityInline ? severityInline[2].trim() : '';
    let detail = '';
    let fix = '';

    let j = i + 1;
    if (!title && lines[j] && lines[j].trim()) {
      title = lines[j].trim();
      j += 1;
    }

    for (; j < lines.length; j += 1) {
      const current = lines[j].trim();
      if (!current) continue;
      if (/^(CRITICAL|WARN|INFO)(\s+.+)?$/i.test(current)) {
        j -= 1;
        break;
      }
      const fixMatch = current.match(/^Fix:\s*(.+)$/i);
      if (fixMatch) {
        fix = fixMatch[1].trim();
      } else if (!detail) {
        detail = current;
      } else {
        detail += ` ${current}`;
      }
    }

    issues.push({ severity, title, detail, fix });
    i = j;
  }

  return { counts, issues };
}

function getDiskMetrics() {
  return new Promise((resolve) => {
    execFile('df', ['-k', ROOT], { timeout: 5000 }, (error, stdout) => {
      if (error || !stdout) {
        resolve({ totalGb: null, usedGb: null, freeGb: null, usedPercent: null });
        return;
      }
      const lines = stdout.trim().split('\n');
      const parts = (lines[1] || '').split(/\s+/);
      if (parts.length < 6) {
        resolve({ totalGb: null, usedGb: null, freeGb: null, usedPercent: null });
        return;
      }
      const totalKb = Number(parts[1]);
      const usedKb = Number(parts[2]);
      const freeKb = Number(parts[3]);
      const usedPercent = Number(String(parts[4]).replace('%', ''));
      resolve({
        totalGb: +(totalKb / 1024 / 1024).toFixed(1),
        usedGb: +(usedKb / 1024 / 1024).toFixed(1),
        freeGb: +(freeKb / 1024 / 1024).toFixed(1),
        usedPercent
      });
    });
  });
}

function scoreSecurity(counts) {
  let score = 100;
  score -= counts.critical * 35;
  score -= counts.warn * 12;
  score -= counts.info * 4;
  return Math.max(0, Math.min(100, score));
}

function readKanban() {
  const raw = fs.readFileSync(KANBAN_PATH, 'utf8');
  return JSON.parse(raw);
}

function writeKanban(board) {
  fs.writeFileSync(KANBAN_PATH, JSON.stringify(board, null, 2) + '\n', 'utf8');
}

async function getStatusPayload() {
  const [statusResult, auditResult, disk] = await Promise.all([
    runCommand('openclaw', ['status']),
    runCommand('openclaw', ['security', 'audit']),
    getDiskMetrics()
  ]);

  const statusOverview = parseOverviewTable(statusResult.stdout);
  const audit = parseSecurityAudit(auditResult.stdout);
  const totalMemGb = os.totalmem() / 1024 / 1024 / 1024;
  const freeMemGb = os.freemem() / 1024 / 1024 / 1024;
  const usedMemGb = totalMemGb - freeMemGb;

  return {
    online: statusResult.ok,
    generatedAt: new Date().toISOString(),
    system: {
      hostname: os.hostname(),
      platform: `${os.type()} ${os.release()}`,
      uptimeHours: +(os.uptime() / 3600).toFixed(1),
      cpuLoad: os.loadavg().map((value) => +value.toFixed(2)),
      memory: {
        totalGb: +totalMemGb.toFixed(1),
        usedGb: +usedMemGb.toFixed(1),
        freeGb: +freeMemGb.toFixed(1),
        usedPercent: +((usedMemGb / totalMemGb) * 100).toFixed(1)
      },
      disk
    },
    openclaw: {
      overview: statusOverview,
      rawStatus: statusResult.stdout || statusResult.stderr,
      rawAudit: auditResult.stdout || auditResult.stderr
    },
    security: {
      score: scoreSecurity(audit.counts),
      ...audit
    }
  };
}

function serveStatic(req, res) {
  let requestPath = req.url === '/' ? '/index.html' : req.url;
  requestPath = requestPath.split('?')[0];
  const filePath = path.join(PUBLIC_DIR, path.normalize(requestPath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, 'Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendText(res, 404, 'Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url.startsWith('/api/status')) {
      const payload = await getStatusPayload();
      sendJson(res, 200, payload);
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/kanban')) {
      sendJson(res, 200, readKanban());
      return;
    }

    if (req.method === 'POST' && req.url.startsWith('/api/kanban')) {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1024 * 1024) {
          req.destroy();
        }
      });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body || '{}');
          writeKanban(parsed);
          sendJson(res, 200, { ok: true, board: parsed });
        } catch (error) {
          sendJson(res, 400, { ok: false, error: error.message });
        }
      });
      return;
    }

    if (req.method === 'GET') {
      serveStatic(req, res);
      return;
    }

    sendText(res, 405, 'Method not allowed');
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Mission Control dashboard running on http://${HOST}:${PORT}`);
});
