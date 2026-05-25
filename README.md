# Kyomatos Ticket Booking

A lightweight event ticket booking website with client-side authentication, Paystack payment integration, and PDF ticket generation.

## Project Structure

- `index.html` — main landing page and navigation entry point
- `about.html` — project/about page
- `contact.html` — contact page
- `login.html` — login page
- `my-tickets.html` — ticket management page
- `ticket-view.html` — ticket detail preview page
- `style.css`, `about.css`, `ticket-detail.css`, `header.css`, `login.css` — frontend styles
- `backend/` — Node/Express backend
  - `server.js` — Express server and Paystack callbacks
  - `routes/` — API route definitions
  - `controllers/` — payment and authentication logic
  - `models/` — user and ticket data models
  - `utils/sendEmail.js` — email helper

## Setup

1. Install dependencies in the backend:

```bash
cd backend
npm install
```

2. Start the backend server:

```bash
cd backend
node server.js
```

3. Open the frontend by opening `index.html` in your browser.

## Notes

- The backend is expected to run on port `5000`.
- Payment initialization happens at `http://localhost:5000/api/pay/initialize`.
- Navbar styling is centralized in `header.css`.

## Troubleshooting

- If the frontend does not show the updated navbar styles, refresh the browser cache (Ctrl+F5).
- Ensure the backend is running before attempting payment flows.
