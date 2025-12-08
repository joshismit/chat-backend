import mongoose, { Document, Schema } from 'mongoose';

/**
 * Session Model (Device Sessions & JWT Tokens)
 * Stores refresh tokens and device session information
 */
export interface IRefreshToken extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  token: string; // Refresh token string
  accessToken?: string; // Current access token (optional, for reference)
  deviceId?: string; // Device identifier
  deviceType: 'mobile' | 'desktop';
  userAgent?: string;
  ipAddress?: string;
  expiresAt: Date;
  lastUsedAt: Date;
  createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
    },
    accessToken: {
      type: String,
      required: false,
    },
    deviceId: {
      type: String,
      required: false,
    },
    deviceType: {
      type: String,
      enum: ['mobile', 'desktop'],
      required: true,
      default: 'mobile',
      index: true,
    },
    userAgent: {
      type: String,
      required: false,
    },
    ipAddress: {
      type: String,
      required: false,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Indexes for faster lookups
RefreshTokenSchema.index({ userId: 1, deviceType: 1 });
RefreshTokenSchema.index({ token: 1 }, { unique: true });
RefreshTokenSchema.index({ userId: 1, lastUsedAt: -1 });
RefreshTokenSchema.index({ deviceId: 1 });
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index for auto-deletion

// Also create Session model alias for clarity
export const Session = mongoose.model<IRefreshToken>('Session', RefreshTokenSchema);

export const RefreshToken = mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);

