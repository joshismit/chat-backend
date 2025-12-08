# MongoDB Indexes for Production

## Index Creation Script

Run this script in MongoDB Atlas or via `mongosh`:

```javascript
// Connect to your database
use newchatapp;

// Indexes for Messages collection
db.messages.createIndex({ conversationId: 1, createdAt: -1 });
db.messages.createIndex({ senderId: 1, createdAt: -1 });
db.messages.createIndex({ "deliveredTo": 1 });
db.messages.createIndex({ "readBy": 1 });
db.messages.createIndex({ clientId: 1 }, { unique: true, sparse: true });

// Indexes for Conversations collection
db.conversations.createIndex({ members: 1, lastMessageAt: -1 });
db.conversations.createIndex({ "members": 1, archivedBy: 1 });
db.conversations.createIndex({ lastMessageAt: -1 });

// Indexes for Users collection
db.users.createIndex({ phone: 1 }, { unique: true });
db.users.createIndex({ name: 1 });

// Indexes for QRChallenge collection (TTL index for auto-cleanup)
db.qrchallenges.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
db.qrchallenges.createIndex({ token: 1 }, { unique: true });
```

## Index Explanations

### Messages Collection

1. **`{ conversationId: 1, createdAt: -1 }`**
   - Used for: Fetching messages for a conversation, ordered by newest first
   - Query: `GET /messages?conversationId=...&before=timestamp`

2. **`{ senderId: 1, createdAt: -1 }`**
   - Used for: Finding messages by sender
   - Query: User message history

3. **`{ "deliveredTo": 1 }`**
   - Used for: Finding messages that need delivery status updates
   - Query: Message delivery tracking

4. **`{ "readBy": 1 }`**
   - Used for: Finding messages that need read status updates
   - Query: Message read tracking

5. **`{ clientId: 1 }` (unique, sparse)**
   - Used for: Preventing duplicate messages during offline sync
   - Query: Message reconciliation by clientId

### Conversations Collection

1. **`{ members: 1, lastMessageAt: -1 }`**
   - Used for: Fetching conversations for a user, ordered by most recent
   - Query: `GET /conversations` (user's conversations)

2. **`{ "members": 1, archivedBy: 1 }`**
   - Used for: Finding archived conversations for a user
   - Query: `GET /conversations?archived=true`

3. **`{ lastMessageAt: -1 }`**
   - Used for: Sorting conversations globally
   - Query: Conversation list sorting

### Users Collection

1. **`{ phone: 1 }` (unique)**
   - Used for: User lookup by phone number
   - Query: User authentication, user search

2. **`{ name: 1 }`**
   - Used for: User search by name
   - Query: User search functionality

### QRChallenge Collection

1. **`{ expiresAt: 1 }` (TTL)**
   - Used for: Automatic cleanup of expired QR challenges
   - MongoDB automatically deletes documents after `expiresAt` time

2. **`{ token: 1 }` (unique)**
   - Used for: Quick lookup of QR challenge by token
   - Query: `POST /auth/qr-scan`

## Index Performance Monitoring

### Check Index Usage

```javascript
// Get index usage statistics
db.messages.aggregate([
  { $indexStats: {} }
]);

// Explain query execution
db.messages.find({ conversationId: "conv123" }).sort({ createdAt: -1 }).explain("executionStats");
```

### Index Maintenance

- **Rebuild indexes** if performance degrades:
  ```javascript
  db.messages.reIndex();
  ```

- **Drop unused indexes**:
  ```javascript
  db.messages.dropIndex("index_name");
  ```

## Atlas Index Recommendations

1. ✅ **Enable Atlas Performance Advisor** (automatically suggests indexes)
2. ✅ **Monitor slow queries** (Atlas Performance Panel)
3. ✅ **Review index usage** (Atlas Index Usage tab)
4. ✅ **Set up alerts** for slow queries (>100ms)

