# Backend API Endpoints

Complete list of all backend API endpoints organized by category.

## Authentication

### POST /auth/register
**Alias**: `/auth/signup`

Register/Signup a new user. Creates user account with unique dedicated token stored in database.

**Request Body**:
```json
{
  "phone": "1234567890",
  "name": "John Doe",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "message": "User registered successfully",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "phone": "1234567890",
    "avatarUrl": null,
    "token": "user_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
  },
  "token": "user_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2"
}
```

**Error Response (400 Bad Request)**:
```json
{
  "error": "Phone number and name are required"
}
```

**Error Response (400 Bad Request - Duplicate)**:
```json
{
  "error": "User with this phone number already exists"
}
```

**Notes**:
- Each user gets a unique dedicated token (`user_` prefix + 64 hex characters)
- Token is automatically generated and stored in database
- Token is unique and indexed for fast lookups
- Phone number must be unique

### POST /auth/login
**Alias**: `/auth/verify-otp`

Login using phone number and OTP (Mobile only - Master device).

**Request Body**:
```json
{
  "phone": "9033868859",
  "otp": "test123",
  "deviceId": "optional-device-id"
}
```

**Response**:
```json
{
  "success": true,
  "accessToken": "jwt-access-token",
  "refreshToken": "refresh-token-uuid",
  "user": {
    "id": "user-id",
    "name": "User Name",
    "phone": "9033868859",
    "avatarUrl": null
  }
}
```

### POST /auth/refresh
**Alias**: `/auth/refresh-token`

Refresh access token using refresh token.

**Request Body**:
```json
{
  "refreshToken": "refresh-token-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "accessToken": "new-jwt-access-token"
}
```

### POST /auth/logout

Revoke refresh token (logout current session).

**Headers**: `Authorization: Bearer <access-token>`

