// Export Prisma types and enums
export {
  User,
  Message,
  Conversation,
  QRChallenge,
  RefreshToken,
  ConversationMember,
  ConversationArchive,
  MessageType,
  MessageStatus,
  ConversationType,
  DeviceType,
  Call,
  CallType,
  CallStatus,
} from '@prisma/client';

// Re-export types for backward compatibility
export type { User as IUser } from '@prisma/client';
export type { Message as IMessage } from '@prisma/client';
export type { Conversation as IConversation } from '@prisma/client';
export type { QRChallenge as IQRChallenge } from '@prisma/client';
export type { RefreshToken as IRefreshToken } from '@prisma/client';

// Additional type exports for compatibility
export interface IActiveDevice {
  deviceId: string;
  deviceType: 'mobile' | 'desktop';
  lastActiveAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface IMessageAttachment {
  type: string;
  url: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

// Session alias for RefreshToken
export { RefreshToken as Session } from '@prisma/client';
