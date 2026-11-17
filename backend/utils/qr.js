const crypto = require('crypto');

// Signed QR payload: KYO1.<ticketId>.<signature>. Only the server can create a valid one,
// so a QR code can't be forged by guessing or editing a ticket id.
function sign(ticketId) {
  return crypto
    .createHmac('sha256', 'qr:' + (process.env.QR_SECRET || process.env.JWT_SECRET))
    .update(String(ticketId))
    .digest('hex')
    .slice(0, 24);
}

function signQr(ticketId) {
  return `KYO1.${ticketId}.${sign(ticketId)}`;
}

// Returns the ticketId if the code is genuine, otherwise null.
function verifyQr(code) {
  const parts = String(code || '').trim().split('.');
  if (parts.length !== 3 || parts[0] !== 'KYO1') return null;
  const [, ticketId, sig] = parts;
  const expected = sign(ticketId);
  if (sig.length !== expected.length) return null;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)) ? ticketId : null;
}

module.exports = { signQr, verifyQr };
