import mongoose, { Document, Schema } from 'mongoose';

export enum ConversationType {
  PRIVATE = 'private',
  GROUP = 'group',
}

export interface IConversation extends Document {
  _id: mongoose.Types.ObjectId;
  type: ConversationType;
  title?: string;
  members: mongoose.Types.ObjectId[];
  lastMessageAt?: Date;
  archivedBy: mongoose.Types.ObjectId[]; // Users who archived this conversation
  createdAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    type: {
      type: String,
      enum: Object.values(ConversationType),
      required: true,
      default: ConversationType.PRIVATE,
    },
    title: {
      type: String,
      trim: true,
      default: null,
    },
    members: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessageAt: {
      type: Date,
      default: null,
      index: true,
    },
    archivedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Index for faster queries
ConversationSchema.index({ members: 1 });
ConversationSchema.index({ lastMessageAt: -1 });

export const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);

