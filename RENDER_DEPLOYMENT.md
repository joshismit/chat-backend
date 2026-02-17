# Render Deployment Guide

This guide will help you deploy the backend to Render.

## Prerequisites

1. A Render account (sign up at https://render.com)
2. MongoDB database (MongoDB Atlas recommended)
3. Git repository (GitHub/GitLab/Bitbucket)

## Step 1: Prepare Your Database

For this project, we use **PostgreSQL** with **Prisma ORM**.

### Option A: Render Managed PostgreSQL (Recommended)
1. In the Render Dashboard, click "New +" → "PostgreSQL".
2. Name it `newchatapp-db` and select the **Free** tier.
3. Once created, copy the **Internal Database URL** for Render services, or the **External Database URL** for local testing.

## Step 2: Deploy to Render

### Option A: Using the render.yaml Blueprint (Easiest)
We have included a `render.yaml` file in the `Chat-BE` directory.
1. Push your code to GitHub/GitLab.
2. In the Render Dashboard, click "New +" → "Blueprint".
3. Connect your repository.
4. Render will automatically detect the configuration and set up both the backend and the database.

### Option B: Manual Web Service Setup
1. Click "New +" → "Web Service".
2. Connect your repository.
3. Configure:
   - **Name**: `newchatapp-backend`
   - **Root Directory**: `Chat-BE`
   - **Build Command**: `npm install && npx prisma generate && npm run build`
   - **Start Command**: `npx prisma migrate deploy && npm start`
4. Add Environment Variables:
   - `DATABASE_URL`: Your PostgreSQL connection string.
   - `JWT_SECRET`: A strong random string.
   - `NODE_ENV`: `production`
   - `LIVEKIT_API_KEY`: Found in your LiveKit dashboard.
   - `LIVEKIT_API_SECRET`: Found in your LiveKit dashboard.
   - `LIVEKIT_URL`: Found in your LiveKit dashboard.

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

| Variable       | Required | Description                                  | Example                                          |
| -------------- | -------- | -------------------------------------------- | ------------------------------------------------ |
| `DATABASE_URL` | ✅ Yes   | PostgreSQL connection string                 | `postgresql://user:pass@host:port/db`            |
| `JWT_SECRET`   | ✅ Yes   | Secret key for JWT tokens                    | Random string (32+ chars)                        |
| `PORT`         | ❌ No    | Server port (Render sets this automatically) | `10000`                                          |
| `NODE_ENV`     | ❌ No    | Environment mode                             | `production`                                     |
| `CORS_ORIGIN`  | ❌ No    | Allowed CORS origins                         | `*` (all) or specific URLs                       |
| `REDIS_URL`    | ❌ No    | Redis connection URL (if using Redis)        | `redis://...`                                    |

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
