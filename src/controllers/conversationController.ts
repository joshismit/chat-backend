import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { ConversationType } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { sendEventToUser } from '../sse';

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

      // Find conversations where user is a member and not archived
      const conversationMembers = await prisma.conversationMember.findMany({
        where: {
          userId,
          conversation: {
            archivedBy: {
              none: {
                userId,
              },
            },
          },
        },
        include: {
          conversation: {
            include: {
              members: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      avatarUrl: true,
                      phone: true,
                    },
                  },
                },
              },
              archivedBy: true,
            },
          },
        },
        orderBy: {
          conversation: {
            lastMessageAt: 'desc',
          },
        },
      });

      // Shape conversation data
      const formattedConversations = conversationMembers.map((member) => {
        const conv = member.conversation;
        const members = conv.members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          avatarUrl: m.user.avatarUrl,
          phone: m.user.phone,
        }));

        // For 1:1 conversations, get the other member's info
        const otherMember =
          conv.type === ConversationType.PRIVATE && members.length === 2
            ? members.find((m) => m.id !== userId)
            : null;

        return {
          id: conv.id,
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
      const users = await prisma.user.findMany({
        where: {
          id: { in: memberIds },
        },
      });
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
        const existingConv = await prisma.conversation.findFirst({
          where: {
            type: ConversationType.PRIVATE,
            members: {
              every: {
                userId: { in: [userId, memberIds[0]] },
              },
            },
          },
          include: {
            members: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    avatarUrl: true,
                    phone: true,
                  },
                },
              },
            },
          },
        });

        // Verify it's exactly these two users
        if (existingConv && existingConv.members.length === 2) {
          const memberUserIds = existingConv.members.map((m) => m.userId);
          if (
            memberUserIds.includes(userId) &&
            memberUserIds.includes(memberIds[0])
          ) {
            // Return existing conversation
            const members = existingConv.members.map((m) => ({
              id: m.user.id,
              name: m.user.name,
              avatarUrl: m.user.avatarUrl,
              phone: m.user.phone,
            }));

            const otherMember = members.find((m) => m.id !== userId);

            res.json({
              success: true,
              conversation: {
                id: existingConv.id,
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
      }

      // Create conversation with current user + members
      const allMemberIds = [userId, ...memberIds];
      const conversation = await prisma.conversation.create({
        data: {
          type: conversationType,
          title: conversationType === ConversationType.GROUP ? title : undefined,
          members: {
            create: allMemberIds.map((memberId) => ({
              userId: memberId,
            })),
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                  phone: true,
                },
              },
            },
          },
        },
      });

      const members = conversation.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        phone: m.user.phone,
      }));

      const otherMember =
        conversationType === ConversationType.PRIVATE
          ? members.find((m) => m.id !== userId)
          : null;

      const conversationData = {
        id: conversation.id,
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
      allMemberIds.forEach((memberId) => {
        if (memberId !== userId) {
          sendEventToUser(memberId, 'conversation:new', {
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

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          members: true,
        },
      });
      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      // Check if user is a member
      const isMember = conversation.members.some(
        (member) => member.userId === userId
      );
      if (!isMember) {
        res.status(403).json({ error: 'You are not a member of this conversation' });
        return;
      }

      // Update archivedBy relation
      if (archived) {
        // Create archive entry if not exists
        await prisma.conversationArchive.upsert({
          where: {
            conversationId_userId: {
              conversationId: id,
              userId,
            },
          },
          create: {
            conversationId: id,
            userId,
          },
          update: {},
        });
      } else {
        // Remove archive entry
        await prisma.conversationArchive.deleteMany({
          where: {
            conversationId: id,
            userId,
          },
        });
      }

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

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  avatarUrl: true,
                  phone: true,
                },
              },
            },
          },
          archivedBy: true,
        },
      });

      if (!conversation) {
        res.status(404).json({ error: 'Conversation not found' });
        return;
      }

      // Check if user is a member
      const isMember = conversation.members.some(
        (member) => member.userId === userId
      );
      if (!isMember) {
        res.status(403).json({ error: 'You are not a member of this conversation' });
        return;
      }

      // Get last N messages
      const messages = await prisma.message.findMany({
        where: {
          conversationId: id,
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
            select: { id: true },
          },
          readBy: {
            select: { id: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: messageLimit,
      });

      // Format messages
      const formattedMessages = messages.map((msg) => ({
        id: msg.id,
        conversationId: msg.conversationId || '',
        senderId: msg.senderId,
        sender: {
          id: msg.sender.id,
          name: msg.sender.name,
          avatarUrl: msg.sender.avatarUrl,
        },
        text: msg.content,
        attachments: (msg.attachments as any[]) || [],
        clientId: msg.clientId,
        status: msg.status,
        createdAt: msg.createdAt.toISOString(),
        deliveredTo: msg.deliveredTo.map((u) => u.id),
        readBy: msg.readBy.map((u) => u.id),
      }));

      // Format members
      const members = conversation.members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        phone: m.user.phone,
      }));

      const otherMember =
        conversation.type === ConversationType.PRIVATE && members.length === 2
          ? members.find((m) => m.id !== userId)
          : null;

      const isArchived = conversation.archivedBy.some(
        (archive) => archive.userId === userId
      );

      res.json({
        success: true,
        conversation: {
          id: conversation.id,
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