**Request Body**:
```json
{
  "refreshToken": "refresh-token-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## QR Code Flow

### GET /qr/generate
**Alias**: `/auth/qr-challenge`

Desktop: Generate QR code for login.

**Response**:
```json
{
  "challengeId": "uuid-challenge-id",
  "qrPayload": "uuid-token-for-qr-code"
}
```

### POST /qr/approve
**Alias**: `/auth/qr-scan`

Mobile: Approve QR code scan (authorize desktop session).

**Headers**: `Authorization: Bearer <mobile-access-token>`

**Request Body**:
```json
{
  "token": "uuid-token-from-scanned-qr-code"
}
```

**Response**:
```json
{
  "success": true,
  "challengeId": "uuid-challenge-id",
  "message": "QR code approved"
}
```

### GET /qr/status
**Alias**: `/auth/qr-status`

Desktop: Check QR challenge status (for polling).

**Query Parameters**:
- `challengeId` (required): Challenge ID from `/qr/generate`

**Response**:
```json
{
  "status": "pending" | "authorized" | "expired",
  "user": {
    "id": "user-id",
    "name": "User Name",
    "avatar": "avatar-url"
  }
}
```

### POST /auth/qr-confirm

Desktop: Confirm QR challenge and receive JWT tokens.

**Request Body**:
```json
{
  "challengeId": "uuid-challenge-id"
}
```

**Response**:
```json
{
  "success": true,
  "accessToken": "jwt-access-token",
  "refreshToken": "refresh-token-uuid",
  "user": {
    "id": "user-id",
    "name": "User Name",
    "phone": "9033868859",
    "avatarUrl": null
  }
}
```

---

## Messaging

### POST /messages/send

Send a new message.

**Headers**: `Authorization: Bearer <access-token>`

**Request Body**:
```json
{
  "conversationId": "conversation-id",
  "clientId": "optional-client-generated-id",
  "text": "Message text",
  "attachments": [
    {
      "type": "image",
      "url": "https://example.com/image.jpg",
      "fileName": "image.jpg",
      "fileSize": 1024,
      "mimeType": "image/jpeg"
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "message": {
    "id": "message-id",
    "conversationId": "conversation-id",
    "senderId": "user-id",
    "text": "Message text",
    "status": "sent",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "sender": {
      "id": "user-id",
      "name": "User Name",
      "avatarUrl": null
    }
  }
}
```

### GET /messages/history
**Alias**: `GET /messages`

Get paginated messages for a conversation.

**Headers**: `Authorization: Bearer <access-token>`

**Query Parameters**:
- `conversationId` (required): Conversation ID
- `before` (optional): ISO timestamp string for pagination cursor
- `limit` (optional): Number of messages to return (default: 20, max: 100)

**Response**:
```json
{
  "success": true,
  "messages": [
    {
      "id": "message-id",
      "conversationId": "conversation-id",
      "senderId": "user-id",
      "text": "Message text",
      "status": "sent",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "sender": {
        "id": "user-id",
        "name": "User Name",
        "avatarUrl": null
      }
    }
  ],
  "pagination": {
    "limit": 20,
    "hasMore": true,
    "nextCursor": "2024-01-15T09:00:00.000Z"
  }
}
```

### GET /messages/sse
**Alias**: `GET /sse/connect`

Connect to Server-Sent Events (SSE) stream for real-time message updates.

**Headers**: 
- `Authorization: Bearer <access-token>` (optional)
- Or query parameter: `?token=<access-token>`
- Or header: `X-Auth-Token: <access-token>`

**Query Parameters**:
- `token` (optional): JWT token
- `deviceType` (optional): "desktop" or "mobile" (auto-detected if not provided)

**Events**:
- `connected`: Connection established
- `sync:initial`: Initial sync event (desktop only)
- `message:sync`: Individual message sync event (desktop only)
- `message:new`: New message received
- `message:status`: Message status update
- `conversation:new`: New conversation created
- `conversation:updated`: Conversation metadata updated
- `user:typing`: User typing indicator
- `user:online`: User came online
- `user:offline`: User went offline
- `sync:error`: Sync error (desktop only)

**Example Event**:
```
event: message:new
data: {"message": {"id": "msg123", "text": "Hello", ...}}
```

---

## Sessions

### GET /sessions/list

List all active sessions for the authenticated user.

**Headers**: `Authorization: Bearer <access-token>`

**Response**:
```json
{
  "success": true,
  "sessions": [
    {
      "id": "session-id",
      "deviceType": "mobile" | "desktop",
      "deviceId": "device-identifier",
      "userAgent": "Mozilla/5.0...",
      "ipAddress": "192.168.1.1",
      "lastUsedAt": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T09:00:00.000Z",
      "isCurrent": true
    }
  ],
  "count": 2
}
```

### DELETE /sessions/revoke/:id

Revoke a specific session by ID.

**Headers**: `Authorization: Bearer <access-token>`

**URL Parameters**:
- `id` (required): Session ID to revoke

**Response**:
```json
{
  "success": true,
  "message": "Session revoked successfully"
}
```

---

## Additional Endpoints

### GET /auth/sync-messages

Get recent messages for desktop initial sync (WhatsApp-like).

**Headers**: `Authorization: Bearer <access-token>`

**Query Parameters**:
- `limit` (optional): Number of messages per conversation (default: 50)
- `days` (optional): Days back to sync (default: 7)

**Response**:
```json
{
  "success": true,
  "conversations": [
    {
      "conversationId": "conv-id",
      "messages": [...],
      "lastMessageAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

### GET /auth/users/search

Search for users by phone number.

**Headers**: `Authorization: Bearer <access-token>`

**Query Parameters**:
- `phone` (required): Phone number to search

**Response**:
```json
{
  "success": true,
  "users": [
    {
      "id": "user-id",
      "name": "User Name",
      "phone": "9033868859",
      "avatarUrl": null
    }
  ]
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

**Common HTTP Status Codes**:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `401`: Unauthorized (authentication required or invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (resource not found)
- `500`: Internal Server Error

---

## Authentication

Most endpoints require authentication via JWT token in one of the following ways:

1. **Authorization Header** (recommended):
   ```
   Authorization: Bearer <access-token>
   ```

2. **Query Parameter**:
   ```
   GET /endpoint?token=<access-token>
   ```

3. **X-Auth-Token Header**:
   ```
   X-Auth-Token: <access-token>
   ```

---

## Rate Limiting

Currently, no rate limiting is implemented. Consider adding rate limiting for production use.

---

## CORS

CORS is configured to allow all origins in development. For production, configure `CORS_ORIGIN` environment variable.

---

## Notes

- All timestamps are in ISO 8601 format (UTC)
- All IDs are MongoDB ObjectIds (24-character hex strings)
- SSE connections support reconnection via `Last-Event-ID` header
- Desktop sessions automatically sync recent messages via SSE
- Mobile devices are considered "master" devices and can authorize desktop sessions

