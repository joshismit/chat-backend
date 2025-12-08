# Attachment Upload API Examples

## POST /attachments

Upload a file attachment. Returns a URL that can be used in message attachments.

### Request

```bash
POST /attachments
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: multipart/form-data

Form Data:
  file: [binary file data]
```

### cURL Example

```bash
curl -X POST http://localhost:3000/attachments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/image.jpg"
```

### JavaScript/Fetch Example

```javascript
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const response = await fetch('http://localhost:3000/attachments', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${jwtToken}`
    // Don't set Content-Type header, browser will set it with boundary
  },
  body: formData
});

const result = await response.json();
console.log(result);
```

### React Native Example

```typescript
import * as DocumentPicker from 'expo-document-picker';

const uploadAttachment = async (fileUri: string, fileName: string, mimeType: string) => {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: fileName,
    type: mimeType,
  } as any);

  const response = await fetch('http://localhost:3000/attachments', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
    },
    body: formData,
  });

  return response.json();
};
```

### Response (200 OK)

```json
{
  "success": true,
  "url": "https://your-bucket.s3.amazonaws.com/attachments/abc123.jpg",
  "mime": "image/jpeg",
  "size": 1024000,
  "name": "photo.jpg"
}
```

### Response (Local Storage - Development)

```json
{
  "success": true,
  "url": "http://localhost:3000/uploads/attachments/abc123.jpg",
  "mime": "image/jpeg",
  "size": 1024000,
  "name": "photo.jpg"
}
```

---

## Using Attachment in Message Send Flow

### Step 1: Upload Attachment

```typescript
// Upload file first
const uploadResponse = await fetch('/attachments', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData
});

const { url, mime, size, name } = await uploadResponse.json();
```

### Step 2: Send Message with Attachment

```typescript
// Use the uploaded URL in message
const messageResponse = await fetch('/messages/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    conversationId: 'conv123',
    text: 'Check out this image!',
    attachments: [{
      type: 'image',
      url: url,        // From upload response
      fileName: name, // From upload response
      fileSize: size, // From upload response
      mimeType: mime  // From upload response
    }]
  })
});
```

### Complete Example

```typescript
const sendMessageWithAttachment = async (
  conversationId: string,
  file: File,
  text?: string
) => {
  // Step 1: Upload attachment
  const formData = new FormData();
  formData.append('file', file);

  const uploadRes = await fetch('/attachments', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error('Failed to upload attachment');
  }

  const { url, mime, size, name } = await uploadRes.json();

  // Step 2: Send message with attachment
  const messageRes = await fetch('/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      conversationId,
      text,
      attachments: [{
        type: getAttachmentType(mime), // 'image', 'video', 'document', etc.
        url,
        fileName: name,
        fileSize: size,
        mimeType: mime,
      }],
    }),
  });

  return messageRes.json();
};

// Helper to determine attachment type from MIME type
const getAttachmentType = (mime: string): string => {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
};
```

---

## Configuration

### Environment Variables

#### For Local Storage (Development)

```env
USE_S3=false
API_BASE_URL=http://localhost:3000
```

Files will be stored in `backend/uploads/attachments/` directory.

#### For S3 (Production)

```env
USE_S3=true
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
```

### File Size Limits

- Maximum file size: **50MB**
- Configured in `backend/src/middleware/upload.ts`

### Supported File Types

**Images:**
- JPEG, PNG, GIF, WebP, SVG

**Videos:**
- MP4, MPEG, QuickTime, AVI, WebM

**Documents:**
- PDF, Word, Excel, PowerPoint, Text, CSV

**Audio:**
- MP3, WAV, OGG, WebM

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
  "error": "No file uploaded. Use multipart/form-data with \"file\" field."
}
```

### 400 Bad Request (Invalid File Type)
```json
{
  "error": "File type application/x-executable is not allowed"
}
```

### 500 Internal Server Error
```json
{
  "error": "Failed to upload attachment",
  "details": "Error details..."
}
```

---

## S3 Presigned URL Details

When using S3:
- Files are stored as **private** in S3
- Presigned URLs are generated with **7-day expiration**
- URLs can be refreshed by calling the upload endpoint again (returns new presigned URL)
- For longer-term access, implement a URL refresh endpoint

### S3 Helper Functions

The `s3Helper.ts` provides:

- `uploadToS3()` - Upload file and get presigned URL
- `uploadToLocal()` - Store file locally (dev)
- `uploadFile()` - Main function (auto-selects S3 or local)
- `getPresignedUrl()` - Generate new presigned URL for existing file

---

## Notes

1. **Two-Step Process**: Upload attachment first, then use URL in message
2. **Presigned URLs**: S3 URLs expire after 7 days (configurable)
3. **Local Storage**: Files stored in `uploads/` directory (gitignored)
4. **File Validation**: Only allowed MIME types accepted
5. **Size Limit**: 50MB maximum file size
6. **Unique Filenames**: Generated using nanoid tokens

