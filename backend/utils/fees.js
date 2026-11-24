// Kyomatos service fee: a flat amount per ticket, set on each event in the admin page.
// The organiser keeps the full ticket price; the buyer pays price + fee; Kyomatos keeps the fee
// (and pays Paystack's charges out of it). Free events (price 0) never carry a fee.
const DEFAULT_FEE = Number(process.env.DEFAULT_SERVICE_FEE) >= 0 && process.env.DEFAULT_SERVICE_FEE !== undefined && process.env.DEFAULT_SERVICE_FEE !== ""
  ? Number(process.env.DEFAULT_SERVICE_FEE) : 500;

function feePerTicket(event) {
  if (!event || !(Number(event.price) > 0)) return 0;
  const f = Number(event.serviceFee);
  return Number.isFinite(f) && f >= 0 && event.serviceFee !== null && event.serviceFee !== undefined ? Math.round(f) : DEFAULT_FEE;
}
function serviceFee(event, quantity) {
  return feePerTicket(event) * Math.max(0, Math.floor(Number(quantity) || 0));
}
module.exports = { serviceFee, feePerTicket, DEFAULT_FEE };
