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

## Quick Start (Windows)

**Simplest way to start:**
1. Double-click `start.bat` in the project root
2. This automatically installs all dependencies and starts the backend server
3. Backend runs in a separate window on port 5000
4. Open your frontend URL in a browser (Netlify or local server)

## Manual Setup

1. Install frontend dependencies:
```bash
npm install
```

2. Install backend dependencies:
```bash
cd backend
npm install
cd ..
```

3. Configure environment variables:
   - Edit `backend/.env` with your credentials
   - `MONGO_URI` — MongoDB connection string
   - `PAYSTACK_SECRET_KEY` — Paystack secret key
   - `PAYSTACK_PUBLIC_KEY` — Paystack public key
   - `EMAIL_USER` — Gmail address
   - `EMAIL_PASS` — Gmail app-specific password

4. Start the backend server:
```bash
cd backend
node server.js
```

5. Open the frontend in your browser (http://localhost:3000 or your Netlify URL)

## Troubleshooting

- **Payment errors (net::ERR_CONNECTION_REFUSED)**: Ensure backend is running. Use `start.bat` or `node backend/server.js`
- **Dependencies not installing**: Make sure Node.js is installed (`node --version` should return a version)
- **Port 5000 already in use**: Kill the existing process or change PORT in `backend/.env`
- **Netlify payments failing**: Backend must be deployed to production (see DEPLOYMENT.md for hosting options)
- **Cache issues**: Hard refresh browser with Ctrl+F5 or Cmd+Shift+R

## Deployment

For production deployment:
1. Deploy backend to Render.com, Railway, or Heroku (see DEPLOYMENT.md)
2. Update production backend URL in `config.js`
3. Redeploy frontend to Netlify
4. Configure environment variables in backend hosting platform

See DEPLOYMENT.md for detailed step-by-step instructions.
