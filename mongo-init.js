// MongoDB initialization script for Docker
// This creates indexes on first database initialization

db = db.getSiblingDB('newchatapp');

// Create indexes for Messages collection
db.messages.createIndex({ conversationId: 1, createdAt: -1 });
db.messages.createIndex({ senderId: 1, createdAt: -1 });
db.messages.createIndex({ "deliveredTo": 1 });
db.messages.createIndex({ "readBy": 1 });
db.messages.createIndex({ clientId: 1 }, { unique: true, sparse: true });

// Create indexes for Conversations collection
db.conversations.createIndex({ members: 1, lastMessageAt: -1 });
db.conversations.createIndex({ "members": 1, archivedBy: 1 });
db.conversations.createIndex({ lastMessageAt: -1 });

// Create indexes for Users collection
db.users.createIndex({ phone: 1 }, { unique: true });
db.users.createIndex({ name: 1 });

// Create indexes for QRChallenge collection (TTL index for auto-cleanup)
db.qrchallenges.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
db.qrchallenges.createIndex({ token: 1 }, { unique: true });

print('✅ MongoDB indexes created successfully');

