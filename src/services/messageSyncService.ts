import { prisma } from '../utils/prisma';

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
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      // Get all conversations user is part of
      const conversationMembers = await prisma.conversationMember.findMany({
        where: {
          userId,
        },
        include: {
          conversation: {
            select: {
              id: true,
              lastMessageAt: true,
            },
          },
        },
      });

      const conversationSyncs: ConversationSync[] = [];

      // For each conversation, get recent messages
      for (const member of conversationMembers) {
        const convId = member.conversationId;

        // Query messages for this conversation
        // Messages can be linked via conversationId OR senderId/receiverId
        const messages = await prisma.message.findMany({
          where: {
            OR: [
              { conversationId: convId }, // Group chats or conversation-linked messages
              {
                AND: [
                  { senderId: userId },
                  { receiverId: { not: '' } }, // Changed to check not empty string if needed, or just remove
                ],
              }, // User sent messages
              { receiverId: userId }, // User received messages
            ],
            timestamp: { gte: cutoffDate },
          },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                phone: true,
              },
            },
          },
          orderBy: {
            timestamp: 'desc',
          },
          take: limitPerConversation,
        });

        // Format messages
        const formattedMessages: RecentMessage[] = messages.map((msg) => {
          return {
            id: msg.id,
            conversationId: msg.conversationId || convId,
            senderId: msg.senderId,
            receiverId: msg.receiverId,
            content: msg.content || '',
            type: msg.type,
            status: msg.status,
            timestamp: msg.timestamp.toISOString(),
            sender: msg.sender ? {
              id: msg.sender.id,
              name: msg.sender.name,
              avatarUrl: msg.sender.avatarUrl || undefined,
            } : undefined,
          };
        });

        if (formattedMessages.length > 0) {
          conversationSyncs.push({
            conversationId: convId,
            messages: formattedMessages.reverse(), // Oldest first
            lastMessageAt: member.conversation.lastMessageAt?.toISOString(),
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
      const conversationSyncs: ConversationSync[] = [];

      for (const convId of conversationIds) {
        const messages = await prisma.message.findMany({
          where: {
            OR: [
              { conversationId: convId },
              { senderId: userId, receiverId: { not: '' } },
              { receiverId: userId },
            ],
          },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
                phone: true,
              },
            },
          },
          orderBy: {
            timestamp: 'desc',
          },
          take: limitPerConversation,
        });

        const formattedMessages: RecentMessage[] = messages.map((msg) => {
          return {
            id: msg.id,
            conversationId: msg.conversationId || convId,
            senderId: msg.senderId,
            receiverId: msg.receiverId,
            content: msg.content || '',
            type: msg.type,
            status: msg.status,
            timestamp: msg.timestamp.toISOString(),
            sender: msg.sender ? {
              id: msg.sender.id,
              name: msg.sender.name,
              avatarUrl: msg.sender.avatarUrl || undefined,
            } : undefined,
          };
        });

        if (formattedMessages.length > 0) {
          conversationSyncs.push({
            conversationId: convId,
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
