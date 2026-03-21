const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { calculateTransaction } = require('./calculations');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function createSeedData() {
  const createdAt = new Date().toISOString();
  const drivers = [
    { id: 'drv_maria', name: 'Maria', active: true, createdAt },
    { id: 'drv_james', name: 'James', active: true, createdAt },
    { id: 'drv_luis', name: 'Luis', active: true, createdAt }
  ];

  const base = [
    { driverId: 'drv_maria', driverName: 'Maria', orderNumber: '1001', orderTotal: 17.6, customerPaid: 20, createdAt },
    { driverId: 'drv_james', driverName: 'James', orderNumber: '1002', orderTotal: 28.75, customerPaid: 50, createdAt },
    { driverId: 'drv_luis', driverName: 'Luis', orderNumber: '1003', orderTotal: 41.1, customerPaid: 60, createdAt }
  ];

  const transactions = base.map((item) => ({
    id: crypto.randomUUID(),
    businessDate: todayKey(),
    ...item,
    ...calculateTransaction(item.orderTotal, item.customerPaid),
    updatedAt: createdAt
  }));

  return { drivers, transactions, dailySummaries: [] };
}

function ensureDb() {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(createSeedData(), null, 2) + '\n', 'utf8');
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2) + '\n', 'utf8');
}

function sortTransactions(transactions) {
  return [...transactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function summarizeTransactions(transactions) {
  const dailySummary = {
    totalTransactions: transactions.length,
    totalGiveDriver: 0,
    totalBackToRegister: 0,
    totalDriverTips: 0
  };

  const driverMap = new Map();

  for (const tx of transactions) {
    dailySummary.totalGiveDriver += tx.giveDriver;
    dailySummary.totalBackToRegister += tx.backToRegister;
    dailySummary.totalDriverTips += tx.driverTip;

    if (!driverMap.has(tx.driverName)) {
      driverMap.set(tx.driverName, {
        driverName: tx.driverName,
        deliveries: 0,
        totalGiveDriver: 0,
        totalBackToRegister: 0,
        totalTips: 0
      });
    }

    const row = driverMap.get(tx.driverName);
    row.deliveries += 1;
    row.totalGiveDriver += tx.giveDriver;
    row.totalBackToRegister += tx.backToRegister;
    row.totalTips += tx.driverTip;
  }

  for (const key of Object.keys(dailySummary)) {
    dailySummary[key] = Math.round((dailySummary[key] + Number.EPSILON) * 100) / 100;
  }

  const driverSummary = Array.from(driverMap.values()).map((row) => ({
    ...row,
    totalGiveDriver: Math.round((row.totalGiveDriver + Number.EPSILON) * 100) / 100,
    totalBackToRegister: Math.round((row.totalBackToRegister + Number.EPSILON) * 100) / 100,
    totalTips: Math.round((row.totalTips + Number.EPSILON) * 100) / 100
  })).sort((a, b) => a.driverName.localeCompare(b.driverName));

  return { dailySummary, driverSummary };
}

function upsertDailySummary(db, businessDate) {
  const dayTransactions = db.transactions.filter((tx) => tx.businessDate === businessDate);
  const summary = summarizeTransactions(dayTransactions).dailySummary;
  const row = {
    businessDate,
    ...summary,
    updatedAt: new Date().toISOString()
  };
  const index = db.dailySummaries.findIndex((item) => item.businessDate === businessDate);
  if (index >= 0) db.dailySummaries[index] = row;
  else db.dailySummaries.push(row);
}

function getAppData(date = todayKey()) {
  const db = readDb();
  const transactions = sortTransactions(db.transactions.filter((tx) => tx.businessDate === date));
  const drivers = [...db.drivers].sort((a, b) => a.name.localeCompare(b.name));
  const summaries = summarizeTransactions(transactions);
  return {
    businessDate: date,
    drivers,
    transactions,
    ...summaries
  };
}

function saveTransaction(input) {
  const db = readDb();
  const businessDate = input.businessDate || todayKey();
  const now = new Date().toISOString();
  const driverName = String(input.driverName || '').trim();
  const existingDriver = db.drivers.find((driver) => driver.name.toLowerCase() === driverName.toLowerCase());
  let driverId = existingDriver ? existingDriver.id : null;

  if (!driverName) throw new Error('Driver name is required.');
  if (!String(input.orderNumber || '').trim()) throw new Error('Order number is required.');

  if (!existingDriver) {
    driverId = crypto.randomUUID();
    db.drivers.push({ id: driverId, name: driverName, active: true, createdAt: now });
  }

  const calculated = calculateTransaction(input.orderTotal, input.customerPaid);
  const payload = {
    id: input.id || crypto.randomUUID(),
    businessDate,
    driverId,
    driverName,
    orderNumber: String(input.orderNumber).trim(),
    ...calculated,
    createdAt: input.createdAt || now,
    updatedAt: now
  };

  const index = db.transactions.findIndex((tx) => tx.id === payload.id);
  if (index >= 0) db.transactions[index] = payload;
  else db.transactions.push(payload);

  upsertDailySummary(db, businessDate);
  writeDb(db);
  return payload;
}

function deleteTransaction(id) {
  const db = readDb();
  const existing = db.transactions.find((tx) => tx.id === id);
  if (!existing) return false;
  db.transactions = db.transactions.filter((tx) => tx.id !== id);
  upsertDailySummary(db, existing.businessDate);
  writeDb(db);
  return true;
}

module.exports = {
  DB_PATH,
  todayKey,
  getAppData,
  saveTransaction,
  deleteTransaction,
  readDb
};
