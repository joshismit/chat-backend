import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MessageStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { sendEventToUser } from '../sse';

export interface SendMessageRequest {
  conversationId: string;
  clientId?: string;
  text?: string;
  attachments?: Array<{
    type: string;
    url: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  }>;
}

export interface GetMessagesQuery {
  conversationId: string;
  before?: string; // ISO timestamp string
  limit?: string; // Number as string
}

export class MessageController {
  /**
   * POST /messages/send
   * Send a new message
   */
  sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { conversationId, clientId, text, attachments }: SendMessageRequest = req.body;

      // Validation
      if (!conversationId) {
        res.status(400).json({ error: 'conversationId is required' });
        return;
      }

      if (!text && (!attachments || attachments.length === 0)) {
        res.status(400).json({ error: 'Either text or attachments must be provided' });
        return;
      }

      // Validate conversation exists and user is a member
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const isMember = conversation.members.some(
        (member) => member.userId === userId
      );
      if (!isMember) {
        res.status(403).json({ error: 'You are not a member of this conversation' });
        return;
      }

      // Validate attachments if provided
      if (attachments && attachments.length > 0) {
        for (const attachment of attachments) {
          if (!attachment.type || !attachment.url) {
            res.status(400).json({
              error: 'Each attachment must have type and url',
            });
            return;
          }
        }
      }

      // Determine receiverId from conversation members (exclude sender)
      const receiverMember = conversation.members.find(
        (member) => member.userId !== userId
      ) || conversation.members[0]; // Fallback to first member if only one member
      const receiverId = receiverMember?.userId || userId;

