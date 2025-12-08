import { Request, Response } from 'express';
import { verifyToken, JWTPayload } from '../utils/jwt';
import { Conversation } from '../models/Conversation';
import mongoose from 'mongoose';

export interface SSEEvent {
  id?: string; // Event ID for reconnection
  event?: string; // Event name/type
  data: any; // Event payload
  retry?: number; // Reconnection delay in ms
}

export interface SSEClientOptions {
  userId?: string;
  conversationIds?: string[];
  lastEventId?: string;
}

interface SSEClient {
  id: string;
  userId?: string;
  response: Response;
  conversationIds: Set<string>;
  lastEventId: number;
  connectedAt: Date;
}

class SSEManager {
  // Map: clientId -> SSEClient
  private clients: Map<string, SSEClient> = new Map();
  
  // Map: userId -> Set<clientId>
  private userClients: Map<string, Set<string>> = new Map();
  
  // Map: conversationId -> Set<clientId>
  private conversationClients: Map<string, Set<string>> = new Map();
  
  private eventCounter: number = 0;

  /**
   * Register a new SSE client
   */
  registerClient(
    userId: string | undefined,
    res: Response,
    options: SSEClientOptions = {}
  ): string {
    const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const conversationIds = options.conversationIds || [];

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control, Last-Event-ID');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Create client
    const client: SSEClient = {
      id: clientId,
      userId,
      response: res,
      conversationIds: new Set(conversationIds),
      lastEventId: options.lastEventId ? parseInt(options.lastEventId) : 0,
      connectedAt: new Date(),
    };

    // Store client
    this.clients.set(clientId, client);

    // Register by userId if provided
    if (userId) {
      if (!this.userClients.has(userId)) {
        this.userClients.set(userId, new Set());
      }
      this.userClients.get(userId)!.add(clientId);
    }

    // Register by conversation
    conversationIds.forEach((convId) => {
      if (!this.conversationClients.has(convId)) {
        this.conversationClients.set(convId, new Set());
      }
      this.conversationClients.get(convId)!.add(clientId);
    });

    // Send initial connection event
    this.sendEventToClient(clientId, {
      event: 'connected',
      data: {
        clientId,
        userId,
        timestamp: new Date().toISOString(),
      },
    });

    console.log(
      `SSE Client ${clientId} registered${userId ? ` for user ${userId}` : ''}. Total clients: ${this.clients.size}`
    );

    return clientId;
  }

  /**
   * Send event to a specific client
   */
  sendEventToClient(clientId: string, event: SSEEvent): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    try {
      // Increment event counter for ID
      this.eventCounter++;
      const eventId = this.eventCounter.toString();

      // Build SSE message
      let message = '';
      
      if (event.id || eventId) {
        message += `id: ${event.id || eventId}\n`;
      }
      
      if (event.event) {
        message += `event: ${event.event}\n`;
      }
      
      if (event.retry) {
        message += `retry: ${event.retry}\n`;
      }
      
      message += `data: ${JSON.stringify(event.data)}\n\n`;

      client.response.write(message);
      client.lastEventId = parseInt(eventId);
      return true;
    } catch (error) {
      console.error(`Error sending event to client ${clientId}:`, error);
      this.removeClient(clientId);
      return false;
    }
  }

  /**
   * Send event to a specific user (all their connected clients)
   */
  sendEventToUser(userId: string, eventName: string, payload: any): number {
    const clientIds = this.userClients.get(userId);
    if (!clientIds || clientIds.size === 0) {
      return 0;
    }

    let sentCount = 0;
    const event: SSEEvent = {
      event: eventName,
      data: payload,
    };

    clientIds.forEach((clientId) => {
      if (this.sendEventToClient(clientId, event)) {
        sentCount++;
      }
    });

    return sentCount;
  }

  /**
   * Broadcast event to all clients in a conversation
   */
  async broadcastToConversation(
    conversationId: string,
    eventName: string,
    payload: any
  ): Promise<number> {
    // Get conversation members from database
    const conversation = await Conversation.findById(conversationId).select('members');
    if (!conversation) {
      return 0;
    }

    const memberIds = conversation.members.map((id) => id.toString());
    let sentCount = 0;

    const event: SSEEvent = {
      event: eventName,
      data: payload,
    };

    // Send to all clients of conversation members
    memberIds.forEach((userId) => {
      sentCount += this.sendEventToUser(userId, eventName, payload);
    });

    return sentCount;
  }

  /**
   * Remove client and cleanup
   */
  removeClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    try {
      // Close connection
      if (!client.response.destroyed) {
        client.response.end();
      }
    } catch (error) {
      console.error(`Error closing client ${clientId}:`, error);
    }

    // Remove from userId mapping
    if (client.userId) {
      const userClients = this.userClients.get(client.userId);
      if (userClients) {
        userClients.delete(clientId);
        if (userClients.size === 0) {
          this.userClients.delete(client.userId);
        }
      }
    }

    // Remove from conversation mappings
    client.conversationIds.forEach((convId) => {
      const convClients = this.conversationClients.get(convId);
      if (convClients) {
        convClients.delete(clientId);
        if (convClients.size === 0) {
          this.conversationClients.delete(convId);
        }
      }
    });

    // Remove client
    this.clients.delete(clientId);

    console.log(`SSE Client ${clientId} removed. Total clients: ${this.clients.size}`);
    return true;
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get user's connected clients count
   */
  getUserClientCount(userId: string): number {
    return this.userClients.get(userId)?.size || 0;
  }

  /**
   * Add conversation to client's subscriptions
   */
  subscribeToConversation(clientId: string, conversationId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    client.conversationIds.add(conversationId);

    if (!this.conversationClients.has(conversationId)) {
      this.conversationClients.set(conversationId, new Set());
    }
    this.conversationClients.get(conversationId)!.add(clientId);

    return true;
  }

  /**
   * Remove conversation from client's subscriptions
   */
  unsubscribeFromConversation(clientId: string, conversationId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }

    client.conversationIds.delete(conversationId);

    const convClients = this.conversationClients.get(conversationId);
    if (convClients) {
      convClients.delete(clientId);
      if (convClients.size === 0) {
        this.conversationClients.delete(conversationId);
      }
    }

    return true;
  }
}

export const sseManager = new SSEManager();

/**
 * Helper function to send event to user (for use in controllers)
 */
export const sendEventToUser = (
  userId: string,
  eventName: string,
  payload: any
): number => {
  return sseManager.sendEventToUser(userId, eventName, payload);
};

/**
 * Helper function to broadcast to conversation (for use in controllers)
 */
export const broadcastToConversation = async (
  conversationId: string,
  eventName: string,
  payload: any
): Promise<number> => {
  return sseManager.broadcastToConversation(conversationId, eventName, payload);
};

