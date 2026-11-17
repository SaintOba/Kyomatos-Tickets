// API Configuration
// Use this to switch between local development and production URLs

const API_CONFIG = {
  // Automatically detect the API URL based on environment
  getBaseURL: function() {
    // Local development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    
    // Production on Netlify
    // ======================================
    // IMPORTANT: Set your deployed backend URL here
    // Examples:
    // - Render: https://kyomatos-backend.onrender.com
    // - Railway: https://kyomatos-backend-production.up.railway.app
    // - Heroku: https://kyomatos-backend.herokuapp.com
    // ======================================
    
    // Any other host (custom domain, etc.): use the production backend
    return 'https://kyomatos-backend.onrender.com';
  },
  
  baseURL: null // Will be initialized on page load
};

// Initialize the base URL
API_CONFIG.baseURL = API_CONFIG.getBaseURL();

// Escape text before putting it inside innerHTML
API_CONFIG.esc = function(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
};

// Load a protected image (needs the login token) into an <img>
API_CONFIG.loadAuthedImage = async function(img, path) {
  try {
    const r = await fetch(`${API_CONFIG.baseURL}${path}`, { headers: API_CONFIG.authHeaders() });
    if (r.ok) img.src = URL.createObjectURL(await r.blob());
  } catch (e) {}
};

// Authorization header for logged-in API calls
API_CONFIG.authHeaders = function() {
  let token = null;
  try { token = localStorage.getItem('jwt_token'); } catch (e) {}
  return token ? { Authorization: 'Bearer ' + token } : {};
};

// Clear the session and send the user to the login page
API_CONFIG.forceLogin = function() {
  try {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('jwt_token');
  } catch (e) {}
  window.location.href = 'login.html';
};

// Download a ticket PDF (the endpoint needs the login token, so a plain link won't work)
API_CONFIG.downloadTicket = async function(ticketId) {
  const response = await fetch(`${API_CONFIG.baseURL}/api/tickets/download/${encodeURIComponent(ticketId)}`, {
    headers: API_CONFIG.authHeaders()
  });
  if (response.status === 401) return API_CONFIG.forceLogin();
  if (!response.ok) return alert('Could not download this ticket. Please try again.');
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kyomatos_ticket_${ticketId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => window.URL.revokeObjectURL(url), 1000);
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API_CONFIG;
}
