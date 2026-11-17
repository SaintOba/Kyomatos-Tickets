const jwt = require('jsonwebtoken');

// Requires a valid "Authorization: Bearer <token>" header.
// Sets req.user = { userId, email }.
module.exports = function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Please log in first' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { userId: decoded.userId, email: String(decoded.email).toLowerCase() };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired, please log in again' });
  }
};
