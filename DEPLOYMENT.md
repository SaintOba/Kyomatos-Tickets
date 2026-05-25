# Kyomatos Backend Deployment Guide

Your Kyomatos ticketing platform is now hosted on Netlify, but you need to deploy the backend to make payments work. Here's how to do it:

## Option 1: Deploy to Render.com (Recommended - Free Tier)

### Steps:

1. **Go to [render.com](https://render.com)** and sign up
2. **Create a new Web Service**:
   - Connect your GitHub repository (SaintOba/Kyomatos-Tickets)
   - Select the `main` branch
   - Set the root directory to `backend`

3. **Configure the service**:
   - **Name**: kyomatos-backend
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`

4. **Add environment variables** in Render dashboard:
   ```
   PORT=5000
   MONGO_URI=mongodb+srv://VicOba23:Test1234@cluster0.aowni7u.mongodb.net/?appName=Cluster0
   JWT_SECRET=aksd89asdja89sdjA9sdjA90898asd0asdas
   PAYSTACK_SECRET_KEY=sk_test_31b97d6825ae7a5cc959c5f20d92d3e089e917b9
   PAYSTACK_PUBLIC_KEY=pk_test_ee6cb2740cb24ab6b10432d30e3aa02565b10ef4
   EMAIL_USER=kyomatosevents@gmail.com
   EMAIL_PASS=ylxbxlbnonnuoriw
   BACKEND_URL=https://kyomatos-backend.onrender.com (your deployed URL)
   FRONTEND_URL=https://your-netlify-site.netlify.app
   ```

5. **Deploy** - Render will automatically deploy when you push to main

### Get Your Backend URL:
Once deployed, Render gives you a URL like: `https://kyomatos-backend.onrender.com`

---

## Option 2: Deploy to Railway.app

1. Go to [railway.app](https://railway.app)
2. Create new project → GitHub repo
3. Select the repository and connect
4. Set root directory to `backend`
5. Add the same environment variables as above
6. Deploy

---

## Option 3: Deploy to Heroku (May require paid tier now)

1. Go to [heroku.com](https://heroku.com)
2. Create new app
3. Connect GitHub repository
4. Enable auto-deploy from main
5. Add environment variables in Settings
6. Deploy

---

## Update Your Frontend

Once you have your backend URL (e.g., `https://kyomatos-backend.onrender.com`):

### Edit `config.js`:
```javascript
// Around line 20, replace:
return 'http://localhost:5000'; // Change this line

// With:
return 'https://kyomatos-backend.onrender.com'; // Your actual backend URL
```

### Update `.env` in backend:
```
BACKEND_URL=https://kyomatos-backend.onrender.com
FRONTEND_URL=https://kyomatos-tickets.netlify.app (your Netlify URL)
```

---

## Testing the Integration

1. Make sure the backend is deployed and running
2. Update `config.js` with your backend URL
3. Rebuild and redeploy your Netlify site
4. Test the payment flow on your Netlify URL

---

## Troubleshooting

### "404 Resource not found" during payment
- Make sure `BACKEND_URL` in backend `.env` matches your deployed URL
- Make sure `config.js` in frontend has the correct backend URL
- Check that your backend is running (Render should show "Live")

### CORS errors
- Your backend already has CORS enabled for all origins
- This should work automatically once deployed

### Email not sending
- Verify `EMAIL_USER` and `EMAIL_PASS` in `.env`
- Gmail may require [app-specific password](https://myaccount.google.com/apppasswords)
- You may need to disable 2FA temporarily and create an app password

---

## Quick Deployment Checklist

- [ ] Backend deployed to Render/Railway/Heroku
- [ ] Backend URL obtained (e.g., https://kyomatos-backend.onrender.com)
- [ ] `config.js` updated with backend URL
- [ ] Backend `.env` has correct `BACKEND_URL` and `FRONTEND_URL`
- [ ] Frontend redeployed to Netlify
- [ ] Payment flow tested on Netlify URL

**Need help?** Check your backend logs in Render/Railway dashboard for errors.
