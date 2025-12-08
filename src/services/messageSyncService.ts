import mongoose from 'mongoose';
import { Message, IMessage } from '../models/Message';
import { Conversation } from '../models/Conversation';

export interface RecentMessage {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: string;
  status: string;
  timestamp: string;
  sender?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
}

export interface ConversationSync {
  conversationId: string;
  messages: RecentMessage[];
  lastMessageAt?: string;
}

/**
 * Message Sync Service
 * Loads recent messages for desktop session initialization (WhatsApp-like sync)
 */
export class MessageSyncService {
  /**
   * Get recent messages for a user (for desktop sync)
   * Returns messages from all conversations the user is part of
   * 
   * @param userId - User ID
   * @param limitPerConversation - Number of recent messages per conversation (default: 50)
   * @param daysBack - How many days back to sync (default: 7 days)
   */
  async getRecentMessagesForUser(
    userId: string,
    limitPerConversation: number = 50,
    daysBack: number = 7
  ): Promise<ConversationSync[]> {
    try {
      const userIdObj = new mongoose.Types.ObjectId(userId);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      // Get all conversations user is part of
      const conversations = await Conversation.find({
        members: userIdObj,
      })
        .select('_id lastMessageAt')
        .lean();

      const conversationSyncs: ConversationSync[] = [];

      // For each conversation, get recent messages
      for (const conv of conversations) {
        // Query messages for this conversation
        // Messages can be linked via conversationId OR senderId/receiverId
        const messages = await Message.find({
          $or: [
            { conversationId: conv._id }, // Group chats or conversation-linked messages
            { 
              $and: [
                { senderId: userIdObj },
                { receiverId: { $exists: true, $ne: null } }
              ]
            }, // User sent messages
            { receiverId: userIdObj }, // User received messages
          ],
          timestamp: { $gte: cutoffDate },
        })
          .populate('senderId', 'name avatarUrl phone')
          .sort({ timestamp: -1 })
          .limit(limitPerConversation)
          .lean();

        // Format messages
        const formattedMessages: RecentMessage[] = messages.map((msg: any) => {
          const sender = msg.senderId;
          return {
            id: msg._id.toString(),
            conversationId: msg.conversationId?.toString() || conv._id.toString(),
            senderId: msg.senderId._id?.toString() || msg.senderId.toString(),
            receiverId: msg.receiverId?.toString() || '',
            content: msg.content || msg.text || '',
            type: msg.type || 'text',
            status: msg.status || 'sent',
            timestamp: msg.timestamp?.toISOString() || msg.createdAt?.toISOString() || new Date().toISOString(),
            sender: sender && typeof sender === 'object' ? {
              id: sender._id?.toString() || sender.toString(),
              name: sender.name || 'Unknown',
              avatarUrl: sender.avatarUrl || undefined,
            } : undefined,
          };
        });

        if (formattedMessages.length > 0) {
          conversationSyncs.push({
            conversationId: conv._id.toString(),
            messages: formattedMessages.reverse(), // Oldest first
            lastMessageAt: conv.lastMessageAt?.toISOString(),
          });
        }
      }

      console.log(`Loaded ${conversationSyncs.length} conversations with recent messages for user ${userId}`);

      return conversationSyncs;
    } catch (error) {
      console.error('Error loading recent messages:', error);
      throw error;
    }
  }

  /**
   * Get recent messages for specific conversations (optimized)
   * Used when desktop opens specific conversation
   */
  async getRecentMessagesForConversations(
    userId: string,
    conversationIds: string[],
    limitPerConversation: number = 50
  ): Promise<ConversationSync[]> {
    try {
      const userIdObj = new mongoose.Types.ObjectId(userId);
      const conversationIdObjs = conversationIds.map(id => new mongoose.Types.ObjectId(id));

      const conversationSyncs: ConversationSync[] = [];

      for (const convId of conversationIdObjs) {
        const messages = await Message.find({
          $or: [
            { conversationId: convId },
            { senderId: userIdObj, receiverId: { $exists: true } },
            { receiverId: userIdObj },
          ],
        })
          .populate('senderId', 'name avatarUrl phone')
          .sort({ timestamp: -1 })
          .limit(limitPerConversation)
          .lean();

        const formattedMessages: RecentMessage[] = messages.map((msg: any) => {
          const sender = msg.senderId;
          return {
            id: msg._id.toString(),
            conversationId: msg.conversationId?.toString() || convId.toString(),
            senderId: msg.senderId._id?.toString() || msg.senderId.toString(),
            receiverId: msg.receiverId?.toString() || '',
            content: msg.content || msg.text || '',
            type: msg.type || 'text',
            status: msg.status || 'sent',
            timestamp: msg.timestamp?.toISOString() || msg.createdAt?.toISOString() || new Date().toISOString(),
            sender: sender && typeof sender === 'object' ? {
              id: sender._id?.toString() || sender.toString(),
              name: sender.name || 'Unknown',
              avatarUrl: sender.avatarUrl || undefined,
            } : undefined,
          };
        });

        if (formattedMessages.length > 0) {
          conversationSyncs.push({
            conversationId: convId.toString(),
            messages: formattedMessages.reverse(),
          });
        }
      }

      return conversationSyncs;
    } catch (error) {
      console.error('Error loading messages for conversations:', error);
      throw error;
    }
  }
}

export const messageSyncService = new MessageSyncService();

