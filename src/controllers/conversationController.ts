import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Conversation, ConversationType, IConversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { User } from '../models/User';
import { sendEventToUser } from '../sse';
import mongoose from 'mongoose';

export interface CreateConversationRequest {
  type?: ConversationType;
  title?: string;
  memberIds: string[]; // Array of user IDs (excluding current user)
}

export class ConversationController {
  /**
   * GET /conversations
   * List conversations for authenticated user
   */
  getConversations = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const userIdObj = new mongoose.Types.ObjectId(userId);

      // Find conversations where user is a member and not archived
      const conversations = await Conversation.find({
        members: userIdObj,
        archivedBy: { $ne: userIdObj }, // Exclude archived conversations
      })
        .populate('members', 'name avatarUrl phone')
        .sort({ lastMessageAt: -1, createdAt: -1 }) // Most recent first
        .lean();

      // Shape conversation data
      const formattedConversations = conversations.map((conv) => {
        const members = (conv.members as any[]).map((member: any) => ({
          id: member._id.toString(),
          name: member.name,
          avatarUrl: member.avatarUrl,
          phone: member.phone,
        }));

        // For 1:1 conversations, get the other member's info
        const otherMember =
          conv.type === ConversationType.PRIVATE && members.length === 2
            ? members.find((m) => m.id !== userId)
            : null;

        return {
          id: conv._id.toString(),
          type: conv.type,
          title:
            conv.type === ConversationType.PRIVATE && otherMember
              ? otherMember.name
              : conv.title || null,
          members,
          otherMember: otherMember || null, // For 1:1 chats
          lastMessageAt: conv.lastMessageAt?.toISOString() || null,
          createdAt: conv.createdAt.toISOString(),
          archived: false, // Already filtered out archived ones
        };
      });

