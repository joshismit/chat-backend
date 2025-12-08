# Render Deployment Checklist

Use this checklist to ensure a smooth deployment to Render.

## Pre-Deployment

- [ ] Code is pushed to Git repository (GitHub/GitLab/Bitbucket)
- [ ] MongoDB Atlas cluster is created and accessible
- [ ] MongoDB connection string (MONGO_URI) is ready
- [ ] JWT_SECRET is generated (use: `openssl rand -base64 32`)

## Render Configuration

- [ ] Created Render account
- [ ] Created new Web Service
- [ ] Connected Git repository
- [ ] Set Root Directory: `backend`
- [ ] Set Build Command: `npm install && npm run build`
- [ ] Set Start Command: `npm start`
- [ ] Set Environment: `Node`

## Environment Variables

- [ ] `MONGO_URI` - MongoDB connection string
- [ ] `JWT_SECRET` - Strong secret key (32+ characters)
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGIN=*` (or specific domains)
- [ ] `PORT` - Render sets this automatically (optional to set)

## Post-Deployment

- [ ] Service builds successfully (check Build Logs)
- [ ] Service starts without errors (check Runtime Logs)
- [ ] Health endpoint works: `GET https://your-service.onrender.com/health`
- [ ] Test authentication: `POST /auth/verify-otp`
- [ ] Test SSE connection: `GET /sse/connect?token=...`
- [ ] Update frontend API URL to Render URL

## MongoDB Setup

- [ ] MongoDB Atlas IP whitelist includes `0.0.0.0/0` (or Render IPs)
- [ ] Database user has read/write permissions
- [ ] Connection string includes database name
- [ ] Connection string is URL-encoded (if special characters)

## Frontend Update

- [ ] Update `.env` file:
  ```env
  EXPO_PUBLIC_API_URL=https://your-service-name.onrender.com
  ```
- [ ] Or update `app.json`:
  ```json
  {
    "expo": {
      "extra": {
        "apiUrl": "https://your-service-name.onrender.com"
      }
    }
  }
  ```
- [ ] Test mobile app connects to Render backend
- [ ] Test QR code login flow
- [ ] Test message sending/receiving

## Monitoring

- [ ] Check Render logs for errors
- [ ] Monitor service metrics (CPU, Memory)
- [ ] Set up alerts (if using paid plan)
- [ ] Test service wake-up time (free tier)

## Troubleshooting

If deployment fails:

1. **Check Build Logs**
   - Look for TypeScript errors
   - Verify `npm install` completes
   - Verify `npm run build` succeeds

2. **Check Runtime Logs**
   - Look for MongoDB connection errors
   - Check for missing environment variables
   - Verify PORT is being set correctly

3. **Common Issues**
   - **Build fails**: Check Node.js version (should be 18+)
   - **Service crashes**: Check MongoDB connection
   - **503 errors**: Service might be spinning up (free tier)
   - **CORS errors**: Verify CORS_ORIGIN is set correctly

## Next Steps

- [ ] Set up custom domain (optional)
- [ ] Configure SSL (automatic on Render)
- [ ] Set up monitoring/alerting
- [ ] Consider upgrading to paid plan for production

