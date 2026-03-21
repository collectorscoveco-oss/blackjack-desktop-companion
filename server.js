const http = require('http');
const fs = require('fs');
const path = require('path');
const { getAppData, saveTransaction, deleteTransaction, todayKey } = require('./lib/db');
const { calculateTransaction } = require('./lib/calculations');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, data) {
  send(res, status, JSON.stringify(data), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
}

function getBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function serveStatic(req, res) {
  let requestPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.join(PUBLIC_DIR, path.normalize(requestPath));
  if (!filePath.startsWith(PUBLIC_DIR)) return send(res, 403, 'Forbidden');
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    send(res, 200, data, { 'Content-Type': MIME_TYPES[path.extname(filePath)] || 'application/octet-stream' });
  });
}

function toCsv(transactions) {
  const headers = ['time','driver','order_number','order_total','assumed_bill','give_driver','customer_paid','back_to_register','driver_tip'];
  const rows = transactions.map((tx) => [
    tx.createdAt,
    tx.driverName,
    tx.orderNumber,
    tx.orderTotal,
    tx.assumedBill,
    tx.giveDriver,
    tx.customerPaid,
    tx.backToRegister,
    tx.driverTip
  ]);
  return [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
    .join('\n');
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/api/app-data') {
      return sendJson(res, 200, getAppData(url.searchParams.get('date') || todayKey()));
    }

    if (req.method === 'POST' && url.pathname === '/api/calculate') {
      const body = JSON.parse((await getBody(req)) || '{}');
      return sendJson(res, 200, calculateTransaction(body.orderTotal, body.customerPaid));
    }

    if (req.method === 'POST' && url.pathname === '/api/transactions') {
      const body = JSON.parse((await getBody(req)) || '{}');
      return sendJson(res, 200, { ok: true, transaction: saveTransaction(body) });
    }

    if (req.method === 'PUT' && url.pathname.startsWith('/api/transactions/')) {
      const id = url.pathname.split('/').pop();
      const body = JSON.parse((await getBody(req)) || '{}');
      return sendJson(res, 200, { ok: true, transaction: saveTransaction({ ...body, id }) });
    }

    if (req.method === 'DELETE' && url.pathname.startsWith('/api/transactions/')) {
      const id = url.pathname.split('/').pop();
      const ok = deleteTransaction(id);
      return sendJson(res, ok ? 200 : 404, { ok });
    }

    if (req.method === 'GET' && url.pathname === '/api/export.csv') {
      const appData = getAppData(url.searchParams.get('date') || todayKey());
      return send(res, 200, toCsv(appData.transactions), {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="driver-cash-tool-${appData.businessDate}.csv"`
      });
    }

    if (req.method === 'GET') return serveStatic(req, res);
    return send(res, 405, 'Method not allowed');
  } catch (error) {
    return sendJson(res, 400, { ok: false, error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Blackjack Basic Strategy Overlay running on http://${HOST}:${PORT}`);
});