      res.json({
        success: true,
        conversations: formattedConversations,
        count: formattedConversations.length,
      });
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({
        error: 'Failed to fetch conversations',
        details: error.message,
      });
    }
  };

  /**
   * POST /conversations
   * Create new conversation (1:1 or group)
   */
  createConversation = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { type, title, memberIds }: CreateConversationRequest = req.body;

      // Validation
      if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
        res.status(400).json({ error: 'memberIds array is required with at least one member' });
        return;
      }

      // Determine conversation type
      const conversationType =
        type || (memberIds.length === 1 ? ConversationType.PRIVATE : ConversationType.GROUP);

      // Validate group conversation has title
      if (conversationType === ConversationType.GROUP && !title) {
        res.status(400).json({ error: 'title is required for group conversations' });
        return;
      }

      // Validate all member IDs exist
      const memberObjectIds = memberIds.map((id) => new mongoose.Types.ObjectId(id));
      const users = await User.find({ _id: { $in: memberObjectIds } });
      if (users.length !== memberIds.length) {
        res.status(400).json({ error: 'One or more member IDs are invalid' });
        return;
      }

      // Check if user is trying to add themselves
      if (memberIds.includes(userId)) {
        res.status(400).json({ error: 'Cannot add yourself as a member' });
        return;
      }

      // For 1:1 conversations, check if conversation already exists
      if (conversationType === ConversationType.PRIVATE) {
        const existingConv = await Conversation.findOne({
          type: ConversationType.PRIVATE,
          members: { $all: [userId, memberIds[0]] },
        });

        if (existingConv) {
          // Return existing conversation
          const populated = await Conversation.findById(existingConv._id)
            .populate('members', 'name avatarUrl phone')
            .lean();

          const members = (populated?.members as any[]).map((member: any) => ({
            id: member._id.toString(),
            name: member.name,
            avatarUrl: member.avatarUrl,
            phone: member.phone,
          }));

          const otherMember = members.find((m) => m.id !== userId);

          res.json({
            success: true,
            conversation: {
              id: existingConv._id.toString(),
              type: existingConv.type,
              title: otherMember?.name || null,
              members,
              otherMember: otherMember || null,
              lastMessageAt: existingConv.lastMessageAt?.toISOString() || null,
              createdAt: existingConv.createdAt.toISOString(),
              archived: false,
            },
            alreadyExists: true,
          });
          return;
        }
      }

      // Create conversation with current user + members
      const allMembers = [new mongoose.Types.ObjectId(userId), ...memberObjectIds];
      const conversation = await Conversation.create({
        type: conversationType,
        title: conversationType === ConversationType.GROUP ? title : undefined,
        members: allMembers,
        archivedBy: [],
      });

      // Populate members
      const populated = await Conversation.findById(conversation._id)
        .populate('members', 'name avatarUrl phone')
        .lean();

      const members = (populated?.members as any[]).map((member: any) => ({
        id: member._id.toString(),
        name: member.name,
        avatarUrl: member.avatarUrl,
        phone: member.phone,
      }));

      const otherMember =
        conversationType === ConversationType.PRIVATE
          ? members.find((m) => m.id !== userId)
          : null;

      const conversationData = {
        id: conversation._id.toString(),
        type: conversation.type,
        title:
          conversationType === ConversationType.PRIVATE && otherMember
            ? otherMember.name
            : conversation.title || null,
        members,
        otherMember: otherMember || null,
        lastMessageAt: null,
        createdAt: conversation.createdAt.toISOString(),
        archived: false,
      };

      // Broadcast conversation creation to all members via SSE
      allMembers.forEach((memberId) => {
        if (memberId.toString() !== userId) {
          sendEventToUser(memberId.toString(), 'conversation:new', {
            conversation: conversationData,
          });
        }
      });

      res.status(201).json({
        success: true,
        conversation: conversationData,
        alreadyExists: false,
      });
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      res.status(500).json({
        error: 'Failed to create conversation',
        details: error.message,
      });
    }
  };

  /**
   * PATCH /conversations/:id/archive
   * Archive or unarchive a conversation for the authenticated user
   */
  archiveConversation = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const { archived } = req.body; // boolean

      if (typeof archived !== 'boolean') {
        res.status(400).json({ error: 'archived (boolean) is required in request body' });
        return;
      }

      const conversation = await Conversation.findById(id);
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      // Check if user is a member
      const userIdObj = new mongoose.Types.ObjectId(userId);
      const isMember = conversation.members.some(
        (memberId) => memberId.toString() === userId
      );
      if (!isMember) {
        res.status(403).json({ error: 'You are not a member of this conversation' });
        return;
      }

      // Update archivedBy array
      if (archived) {
        // Add to archivedBy if not already there
        if (!conversation.archivedBy.some((id) => id.toString() === userId)) {
          conversation.archivedBy.push(userIdObj);
        }
      } else {
        // Remove from archivedBy
        conversation.archivedBy = conversation.archivedBy.filter(
          (id) => id.toString() !== userId
        );
      }

      await conversation.save();

      res.json({
        success: true,
        archived,
        conversationId: id,
      });
    } catch (error: any) {
      console.error('Error archiving conversation:', error);
      res.status(500).json({
        error: 'Failed to archive conversation',
        details: error.message,
      });
    }
  };

  /**
   * GET /conversations/:id
   * Get conversation details with last N messages
   */
  getConversation = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { id } = req.params;
      const messageLimit = Math.min(parseInt(req.query.limit as string || '20', 10), 50); // Max 50 messages

      const conversation = await Conversation.findById(id)
        .populate('members', 'name avatarUrl phone')
        .lean();

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      // Check if user is a member
      const isMember = conversation.members.some(
        (member: any) => member._id.toString() === userId
      );
      if (!isMember) {
        res.status(403).json({ error: 'You are not a member of this conversation' });
        return;
      }

      // Get last N messages
      const messages = await Message.find({
        conversationId: new mongoose.Types.ObjectId(id),
      })
        .populate('senderId', 'name avatarUrl phone')
        .sort({ createdAt: -1 })
        .limit(messageLimit)
        .lean();

      // Format messages
      const formattedMessages = messages.map((msg: any) => ({
        id: msg._id.toString(),
        conversationId: msg.conversationId.toString(),
        senderId: msg.senderId._id?.toString() || msg.senderId.toString(),
        sender: {
          id: msg.senderId._id?.toString() || msg.senderId.toString(),
          name: msg.senderId.name,
          avatarUrl: msg.senderId.avatarUrl,
        },
        text: msg.text,
        attachments: msg.attachments || [],
        clientId: msg.clientId,
        status: msg.status,
        createdAt: msg.createdAt.toISOString(),
        deliveredTo: msg.deliveredTo.map((id: any) => id.toString()),
        readBy: msg.readBy.map((id: any) => id.toString()),
      }));

      // Format members
      const members = (conversation.members as any[]).map((member: any) => ({
        id: member._id.toString(),
        name: member.name,
        avatarUrl: member.avatarUrl,
        phone: member.phone,
      }));

      const otherMember =
        conversation.type === ConversationType.PRIVATE && members.length === 2
          ? members.find((m) => m.id !== userId)
          : null;

      const userIdObj = new mongoose.Types.ObjectId(userId);
      const isArchived = conversation.archivedBy.some(
        (id: any) => id.toString() === userId
      );

      res.json({
        success: true,
        conversation: {
          id: conversation._id.toString(),
          type: conversation.type,
          title:
            conversation.type === ConversationType.PRIVATE && otherMember
              ? otherMember.name
              : conversation.title || null,
          members,
          otherMember: otherMember || null,
          lastMessageAt: conversation.lastMessageAt?.toISOString() || null,
          createdAt: conversation.createdAt.toISOString(),
          archived: isArchived,
        },
        messages: formattedMessages.reverse(), // Reverse to show oldest first
        messageCount: formattedMessages.length,
      });
    } catch (error: any) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({
        error: 'Failed to fetch conversation',
        details: error.message,
      });
    }
  };
}

export const conversationController = new ConversationController();

