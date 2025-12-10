import mongoose, { Document, Schema } from 'mongoose';

export interface IActiveDevice {
  deviceId: string;
  deviceType: 'mobile' | 'desktop';
  lastActiveAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  password?: string;
  avatarUrl?: string;
  token: string; // Unique dedicated token for each user
  activeDevices: IActiveDevice[];
  lastSeen: Date;
  createdAt: Date;
}

const ActiveDeviceSchema = new Schema<IActiveDevice>(
  {
    deviceId: {
      type: String,
      required: true,
    },
    deviceType: {
      type: String,
      enum: ['mobile', 'desktop'],
      required: true,
    },
    lastActiveAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    userAgent: {
      type: String,
      required: false,
    },
    ipAddress: {
      type: String,
      required: false,
    },
  },
  {
    _id: false,
  }
);

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: false,
      trim: true,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    activeDevices: {
      type: [ActiveDeviceSchema],
      default: [],
    },
    lastSeen: {
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

// Indexes
UserSchema.index({ phone: 1 }, { unique: true });
UserSchema.index({ token: 1 }, { unique: true });
UserSchema.index({ lastSeen: -1 });

export const User = mongoose.model<IUser>('User', UserSchema);

