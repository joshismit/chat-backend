# Render Deployment Guide

This guide will help you deploy the backend to Render.

## Prerequisites

1. A Render account (sign up at https://render.com)
2. MongoDB database (MongoDB Atlas recommended)
3. Git repository (GitHub/GitLab/Bitbucket)

## Step 1: Prepare Your MongoDB Database

1. Create a MongoDB Atlas account (or use existing MongoDB)
2. Create a new cluster
3. Get your connection string (MONGO_URI)
   - Format: `mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority`

## Step 2: Deploy to Render

### Option A: Using Render Dashboard (Recommended)

1. **Go to Render Dashboard**

   - Visit https://dashboard.render.com
   - Click "New +" → "Web Service"

2. **Connect Repository**

   - Connect your GitHub/GitLab/Bitbucket repository
   - Select the repository containing this backend

3. **Configure Service**

   - **Name**: `newchatapp-backend` (or your preferred name)
   - **Region**: Choose closest to your users (e.g., `Oregon`)
   - **Branch**: `main` or `master`
   - **Root Directory**: `backend` (important!)
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

4. **Set Environment Variables**
   Click "Advanced" → "Add Environment Variable" and add:

   ```
   NODE_ENV=production
   MONGO_URI=your-mongodb-connection-string
   JWT_SECRET=your-secret-key-here (generate a random string)
   CORS_ORIGIN=*
   PORT=10000 (Render will override this, but set it anyway)
   ```

   **Important**:

   - Replace `your-mongodb-connection-string` with your actual MongoDB URI
   - Generate a strong `JWT_SECRET` (you can use: `openssl rand -base64 32`)

5. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy your backend
   - Wait for deployment to complete (usually 2-5 minutes)

### Option B: Using render.yaml (Infrastructure as Code)

1. **Commit render.yaml**

   - The `render.yaml` file is already in the repository
   - Commit and push to your repository

2. **Deploy via Render Dashboard**

   - Go to Render Dashboard
   - Click "New +" → "Blueprint"
   - Connect your repository
   - Render will detect `render.yaml` and create the service
   - **Set MONGO_URI** in the dashboard (it's marked as `sync: false`)

3. **Set Environment Variables**
   - Go to your service → "Environment"
   - Add `MONGO_URI` with your MongoDB connection string
   - `JWT_SECRET` will be auto-generated (or set manually)

## Step 3: Verify Deployment

1. **Check Health Endpoint**

   ```
   GET https://your-service-name.onrender.com/health
   ```

   Should return: `{"status":"ok","timestamp":"..."}`

2. **Test API Endpoints**
   ```
   POST https://your-service-name.onrender.com/auth/verify-otp
   Body: {"phone": "9033868859", "otp": "test123"}
   ```

## Step 4: Update Frontend API URL

Update your frontend `.env` file or `app.json`:

```env
EXPO_PUBLIC_API_URL=https://your-service-name.onrender.com
```

Or for production builds, set it in `app.json`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://your-service-name.onrender.com"
    }
  }
}
```

## Environment Variables Reference

| Variable      | Required | Description                                  | Example                                          |
| ------------- | -------- | -------------------------------------------- | ------------------------------------------------ |
| `MONGO_URI`   | ✅ Yes   | MongoDB connection string                    | `mongodb+srv://user:pass@cluster.mongodb.net/db` |
| `JWT_SECRET`  | ✅ Yes   | Secret key for JWT tokens                    | Random string (32+ chars)                        |
| `PORT`        | ❌ No    | Server port (Render sets this automatically) | `10000`                                          |
| `NODE_ENV`    | ❌ No    | Environment mode                             | `production`                                     |
| `CORS_ORIGIN` | ❌ No    | Allowed CORS origins                         | `*` (all) or specific URLs                       |
| `REDIS_URL`   | ❌ No    | Redis connection URL (if using Redis)        | `redis://...`                                    |

## Render Free Tier Limitations

- **Spins down after 15 minutes of inactivity**
- **Takes 30-60 seconds to wake up** when first request comes in
- **Limited to 750 hours/month** (enough for testing)
- **No persistent storage** (use external MongoDB)

## Troubleshooting

### Service Won't Start

1. **Check Build Logs**

   - Go to service → "Logs" → "Build Logs"
   - Look for TypeScript compilation errors

2. **Check Runtime Logs**

   - Go to service → "Logs" → "Runtime Logs"
   - Look for MongoDB connection errors

3. **Common Issues**:
   - **MongoDB Connection Failed**: Check `MONGO_URI` is correct
   - **Port Error**: Render sets PORT automatically, don't hardcode it
   - **Build Failed**: Ensure `npm run build` completes successfully

### MongoDB Connection Issues

1. **Whitelist Render IPs**

   - In MongoDB Atlas: Network Access → Add IP Address
   - Add `0.0.0.0/0` to allow all IPs (or specific Render IPs)

2. **Check Connection String**
   - Ensure username/password are URL-encoded
   - Ensure database name is included in URI

### Slow First Request

- This is normal on Render free tier
- Service spins down after inactivity
- First request wakes it up (30-60 seconds)
- Consider upgrading to paid plan for always-on service

## Upgrading to Paid Plan

For production use, consider upgrading:

- **Starter Plan ($7/month)**: Always-on, no spin-down
- **Professional Plans**: More resources, better performance

## Monitoring

Render provides:

- **Logs**: Real-time application logs
- **Metrics**: CPU, Memory, Request count
- **Events**: Deployments, restarts, errors

Access via: Service → "Logs" and "Metrics" tabs

## Continuous Deployment

Render automatically deploys when you push to your repository:

- **Automatic**: Every push to main branch triggers deployment
- **Manual**: Deploy specific commits via dashboard

## Custom Domain

1. Go to service → "Settings" → "Custom Domains"
2. Add your domain
3. Update DNS records as instructed
4. Update `CORS_ORIGIN` to include your domain

## Backup & Recovery

- **Database**: Use MongoDB Atlas backups
- **Code**: Git repository is your backup
- **Environment Variables**: Export from Render dashboard

## Support

- Render Docs: https://render.com/docs
- Render Support: support@render.com
- Community: https://community.render.com
