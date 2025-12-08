import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Message, MessageStatus, IMessage } from '../models/Message';
import { Conversation } from '../models/Conversation';
import { sendEventToUser } from '../sse';
import mongoose from 'mongoose';

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
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const userIdObj = new mongoose.Types.ObjectId(userId);
      const isMember = conversation.members.some(
        (memberId) => memberId.toString() === userId
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
      const receiverIdObj = conversation.members.find(
        (memberId) => memberId.toString() !== userId
      ) || conversation.members[0]; // Fallback to first member if only one member

      // Create message
      const message = await Message.create({
        conversationId: new mongoose.Types.ObjectId(conversationId),
        senderId: userIdObj,
        receiverId: receiverIdObj,
        content: text?.trim() || (attachments && attachments.length > 0 ? '' : ''),
        type: attachments && attachments.length > 0 ? 'image' : 'text',
        attachments: attachments || [],
        clientId: clientId || undefined,
        status: MessageStatus.SENT,
        timestamp: new Date(),
        deliveredTo: [],
        readBy: [],
      });

      // Update conversation's lastMessageAt
      conversation.lastMessageAt = new Date();
      await conversation.save();

      // Populate sender info for SSE event
      const populatedMessage = await Message.findById(message._id)
        .populate('senderId', 'name avatarUrl')
        .lean();

      // Prepare message payload for SSE (exclude sender from recipients)
      const messagePayload = {
        id: message._id.toString(),
        conversationId: conversationId,
        senderId: userId,
        sender: populatedMessage?.senderId,
        text: message.content,
        content: message.content,
        attachments: message.attachments || [],
        clientId: message.clientId,
        status: message.status,
        createdAt: message.createdAt.toISOString(),
      };

      // Broadcast to all conversation members except sender via SSE
      const recipientIds = conversation.members
        .filter((memberId) => memberId.toString() !== userId)
        .map((memberId) => memberId.toString());

      // Send to each recipient individually (excluding sender)
      recipientIds.forEach((recipientId) => {
        sendEventToUser(recipientId, 'message:new', {
          message: messagePayload,
        });
      });

      // Also send delivery confirmation to sender (optional)
      // This can be handled client-side, but we can send it here too

      res.status(201).json({
        success: true,
        message: {
          id: message._id.toString(),
          conversationId: message.conversationId?.toString() || conversationId,
          senderId: message.senderId.toString(),
          receiverId: message.receiverId.toString(),
          text: message.content,
          content: message.content,
          attachments: message.attachments || [],
          clientId: message.clientId,
          status: message.status,
          createdAt: message.createdAt.toISOString(),
          deliveredTo: (message.deliveredTo || []).map((id) => id.toString()),
          readBy: (message.readBy || []).map((id) => id.toString()),
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
      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      const isMember = conversation.members.some(
        (memberId) => memberId.toString() === userId
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

      // Build query
      const query: any = {
        conversationId: new mongoose.Types.ObjectId(conversationId),
        createdAt: { $lt: beforeDate },
      };

      // Fetch messages (ordered descending by createdAt)
      const messages = await Message.find(query)
        .populate('senderId', 'name avatarUrl phone')
        .sort({ createdAt: -1 })
        .limit(limitNum)
        .lean();

      // Format response
      const formattedMessages = messages.map((msg) => ({
        id: msg._id.toString(),
        conversationId: msg.conversationId?.toString() || '',
        senderId: msg.senderId._id?.toString() || msg.senderId.toString(),
        receiverId: msg.receiverId?.toString() || '',
        sender: {
          id: msg.senderId._id?.toString() || msg.senderId.toString(),
          name: (msg.senderId as any).name,
          avatarUrl: (msg.senderId as any).avatarUrl,
        },
        text: msg.content,
        content: msg.content,
        attachments: msg.attachments || [],
        clientId: msg.clientId,
        status: msg.status,
        createdAt: msg.createdAt.toISOString(),
        deliveredTo: (msg.deliveredTo || []).map((id: any) => id.toString()),
        readBy: (msg.readBy || []).map((id: any) => id.toString()),
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
      const targetUserIdObj = new mongoose.Types.ObjectId(targetUserId);

      // Find message
      const message = await Message.findById(id);
      if (!message) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      // Check if already delivered to this user
      const alreadyDelivered = (message.deliveredTo || []).some(
        (id) => id.toString() === targetUserId
      );

      if (alreadyDelivered) {
        res.json({
          success: true,
          message: 'Message already marked as delivered',
          messageId: id,
        });
        return;
      }

      // Initialize deliveredTo array if undefined
      if (!message.deliveredTo) {
        message.deliveredTo = [];
      }
      
      // Add to deliveredTo array
      message.deliveredTo.push(targetUserIdObj);
      
      // Update message status if all recipients have received it
      if (message.conversationId) {
        const conversation = await Conversation.findById(message.conversationId).select('members');
        if (conversation) {
          const recipientCount = conversation.members.filter(
            (memberId) => memberId.toString() !== message.senderId.toString()
          ).length;
          
          if (message.deliveredTo.length >= recipientCount) {
            message.status = MessageStatus.DELIVERED;
          }
        }
      }

      await message.save();

      // Emit SSE event to message sender
      const senderId = message.senderId.toString();
      sendEventToUser(senderId, 'message:status', {
        messageId: id,
        status: 'delivered',
        userId: targetUserId,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        messageId: id,
        deliveredTo: (message.deliveredTo || []).map((id) => id.toString()),
        status: message.status,
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
      const targetUserIdObj = new mongoose.Types.ObjectId(targetUserId);

      // Find message
      const message = await Message.findById(id);
      if (!message) {
        res.status(404).json({ error: 'Message not found' });
        return;
      }

      // Check if already read by this user
      const alreadyRead = (message.readBy || []).some((id) => id.toString() === targetUserId);

      if (alreadyRead) {
        res.json({
          success: true,
          message: 'Message already marked as read',
          messageId: id,
        });
        return;
      }

      // Initialize arrays if undefined
      if (!message.deliveredTo) {
        message.deliveredTo = [];
      }
      if (!message.readBy) {
        message.readBy = [];
      }

      // Ensure user has received the message first (add to deliveredTo if not present)
      const isDelivered = message.deliveredTo.some(
        (id) => id.toString() === targetUserId
      );
      if (!isDelivered) {
        message.deliveredTo.push(targetUserIdObj);
      }

      // Add to readBy array
      message.readBy.push(targetUserIdObj);

      // Update message status if all recipients have read it
      if (message.conversationId) {
        const conversation = await Conversation.findById(message.conversationId).select('members');
        if (conversation) {
          const recipientCount = conversation.members.filter(
            (memberId) => memberId.toString() !== message.senderId.toString()
          ).length;

          if (message.readBy.length >= recipientCount) {
            message.status = MessageStatus.READ;
          } else if (message.status !== MessageStatus.READ) {
            message.status = MessageStatus.DELIVERED;
          }
        }
      }

      await message.save();

      // Emit SSE event to message sender
      const senderId = message.senderId.toString();
      sendEventToUser(senderId, 'message:status', {
        messageId: id,
        status: 'read',
        userId: targetUserId,
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        messageId: id,
        readBy: (message.readBy || []).map((id) => id.toString()),
        deliveredTo: (message.deliveredTo || []).map((id) => id.toString()),
        status: message.status,
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

