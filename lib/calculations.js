function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parseMoney(value) {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value).replace(/[^0-9.\-]/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? roundMoney(parsed) : 0;
}

function calculateTransaction(orderTotalInput, customerPaidInput) {
  const orderTotal = parseMoney(orderTotalInput);
  const customerPaid = parseMoney(customerPaidInput);
  const assumedBill = Math.ceil(orderTotal / 20) * 20;
  const giveDriver = roundMoney(Math.max(assumedBill - orderTotal, 0));
  const backToRegister = roundMoney(orderTotal);
  const driverTip = roundMoney(Math.max(customerPaid - assumedBill, 0));

  return {
    orderTotal: roundMoney(orderTotal),
    customerPaid: roundMoney(customerPaid),
    assumedBill: roundMoney(assumedBill),
    giveDriver,
    backToRegister,
    driverTip
  };
}

module.exports = {
  roundMoney,
  parseMoney,
  calculateTransaction
};
