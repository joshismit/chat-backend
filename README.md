# Backend API - Express + Mongoose + TypeScript

## Quick Start

### Prerequisites

- Node.js 18+ 
- MongoDB (or MongoDB Atlas connection string)
- npm or yarn

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Create `.env` file:**
```bash
# Windows
copy .env.example .env

# Linux/Mac
cp .env.example .env
```

3. **Configure environment variables in `.env`:**
```env
PORT=3000
MONGO_URI=your-mongodb-connection-string
JWT_SECRET=your-secret-key-min-32-chars
```

### Run

**Development mode (with hot reload):**
```bash
npm run dev
# or
npm run start:dev
```

**Production:**
```bash
npm run build
npm start
# or
npm run start:prod
```

**Using start scripts:**
```bash
# Linux/Mac
chmod +x start.sh
./start.sh

# Windows
start.bat
```

## Environment Variables

- `PORT` - Server port (default: 3000)
- `MONGO_URI` - MongoDB Atlas connection string (required)
- `NODE_ENV` - Environment (development/production)
- `JWT_SECRET` - Secret key for JWT signing (required, min 32 chars)
- `JWT_EXPIRES_IN` - JWT expiration time (default: 7d)
- `API_BASE_URL` - Base URL for QR payload generation (default: http://localhost:3000)
- `USE_S3` - Use S3 for file storage (true/false, default: false)
- `AWS_ACCESS_KEY_ID` - AWS access key (required if USE_S3=true)
- `AWS_SECRET_ACCESS_KEY` - AWS secret key (required if USE_S3=true)
- `S3_BUCKET` - S3 bucket name (required if USE_S3=true)
- `S3_REGION` - AWS region (default: us-east-1)

## Project Structure

```
backend/
├── src/
│   ├── index.ts           # Express app + MongoDB connection
│   ├── routes/            # API routes
│   ├── controllers/       # Request handlers
│   ├── models/           # Mongoose models
│   ├── services/         # Business logic
│   ├── middleware/       # Express middleware
│   ├── utils/            # Utility functions
│   └── sse/              # Server-Sent Events service
├── dist/                 # Compiled JavaScript (generated)
├── uploads/              # Local file storage (dev)
├── package.json
├── tsconfig.json
├── .env                  # Environment variables (create from .env.example)
├── postman_collection.json  # Postman API collection
└── start.sh / start.bat  # Start scripts
```

## API Endpoints

### Health & Events
- `GET /health` - Health check
- `GET /sse/connect` - SSE connection endpoint with JWT auth (see SSE docs)

### QR Login Flow
- `GET /auth/qr-challenge` - Create QR challenge token (returns `{ challengeId, qrPayload }`)
- `POST /auth/qr-scan` - Mobile app scans QR code (body: `{ token, userId }`)
- `GET /auth/qr-status?challengeId=...` - Check challenge status (returns `{ status: 'pending'|'authorized'|'expired', user? }`)
- `POST /auth/qr-confirm` - Desktop confirms and gets JWT (body: `{ challengeId }`, returns `{ success, token, user }`)

### Messages
- `POST /messages/send` - Send a message (requires JWT, body: `{ conversationId, clientId?, text?, attachments? }`)
- `GET /messages?conversationId=...&before=timestamp&limit=20` - Get paginated messages (requires JWT)
- `POST /messages/:id/delivered` - Mark message as delivered (requires JWT, body: `{ toUserId? }`)
- `POST /messages/:id/read` - Mark message as read (requires JWT, body: `{ userId? }`)

### Conversations
- `GET /conversations` - List conversations for authenticated user (requires JWT)
- `POST /conversations` - Create new conversation (requires JWT, body: `{ type?, title?, memberIds: string[] }`)
- `PATCH /conversations/:id/archive` - Archive/unarchive conversation (requires JWT, body: `{ archived: boolean }`)
- `GET /conversations/:id?limit=20` - Get conversation with last N messages (requires JWT)

### Attachments
- `POST /attachments` - Upload file attachment (requires JWT, multipart/form-data with 'file' field)

## Postman Collection

Import `postman_collection.json` into Postman for complete API testing.

See `POSTMAN_SETUP.md` for setup instructions.

## SSE Usage

Connect to SSE endpoint:
```
GET /sse/connect?token=YOUR_JWT_TOKEN
```

Send event to specific user:
```typescript
import { sendEventToUser } from './sse';
sendEventToUser('userId123', 'message:new', { message: 'Hello' });
```

Broadcast to conversation:
```typescript
import { broadcastToConversation } from './sse';
await broadcastToConversation('conv123', 'message:new', { message: 'Hello' });
```

## Development

### Build
```bash
npm run build
```

### Watch Mode
```bash
npm run watch
```

### Type Checking
```bash
npx tsc --noEmit
```

## Production Deployment

### Deploy to Render

**See [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md) for complete deployment guide.**

**Quick Steps:**
1. Push code to GitHub/GitLab
2. Create new Web Service on Render
3. Connect repository
4. Set Root Directory: `backend`
5. Set Build Command: `npm install && npm run build`
6. Set Start Command: `npm start`
7. Add environment variables:
   - `MONGO_URI` - Your MongoDB connection string
   - `JWT_SECRET` - Generate with: `openssl rand -base64 32`
   - `NODE_ENV=production`
   - `CORS_ORIGIN=*`
8. Deploy!

### Manual Deployment

1. Set `NODE_ENV=production`
2. Set strong `JWT_SECRET`
3. Configure MongoDB Atlas connection
4. Set up S3 for file storage (optional)
5. Build and start:
   ```bash
   npm run start:prod
   ```

## Troubleshooting

### MongoDB Connection Issues
- Verify `MONGO_URI` is correct
- Check MongoDB Atlas IP whitelist
- Ensure network connectivity

### JWT Errors
- Verify `JWT_SECRET` is set (min 32 chars)
- Check token expiration settings

### File Upload Issues
- For local storage: ensure `uploads/` directory exists
- For S3: verify AWS credentials and bucket permissions
