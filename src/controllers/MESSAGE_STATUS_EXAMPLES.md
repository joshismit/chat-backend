# Message Status Update API Examples

## POST /messages/:id/delivered

Mark a message as delivered to a user. This can be called explicitly or triggered implicitly when a user receives a message via SSE.

### Request

```bash
POST /messages/507f1f77bcf86cd799439012/delivered
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "toUserId": "507f1f77bcf86cd799439014"  // Optional, defaults to authenticated user
}
```

### Response (200 OK)

```json
{
  "success": true,
  "messageId": "507f1f77bcf86cd799439012",
  "deliveredTo": [
    "507f1f77bcf86cd799439014",
    "507f1f77bcf86cd799439015"
  ],
  "status": "delivered"
}
```

### Flow

1. Validates JWT authentication
2. Finds message by ID
3. Adds user to `deliveredTo` array (if not already present)
4. Updates message status to `DELIVERED` if all recipients have received it
5. Emits SSE event `message:status` to message sender
6. Returns updated message status

### SSE Event to Sender

The message sender receives:

```javascript
// Event: message:status
{
  "messageId": "507f1f77bcf86cd799439012",
  "status": "delivered",
  "userId": "507f1f77bcf86cd799439014",
  "timestamp": "2024-01-15T10:35:00.000Z"
}
```

### Implicit Delivery (SSE Connection)

You can mark messages as delivered automatically when a user connects to SSE and receives messages:

```typescript
// In your SSE event handler on client
eventSource.addEventListener('message:new', async (e) => {
  const data = JSON.parse(e.data);
  const message = data.message;
  
  // Automatically mark as delivered when received
  await fetch(`/messages/${message.id}/delivered`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
});
```

---

## POST /messages/:id/read

Mark a message as read by a user.

### Request

```bash
POST /messages/507f1f77bcf86cd799439012/read
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "userId": "507f1f77bcf86cd799439014"  // Optional, defaults to authenticated user
}
```

### Response (200 OK)

```json
{
  "success": true,
  "messageId": "507f1f77bcf86cd799439012",
  "readBy": [
    "507f1f77bcf86cd799439014"
  ],
  "deliveredTo": [
    "507f1f77bcf86cd799439014",
    "507f1f77bcf86cd799439015"
  ],
  "status": "delivered"
}
```

### Flow

1. Validates JWT authentication
2. Finds message by ID
3. Ensures user is in `deliveredTo` (adds if not present)
4. Adds user to `readBy` array (if not already present)
5. Updates message status:
   - `READ` if all recipients have read it
   - `DELIVERED` if some recipients have read it
6. Emits SSE event `message:status` to message sender
7. Returns updated message status

### SSE Event to Sender

The message sender receives:

```javascript
// Event: message:status
{
  "messageId": "507f1f77bcf86cd799439012",
  "status": "read",
  "userId": "507f1f77bcf86cd799439014",
  "timestamp": "2024-01-15T10:40:00.000Z"
}
```

### Client-Side Example

```typescript
// Mark message as read when user views it
const markMessageAsRead = async (messageId: string) => {
  try {
    const response = await fetch(`/messages/${messageId}/read`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    const data = await response.json();
    console.log('Message marked as read:', data);
  } catch (error) {
    console.error('Error marking message as read:', error);
  }
};

// Call when message is displayed/read
markMessageAsRead('507f1f77bcf86cd799439012');
```

---

## Message Status Flow

### Status Progression

1. **SENDING** → Message being sent
2. **SENT** → Message saved to database
3. **DELIVERED** → All recipients have received the message
4. **READ** → All recipients have read the message

### Status Updates

- Message status automatically updates based on `deliveredTo` and `readBy` arrays
- Status changes are broadcasted to the sender via SSE
- Each status update includes:
  - `messageId` - The message ID
  - `status` - Current status (`delivered` or `read`)
  - `userId` - User who triggered the status change
  - `timestamp` - When the status changed

---

## SSE Event Handling (Client-Side)

```javascript
const eventSource = new EventSource(`/sse/connect?token=${jwtToken}`);

// Listen for message status updates
eventSource.addEventListener('message:status', (e) => {
  const statusUpdate = JSON.parse(e.data);
  
  console.log('Status update:', statusUpdate);
  // {
  //   messageId: "507f1f77bcf86cd799439012",
  //   status: "read",
  //   userId: "507f1f77bcf86cd799439014",
  //   timestamp: "2024-01-15T10:40:00.000Z"
  // }
  
  // Update UI to show read receipts, etc.
  updateMessageStatus(statusUpdate.messageId, statusUpdate.status);
});
```

---

## Error Responses

### 401 Unauthorized
```json
{
  "error": "Authentication required"
}
```

### 404 Not Found
```json
{
  "error": "Message not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to mark message as delivered",
  "details": "Error details..."
}
```

---

## Implementation Notes

### Automatic Delivery on SSE

To automatically mark messages as delivered when received via SSE:

1. Client receives `message:new` event
2. Client immediately calls `POST /messages/:id/delivered`
3. Sender receives `message:status` event with `delivered` status

### Read Receipts

To implement read receipts:

1. When user opens/view a conversation, mark all unread messages as read
2. Call `POST /messages/:id/read` for each message
3. Sender receives `message:status` events for each read message

### Batch Operations

For better performance, consider batching read receipts:

```typescript
// Mark multiple messages as read
const markMultipleAsRead = async (messageIds: string[]) => {
  await Promise.all(
    messageIds.map(id => 
      fetch(`/messages/${id}/read`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
    )
  );
};
```

