/**
 * Example usage of SSE helpers in controllers
 * 
 * This file demonstrates how to use SSE event broadcasting
 * in your controllers for real-time updates.
 */

import { Request, Response } from 'express';
import { sendEventToUser, broadcastToConversation } from '../sse';
// import { Message } from '../models/Message';
// import { Conversation } from '../models/Conversation';

/**
 * Example: Send notification to a user
 */
export const sendUserNotification = async (req: Request, res: Response) => {
  const { userId, notification } = req.body;

  // Send event to user's connected clients
  const sentCount = sendEventToUser(userId, 'notification', {
    type: 'info',
    message: notification.message,
    timestamp: new Date().toISOString(),
  });

  res.json({
    success: true,
    sentToClients: sentCount,
  });
};

/**
 * Example: Broadcast new message to conversation
 */
export const broadcastNewMessage = async (
  conversationId: string,
  messageData: any
) => {
  // Broadcast to all conversation members
  const sentCount = await broadcastToConversation(
    conversationId,
    'message:new',
    {
      message: messageData,
    }
  );

  console.log(`Message broadcasted to ${sentCount} clients`);
  return sentCount;
};

/**
 * Example: Notify user is typing
 */
export const notifyTyping = async (
  conversationId: string,
  userId: string,
  isTyping: boolean
) => {
  await broadcastToConversation(conversationId, 'user:typing', {
    userId,
    isTyping,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Example: Notify message delivered
 */
export const notifyMessageDelivered = async (
  messageId: string,
  userId: string
) => {
  sendEventToUser(userId, 'message:delivered', {
    messageId,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Example: Notify message read
 */
export const notifyMessageRead = async (
  conversationId: string,
  userId: string,
  messageId: string
) => {
  await broadcastToConversation(conversationId, 'message:read', {
    userId,
    messageId,
    timestamp: new Date().toISOString(),
  });
};

