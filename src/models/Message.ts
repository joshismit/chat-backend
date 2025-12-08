import mongoose, { Document, Schema } from 'mongoose';

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
}

export interface IMessageAttachment {
  type: string;
  url: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

export interface IMessage extends Document {
  _id: mongoose.Types.ObjectId; // message id
  senderId: mongoose.Types.ObjectId; // sender_id
  receiverId: mongoose.Types.ObjectId; // receiver_id
  content: string; // content (text)
  type: MessageType; // type (text/image/video)
  status: MessageStatus; // status (sent/delivered/read)
  timestamp: Date; // timestamp (message time)
  
  // Additional fields for backward compatibility and features
  conversationId?: mongoose.Types.ObjectId; // Optional: for group chats
  attachments?: IMessageAttachment[];
  clientId?: string; // Client-side generated ID (nanoid)
  deliveredTo?: mongoose.Types.ObjectId[];
  readBy?: mongoose.Types.ObjectId[];
  createdAt: Date; // Alias for timestamp
}

const MessageAttachmentSchema = new Schema<IMessageAttachment>(
  {
    type: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    fileName: {
      type: String,
    },
    fileSize: {
      type: Number,
    },
    mimeType: {
      type: String,
    },
  },
  {
    _id: false,
  }
);

const MessageSchema = new Schema<IMessage>(
  {
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    receiverId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(MessageType),
      required: true,
      default: MessageType.TEXT,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(MessageStatus),
      required: true,
      default: MessageStatus.SENT,
      index: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    // Additional fields for backward compatibility
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: false,
      index: true,
      sparse: true,
    },
    attachments: {
      type: [MessageAttachmentSchema],
      default: [],
    },
    clientId: {
      type: String,
      sparse: true, // Allows null/undefined but indexes when present
    },
    deliveredTo: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    readBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

// Required indexes: sender + receiver, timestamp, status
// Compound index for sender + receiver queries
MessageSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });

// Index for receiver queries (inbox)
MessageSchema.index({ receiverId: 1, timestamp: -1 });

// Index for sender queries (sent messages)
MessageSchema.index({ senderId: 1, timestamp: -1 });

// Index for status queries
MessageSchema.index({ status: 1, timestamp: -1 });

// Index for timestamp (for sorting)
MessageSchema.index({ timestamp: -1 });

// Compound index for sender + receiver + status
MessageSchema.index({ senderId: 1, receiverId: 1, status: 1 });

// Backward compatibility indexes
MessageSchema.index({ conversationId: 1, timestamp: -1 }, { sparse: true });
MessageSchema.index({ clientId: 1 }, { unique: true, sparse: true });

// Pre-save hook: Sync timestamp and createdAt
MessageSchema.pre('save', function(next) {
  if (this.isNew && !this.timestamp) {
    this.timestamp = new Date();
  }
  // Sync createdAt with timestamp for backward compatibility
  if (this.timestamp) {
    this.createdAt = this.timestamp;
  }
  next();
});

export const Message = mongoose.model<IMessage>('Message', MessageSchema);

