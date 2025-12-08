# Conversation API Examples

## GET /conversations

List all conversations for the authenticated user (excluding archived ones).

### Request

```bash
GET /conversations
Authorization: Bearer YOUR_JWT_TOKEN
```

### Response (200 OK)

```json
{
  "success": true,
  "conversations": [
    {
      "id": "507f1f77bcf86cd799439011",
      "type": "private",
      "title": "Jane Doe",
      "members": [
        {
          "id": "507f1f77bcf86cd799439013",
          "name": "John Doe",
          "avatarUrl": "https://example.com/avatar1.jpg",
          "phone": "+1234567890"
        },
        {
          "id": "507f1f77bcf86cd799439014",
          "name": "Jane Doe",
          "avatarUrl": "https://example.com/avatar2.jpg",
          "phone": "+0987654321"
        }
      ],
      "otherMember": {
        "id": "507f1f77bcf86cd799439014",
        "name": "Jane Doe",
        "avatarUrl": "https://example.com/avatar2.jpg",
        "phone": "+0987654321"
      },
      "lastMessageAt": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-10T08:00:00.000Z",
      "archived": false
    },
    {
      "id": "507f1f77bcf86cd799439012",
      "type": "group",
      "title": "Team Chat",
      "members": [
        {
          "id": "507f1f77bcf86cd799439013",
          "name": "John Doe",
          "avatarUrl": "https://example.com/avatar1.jpg",
          "phone": "+1234567890"
        },
        {
          "id": "507f1f77bcf86cd799439015",
          "name": "Bob Smith",
          "avatarUrl": null,
          "phone": "+1111111111"
        }
      ],
      "otherMember": null,
      "lastMessageAt": "2024-01-14T15:20:00.000Z",
      "createdAt": "2024-01-05T12:00:00.000Z",
      "archived": false
    }
  ],
  "count": 2
}
```

### Notes

- Conversations are sorted by `lastMessageAt` (descending), then `createdAt`
- Archived conversations are excluded
- For 1:1 conversations, `title` is set to the other member's name
- `otherMember` is only present for 1:1 conversations

---

## POST /conversations

Create a new conversation (1:1 or group).

### Request (1:1 Conversation)

```bash
POST /conversations
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "memberIds": ["507f1f77bcf86cd799439014"]
}
```

### Request (Group Conversation)

```bash
POST /conversations
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "type": "group",
  "title": "Team Chat",
  "memberIds": ["507f1f77bcf86cd799439014", "507f1f77bcf86cd799439015"]
}
```

### Response (201 Created)

```json
{
  "success": true,
  "conversation": {
    "id": "507f1f77bcf86cd799439011",
    "type": "private",
    "title": "Jane Doe",
    "members": [
      {
        "id": "507f1f77bcf86cd799439013",
        "name": "John Doe",
        "avatarUrl": "https://example.com/avatar1.jpg",
        "phone": "+1234567890"
      },
      {
        "id": "507f1f77bcf86cd799439014",
        "name": "Jane Doe",
        "avatarUrl": "https://example.com/avatar2.jpg",
        "phone": "+0987654321"
      }
    ],
    "otherMember": {
      "id": "507f1f77bcf86cd799439014",
      "name": "Jane Doe",
      "avatarUrl": "https://example.com/avatar2.jpg",
      "phone": "+0987654321"
    },
    "lastMessageAt": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "archived": false
  },
  "alreadyExists": false
}
```

### Response (200 OK - Existing 1:1 Conversation)

If a 1:1 conversation already exists between the users:

```json
{
  "success": true,
  "conversation": {
    "id": "507f1f77bcf86cd799439011",
    "type": "private",
    "title": "Jane Doe",
    "members": [...],
    "otherMember": {...},
    "lastMessageAt": "2024-01-14T15:20:00.000Z",
    "createdAt": "2024-01-10T08:00:00.000Z",
    "archived": false
  },
  "alreadyExists": true
}
```

### Flow

1. Validates JWT authentication
2. Validates member IDs exist
3. For 1:1 conversations, checks if conversation already exists (returns existing if found)
4. Creates conversation with current user + members
5. Broadcasts `conversation:new` event via SSE to all members (except creator)
6. Returns conversation object

### SSE Event

All conversation members (except creator) receive:

```javascript
// Event: conversation:new
{
  "conversation": {
    "id": "507f1f77bcf86cd799439011",
    "type": "private",
    "title": "Jane Doe",
    "members": [...],
    "otherMember": {...},
    "lastMessageAt": null,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "archived": false
  }
}
```

---

## PATCH /conversations/:id/archive

Archive or unarchive a conversation for the authenticated user.

### Request

```bash
PATCH /conversations/507f1f77bcf86cd799439011/archive
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "archived": true
}
```

### Response (200 OK)

```json
{
  "success": true,
  "archived": true,
  "conversationId": "507f1f77bcf86cd799439011"
}
```

### Notes

- Archiving is per-user (each user can archive/unarchive independently)
- Archived conversations are excluded from `GET /conversations`
- Use `archived: false` to unarchive

---

## GET /conversations/:id

Get conversation details with last N messages.

### Request

```bash
GET /conversations/507f1f77bcf86cd799439011?limit=20
Authorization: Bearer YOUR_JWT_TOKEN
```

### Query Parameters

- `limit` (optional) - Number of messages to return (default: 20, max: 50)

### Response (200 OK)

```json
{
  "success": true,
  "conversation": {
    "id": "507f1f77bcf86cd799439011",
    "type": "private",
    "title": "Jane Doe",
    "members": [
      {
        "id": "507f1f77bcf86cd799439013",
        "name": "John Doe",
        "avatarUrl": "https://example.com/avatar1.jpg",
        "phone": "+1234567890"
      },
      {
        "id": "507f1f77bcf86cd799439014",
        "name": "Jane Doe",
        "avatarUrl": "https://example.com/avatar2.jpg",
        "phone": "+0987654321"
      }
    ],
    "otherMember": {
      "id": "507f1f77bcf86cd799439014",
      "name": "Jane Doe",
      "avatarUrl": "https://example.com/avatar2.jpg",
      "phone": "+0987654321"
    },
    "lastMessageAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-10T08:00:00.000Z",
    "archived": false
  },
  "messages": [
    {
      "id": "507f1f77bcf86cd799439020",
      "conversationId": "507f1f77bcf86cd799439011",
      "senderId": "507f1f77bcf86cd799439014",
      "sender": {
        "id": "507f1f77bcf86cd799439014",
        "name": "Jane Doe",
        "avatarUrl": "https://example.com/avatar2.jpg"
      },
      "text": "Hello!",
      "attachments": [],
      "clientId": "client-generated-nanoid",
      "status": "sent",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "deliveredTo": [],
      "readBy": []
    }
  ],
  "messageCount": 1
}
```

### Notes

- Messages are returned in chronological order (oldest first)
- Includes full conversation details with populated members
- Shows archived status for the authenticated user
- Messages include sender information

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
  "error": "memberIds array is required with at least one member"
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
  "error": "Failed to create conversation",
  "details": "Error details..."
}
```

