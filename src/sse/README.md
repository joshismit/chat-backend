# SSE (Server-Sent Events) Service

Real-time event streaming service with user-based and conversation-based messaging.

## Features

- ✅ User-based client registration
- ✅ JWT authentication (query param or header)
- ✅ Reconnection support (Last-Event-ID)
- ✅ Send events to specific users
- ✅ Broadcast to conversation members
- ✅ Automatic cleanup on disconnect
- ✅ Keep-alive pings

## Connection

### Endpoint
```
GET /sse/connect
```

### Authentication Methods

1. **Query Parameter:**
   ```
   GET /sse/connect?token=YOUR_JWT_TOKEN
   ```

2. **Authorization Header:**
   ```
   GET /sse/connect
   Authorization: Bearer YOUR_JWT_TOKEN
   ```

3. **X-Auth-Token Header:**
   ```
   GET /sse/connect
   X-Auth-Token: YOUR_JWT_TOKEN
   ```

### Reconnection

Include `Last-Event-ID` header for reconnection:
```
GET /sse/connect?token=YOUR_JWT_TOKEN
Last-Event-ID: 123
```

## Usage in Controllers

### Send Event to User

```typescript
import { sendEventToUser } from '../sse';

// Send notification to a specific user
sendEventToUser('userId123', 'message:new', {
  conversationId: 'conv123',
  message: { text: 'Hello!', senderId: 'user456' }
});
```

### Broadcast to Conversation

```typescript
import { broadcastToConversation } from '../sse';

// Broadcast message to all conversation members
await broadcastToConversation('conv123', 'message:new', {
  message: {
    id: 'msg789',
    text: 'Hello everyone!',
    senderId: 'user123',
    createdAt: new Date().toISOString()
  }
});
```

## Event Format

Events follow SSE specification:
```
id: 123
event: message:new
data: {"conversationId":"conv123","message":{"text":"Hello"}}

```

## Example: Message Controller

```typescript
import { Request, Response } from 'express';
import { Message } from '../models/Message';
import { sendEventToUser, broadcastToConversation } from '../sse';

export const createMessage = async (req: Request, res: Response) => {
  const { conversationId, text, senderId } = req.body;
  
  // Save message to database
  const message = await Message.create({
    conversationId,
    senderId,
    text,
    status: 'sent'
  });
  
  // Broadcast to conversation members
  await broadcastToConversation(conversationId, 'message:new', {
    message: {
      id: message._id.toString(),
      text: message.text,
      senderId: message.senderId.toString(),
      createdAt: message.createdAt
    }
  });
  
  res.json({ success: true, message });
};
```

## Client-Side Example (JavaScript)

```javascript
// Connect with JWT token
const token = 'your-jwt-token';
const eventSource = new EventSource(`http://localhost:3000/sse/connect?token=${token}`);

// Handle connection
eventSource.addEventListener('connected', (e) => {
  const data = JSON.parse(e.data);
  console.log('Connected:', data);
});

// Handle custom events
eventSource.addEventListener('message:new', (e) => {
  const message = JSON.parse(e.data);
  console.log('New message:', message);
});

// Handle errors
eventSource.onerror = (error) => {
  console.error('SSE error:', error);
  // EventSource will automatically reconnect
};

// Close connection
// eventSource.close();
```

## Event Types

Common event types for chat app:

- `connected` - Client connected successfully
- `message:new` - New message in conversation
- `message:delivered` - Message delivered
- `message:read` - Message read
- `conversation:updated` - Conversation metadata updated
- `user:typing` - User is typing
- `user:online` - User came online
- `user:offline` - User went offline

