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
    
    if (window.location.hostname.includes('netlify.app')) {
      // Replace with your actual deployed backend URL
      return 'http://localhost:5000'; // Change this to your production backend URL
    }
    
    // Default fallback
    return 'http://localhost:5000';
  },
  
  baseURL: null // Will be initialized on page load
};

// Initialize the base URL
API_CONFIG.baseURL = API_CONFIG.getBaseURL();

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API_CONFIG;
}
