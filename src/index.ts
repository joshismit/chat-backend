import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import { getDatabaseUrl } from './utils/dbConfig';
import { prisma } from './utils/prisma';

const app: Express = express();
// PORT from environment variable or default to 3000
const PORT = parseInt(process.env.PORT || '3000', 10);
// PostgreSQL connection - uses DATABASE_URL from environment variables
const DATABASE_URL = getDatabaseUrl();

// Middleware
// CORS configuration - allow all origins in development, specific origins in production
// For mobile apps (React Native/Expo), CORS doesn't apply, but we still need to allow requests
const corsOptions = {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN === '*'
      ? true // Allow all origins if explicitly set to *
      : process.env.CORS_ORIGIN.split(',').map((origin: string) => origin.trim())
    : process.env.NODE_ENV === 'production'
      ? true // Allow all origins in production if CORS_ORIGIN not set (for mobile apps)
      : true, // Allow all in development
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve uploaded files (for local development)
import path from 'path';
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
import authRoutes from './routes/authRoutes';
import messageRoutes from './routes/messageRoutes';
import conversationRoutes from './routes/conversationRoutes';
import attachmentRoutes from './routes/attachmentRoutes';
import qrRoutes from './routes/qrRoutes';
import sessionRoutes from './routes/sessionRoutes';
import sseRoutes from './routes/sseRoutes';
import callRoutes from './routes/callRoutes';

// Authentication routes
app.use('/auth', authRoutes);

// QR code routes
app.use('/qr', qrRoutes);

// Session management routes
app.use('/sessions', sessionRoutes);

// Message routes
app.use('/messages', messageRoutes);
// SSE route for messages (alias)
app.use('/messages/sse', sseRoutes);

// Other routes
app.use('/sse', sseRoutes);
app.use('/conversations', conversationRoutes);
app.use('/attachments', attachmentRoutes);
app.use('/calls', callRoutes);
// app.use('/api/chat', chatRoutes);

// Connect to PostgreSQL via Prisma
async function connectDatabase() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log(`✅ Connected to PostgreSQL`);

    // Initialize Redis (optional but recommended for production SSE scaling)
    const { initRedis } = require('./services/redisService');
    try {
      initRedis();
      console.log('🔄 Redis Service initialized');
    } catch (redisError) {
      console.warn('⚠️ Redis initialization failed (continuing without Redis):', redisError);
    }

    // Verify connection by running a simple query
    await prisma.$queryRaw`SELECT 1`;
    console.log(`🔗 Database connection verified`);

    // Start server
    // Listen on all interfaces (0.0.0.0) to accept connections from network
    const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '0.0.0.0';
    app.listen(PORT, host, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`🌐 Server accessible from network on port ${PORT}`);
        console.log(`📱 For Android emulator, use: http://10.0.2.2:${PORT}`);
      }
    });
  } catch (error) {
    console.error('❌ PostgreSQL connection error:', error);
    process.exit(1);
  }
}

connectDatabase();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connection...');
  try {
    await prisma.$disconnect();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error closing database connection:', error);
    process.exit(1);
  }
});

export default app;

