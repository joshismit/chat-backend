import express, { Express, Request, Response } from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import { getMongoURI } from './utils/dbConfig';

dotenv.config();

const app: Express = express();
// PORT from environment variable or default to 3000
const PORT = parseInt(process.env.PORT || '3000', 10);
// MongoDB connection - uses MONGO_URI from environment variables
const MONGO_URI = getMongoURI();

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
// app.use('/api/chat', chatRoutes);

// Connect to MongoDB
mongoose
  .connect(MONGO_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    const dbName = mongoose.connection.db?.databaseName || 'unknown';
    console.log(`✅ Connected to MongoDB`);
    console.log(`📦 Database: ${dbName}`);
    console.log(`🔗 Connection state: ${mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'}`);
    
    // List collections to verify database setup
    mongoose.connection.db?.listCollections().toArray()
      .then((collections) => {
        if (collections.length > 0) {
          console.log(`📚 Collections found: ${collections.map(c => c.name).join(', ')}`);
        } else {
          console.log(`⚠️  No collections found. Database will be created when first document is saved.`);
        }
      })
      .catch((err) => {
        console.warn('⚠️  Could not list collections:', err.message);
      });
    
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
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing MongoDB connection...');
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
    process.exit(1);
  }
});

export default app;

