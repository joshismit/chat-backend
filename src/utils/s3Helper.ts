import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { customAlphabet } from 'nanoid';
import * as fs from 'fs';
import * as path from 'path';
import multer from 'multer';

// Use Express.Multer.File type (non-nullable)
type MulterFile = NonNullable<Express.Request['file']>;

// Generate random token for file names
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateToken = customAlphabet(alphabet, 32);

const S3_BUCKET = process.env.S3_BUCKET || 'your-bucket-name';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const USE_S3 = process.env.USE_S3 === 'true' && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY;

// Initialize S3 client if credentials are provided
let s3Client: S3Client | null = null;

if (USE_S3) {
  s3Client = new S3Client({
    region: S3_REGION,
    credentials: {
      accessKeyId: AWS_ACCESS_KEY_ID!,
      secretAccessKey: AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export interface UploadResult {
  url: string;
  mime: string;
  size: number;
  name: string;
  key?: string; // S3 key for reference
}

/**
 * Upload file to S3 and return presigned URL
 */
export const uploadToS3 = async (
  file: MulterFile,
  folder: string = 'attachments'
): Promise<UploadResult> => {
  if (!s3Client) {
    throw new Error('S3 client not configured. Set AWS credentials in environment variables.');
  }

  // Generate unique file key
  const fileExtension = path.extname(file.originalname);
  const fileName = `${generateToken()}${fileExtension}`;
  const key = `${folder}/${fileName}`;

  // Upload to S3
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: 'private', // Private by default, use presigned URLs for access
  });

  await s3Client.send(command);

  // Generate presigned URL (valid for 7 days)
  const getObjectCommand = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  const presignedUrl = await getSignedUrl(s3Client, getObjectCommand, {
    expiresIn: 7 * 24 * 60 * 60, // 7 days
  });

  return {
    url: presignedUrl,
    mime: file.mimetype,
    size: file.size,
    name: file.originalname,
    key: key,
  };
};

/**
 * Upload file to local storage (for development)
 */
export const uploadToLocal = async (
  file: MulterFile,
  folder: string = 'attachments'
): Promise<UploadResult> => {
  const uploadsDir = path.join(process.cwd(), 'uploads', folder);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Generate unique filename
  const fileExtension = path.extname(file.originalname);
  const fileName = `${generateToken()}${fileExtension}`;
  const filePath = path.join(uploadsDir, fileName);

  // Write file to disk
  fs.writeFileSync(filePath, file.buffer);

  // Return local URL (adjust based on your server setup)
  const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
  const url = `${baseUrl}/uploads/${folder}/${fileName}`;

  return {
    url,
    mime: file.mimetype,
    size: file.size,
    name: file.originalname,
  };
};

/**
 * Main upload function - uses S3 if configured, otherwise local storage
 */
export const uploadFile = async (
  file: MulterFile,
  folder: string = 'attachments'
): Promise<UploadResult> => {
  if (USE_S3 && s3Client) {
    return uploadToS3(file, folder);
  } else {
    return uploadToLocal(file, folder);
  }
};

/**
 * Generate presigned URL for existing S3 object
 */
export const getPresignedUrl = async (
  key: string,
  expiresIn: number = 7 * 24 * 60 * 60 // 7 days default
): Promise<string> => {
  if (!s3Client) {
    throw new Error('S3 client not configured');
  }

  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn });
};