      // Create message
      const message = await prisma.message.create({
        data: {
          conversationId: conversationId,
          senderId: userId,
          receiverId: receiverId,
          content: text?.trim() || (attachments && attachments.length > 0 ? '' : ''),
          type: attachments && attachments.length > 0 ? 'IMAGE' : 'TEXT',
          attachments: attachments || [],
          clientId: clientId || undefined,
          status: MessageStatus.SENT,
          timestamp: new Date(),
          createdAt: new Date(),
        },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Update conversation's lastMessageAt
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date() },
      });

      // Prepare message payload for SSE (exclude sender from recipients)
      const messagePayload = {
        id: message.id,
        conversationId: conversationId,
        senderId: userId,
        sender: message.sender,
        text: message.content,
        content: message.content,
        attachments: (message.attachments as any[]) || [],
        clientId: message.clientId,
        status: message.status,
        createdAt: message.createdAt.toISOString(),
      };

      // Broadcast to all conversation members except sender via SSE
      const recipientIds = conversation.members
        .filter((member) => member.userId !== userId)
        .map((member) => member.userId);

      // Send to each recipient individually (excluding sender)
      recipientIds.forEach((recipientId) => {
        sendEventToUser(recipientId, 'message:new', {
          message: messagePayload,
        });
      });

      res.status(201).json({
        success: true,
        message: {
          id: message.id,
          conversationId: message.conversationId || conversationId,
          senderId: message.senderId,
          receiverId: message.receiverId,
          text: message.content,
          content: message.content,
          attachments: (message.attachments as any[]) || [],
          clientId: message.clientId,
          status: message.status,
          createdAt: message.createdAt.toISOString(),
          deliveredTo: [],
          readBy: [],
        },
      });
    } catch (error: any) {
      console.error('Error sending message:', error);
      res.status(500).json({
        error: 'Failed to send message',
        details: error.message,
      });
    }
  };

  /**
   * GET /messages?conversationId=...&before=timestamp&limit=20
   * Get paginated messages for a conversation
   */
  getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { conversationId, before, limit }: GetMessagesQuery = req.query as any;

      // Validation
      if (!conversationId) {
        res.status(400).json({ error: 'conversationId is required' });
        return;
      }

      // Validate conversation exists and user is a member
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          members: true,
        },
      });
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const isMember = conversation.members.some(
        (member) => member.userId === userId
      );
      if (!isMember) {
        res.status(403).json({ error: 'You are not a member of this conversation' });
        return;
      }

      // Parse pagination parameters
      const limitNum = Math.min(parseInt(limit || '20', 10), 100); // Max 100 messages
      const beforeDate = before ? new Date(before) : new Date();

      // Validate date
      if (isNaN(beforeDate.getTime())) {
        res.status(400).json({ error: 'Invalid before timestamp' });
        return;
      }

      // Fetch messages (ordered descending by createdAt)
      const messages = await prisma.message.findMany({
        where: {
          conversationId: conversationId,
          createdAt: { lt: beforeDate },
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
          deliveredTo: {
            select: {
              id: true,
            },
          },
          readBy: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limitNum,
      });

      // Format response
      const formattedMessages = messages.map((msg) => ({
        id: msg.id,
        conversationId: msg.conversationId || '',
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        sender: {
          id: msg.sender.id,
          name: msg.sender.name,
          avatarUrl: msg.sender.avatarUrl,
        },
        text: msg.content,
        content: msg.content,
        attachments: (msg.attachments as any[]) || [],
        clientId: msg.clientId,
        status: msg.status,
        createdAt: msg.createdAt.toISOString(),
        deliveredTo: msg.deliveredTo.map((user) => user.id),
        readBy: msg.readBy.map((user) => user.id),
      }));

      // Determine if there are more messages
      const hasMore = messages.length === limitNum;

      res.json({
        success: true,
        messages: formattedMessages,
        pagination: {
          limit: limitNum,
          hasMore,
          // Next page cursor (timestamp of last message)
          nextCursor: hasMore && formattedMessages.length > 0
            ? formattedMessages[formattedMessages.length - 1].createdAt
            : null,
        },
      });
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      res.status(500).json({
        error: 'Failed to fetch messages',
        details: error.message,
      });
    }
  };

  /**
   * POST /messages/:id/delivered
   * Mark message as delivered to the authenticated user
   * Can also be called implicitly when user receives message via SSE
   */
  markDelivered = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { toUserId } = req.body; // Optional: specify user, defaults to authenticated user

      const targetUserId = toUserId || userId;

      // Find message
      const message = await prisma.message.findUnique({
        where: { id },
        include: {
          deliveredTo: true,
          conversation: {
            include: {
              members: true,
            },
          },
        },
      });
      if (!message) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      // Check if already delivered to this user
      const alreadyDelivered = message.deliveredTo.some(
        (user) => user.id === targetUserId
      );

      if (alreadyDelivered) {
        res.json({
          success: true,
          message: 'Message already marked as delivered',
          messageId: id,
        });
        return;
      }

      // Connect user to deliveredTo relation
      await prisma.message.update({
        where: { id },
        data: {
          deliveredTo: {
            connect: { id: targetUserId },
          },
        },
      });

      // Update message status if all recipients have received it
      let updatedStatus = message.status;
      if (message.conversationId && message.conversation) {
        const recipientCount = message.conversation.members.filter(
          (member) => member.userId !== message.senderId
        ).length;
        
        // Get updated message to check deliveredTo count
        const updatedMessage = await prisma.message.findUnique({
          where: { id },
          include: {
            deliveredTo: true,
          },
        });
        
        if (updatedMessage && updatedMessage.deliveredTo.length >= recipientCount) {
          updatedStatus = MessageStatus.DELIVERED;
          await prisma.message.update({
            where: { id },
            data: { status: MessageStatus.DELIVERED },
          });
        }
      }

      // Emit SSE event to message sender
      const senderId = message.senderId;
      sendEventToUser(senderId, 'message:status', {
        messageId: id,
        status: 'delivered',
        userId: targetUserId,
        timestamp: new Date().toISOString(),
      });

      // Get final message state
      const finalMessage = await prisma.message.findUnique({
        where: { id },
        include: {
          deliveredTo: {
            select: { id: true },
          },
        },
      });

      res.json({
        success: true,
        messageId: id,
        deliveredTo: finalMessage?.deliveredTo.map((u) => u.id) || [],
        status: updatedStatus,
      });
    } catch (error: any) {
      console.error('Error marking message as delivered:', error);
      res.status(500).json({
        error: 'Failed to mark message as delivered',
        details: error.message,
      });
    }
  };

  /**
   * POST /messages/:id/read
   * Mark message as read by the authenticated user
   */
  markRead = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { userId: readByUserId } = req.body; // Optional: specify user, defaults to authenticated user

      const targetUserId = readByUserId || userId;

      // Find message
      const message = await prisma.message.findUnique({
        where: { id },
        include: {
          deliveredTo: true,
          readBy: true,
          conversation: {
            include: {
              members: true,
            },
          },
        },
      });
      if (!message) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      // Check if already read by this user
      const alreadyRead = message.readBy.some((user) => user.id === targetUserId);

      if (alreadyRead) {
        res.json({
          success: true,
          message: 'Message already marked as read',
          messageId: id,
        });
        return;
      }

      // Ensure user has received the message first (add to deliveredTo if not present)
      const isDelivered = message.deliveredTo.some(
        (user) => user.id === targetUserId
      );
      
      const updateData: any = {
        readBy: {
          connect: { id: targetUserId },
        },
      };
      
      if (!isDelivered) {
        updateData.deliveredTo = {
          connect: { id: targetUserId },
        };
      }

      await prisma.message.update({
        where: { id },
        data: updateData,
      });

      // Update message status if all recipients have read it
      let updatedStatus = message.status;
      if (message.conversationId && message.conversation) {
        const recipientCount = message.conversation.members.filter(
          (member) => member.userId !== message.senderId
        ).length;

        // Get updated message to check readBy count
        const updatedMessage = await prisma.message.findUnique({
          where: { id },
          include: {
            readBy: true,
          },
        });

        if (updatedMessage && updatedMessage.readBy.length >= recipientCount) {
          updatedStatus = MessageStatus.READ;
          await prisma.message.update({
            where: { id },
            data: { status: MessageStatus.READ },
          });
        } else if (updatedStatus !== MessageStatus.READ) {
          updatedStatus = MessageStatus.DELIVERED;
          await prisma.message.update({
            where: { id },
            data: { status: MessageStatus.DELIVERED },
          });
        }
      }

      // Emit SSE event to message sender
      const senderId = message.senderId;
      sendEventToUser(senderId, 'message:status', {
        messageId: id,
        status: 'read',
        userId: targetUserId,
        timestamp: new Date().toISOString(),
      });

      // Get final message state
      const finalMessage = await prisma.message.findUnique({
        where: { id },
        include: {
          deliveredTo: {
            select: { id: true },
          },
          readBy: {
            select: { id: true },
          },
        },
      });

      res.json({
        success: true,
        messageId: id,
        readBy: finalMessage?.readBy.map((u) => u.id) || [],
        deliveredTo: finalMessage?.deliveredTo.map((u) => u.id) || [],
        status: updatedStatus,
      });
    } catch (error: any) {
      console.error('Error marking message as read:', error);
      res.status(500).json({
        error: 'Failed to mark message as read',
        details: error.message,
      });
    }
  };
}

export const messageController = new MessageController();
