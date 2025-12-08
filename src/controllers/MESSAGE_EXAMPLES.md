# Message API Examples

## POST /messages/send

Send a new message to a conversation.

### Request

```bash
POST /messages/send
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "conversationId": "507f1f77bcf86cd799439011",
  "clientId": "client-generated-nanoid",
  "text": "Hello, how are you?",
  "attachments": [
    {
      "type": "image",
      "url": "https://example.com/image.jpg",
      "fileName": "photo.jpg",
      "fileSize": 1024000,
      "mimeType": "image/jpeg"
    }
  ]
}
```

### Response (201 Created)

```json
{
  "success": true,
  "message": {
    "id": "507f1f77bcf86cd799439012",
    "conversationId": "507f1f77bcf86cd799439011",
    "senderId": "507f1f77bcf86cd799439013",
    "text": "Hello, how are you?",
    "attachments": [
      {
        "type": "image",
        "url": "https://example.com/image.jpg",
        "fileName": "photo.jpg",
        "fileSize": 1024000,
        "mimeType": "image/jpeg"
      }
    ],
    "clientId": "client-generated-nanoid",
    "status": "sent",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "deliveredTo": [],
    "readBy": []
  }
}
```

### Flow

1. Validates JWT authentication
2. Validates conversation exists and user is a member
3. Validates message has either text or attachments
4. Creates message with status 'sent'
5. Updates conversation's `lastMessageAt`
6. Broadcasts message via SSE to all conversation members (except sender)
7. Returns saved message object

### SSE Event

All conversation members (except sender) receive:

```javascript
// Event: message:new
{
  "message": {
    "id": "507f1f77bcf86cd799439012",
    "conversationId": "507f1f77bcf86cd799439011",
    "senderId": "507f1f77bcf86cd799439013",
    "sender": {
      "id": "507f1f77bcf86cd799439013",
      "name": "John Doe",
      "avatarUrl": "https://example.com/avatar.jpg"
    },
    "text": "Hello, how are you?",
    "attachments": [...],
    "clientId": "client-generated-nanoid",
    "status": "sent",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

## GET /messages

Get paginated historical messages for a conversation.

### Request

```bash
GET /messages?conversationId=507f1f77bcf86cd799439011&before=2024-01-15T10:30:00.000Z&limit=20
Authorization: Bearer YOUR_JWT_TOKEN
```

### Query Parameters

- `conversationId` (required) - Conversation ID
- `before` (optional) - ISO timestamp string for pagination cursor
- `limit` (optional) - Number of messages to return (default: 20, max: 100)

### Response (200 OK)

```json
{
  "success": true,
  "messages": [
    {
      "id": "507f1f77bcf86cd799439012",
      "conversationId": "507f1f77bcf86cd799439011",
      "senderId": "507f1f77bcf86cd799439013",
      "sender": {
        "id": "507f1f77bcf86cd799439013",
        "name": "John Doe",
        "avatarUrl": "https://example.com/avatar.jpg"
      },
      "text": "Hello, how are you?",
      "attachments": [],
      "clientId": "client-generated-nanoid",
      "status": "sent",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "deliveredTo": [],
      "readBy": []
    }
  ],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "nextCursor": "2024-01-15T09:00:00.000Z"
  }
}
```

### Mongoose Query Example

```typescript
const query = {
  conversationId: new mongoose.Types.ObjectId(conversationId),
  createdAt: { $lt: beforeDate }
};

const messages = await Message.find(query)
  .populate('senderId', 'name avatarUrl phone')
  .sort({ createdAt: -1 })
  .limit(limitNum)
  .lean();
```

### Pagination

- Messages are ordered **descending** by `createdAt` (newest first)
- Use `before` parameter with the `createdAt` timestamp of the last message from previous page
- `nextCursor` in response provides the cursor for the next page
- `hasMore` indicates if there are more messages available

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

### 400 Bad Request
```json
{
  "error": "conversationId is required"
}
```

### 403 Forbidden
```json
{
  "error": "You are not a member of this conversation"
}
```

### 404 Not Found
```json
{
  "error": "Conversation not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to send message",
  "details": "Error details..."
}
```

