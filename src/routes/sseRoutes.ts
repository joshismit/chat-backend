import { Router, Request, Response } from 'express';
import { sseManager } from '../sse';
import { verifyToken } from '../utils/jwt';
import { messageSyncService } from '../services/messageSyncService';

const router = Router();

/**
 * GET /sse/connect
 * Connect to SSE stream with optional JWT authentication
 * Supports:
 * - Query param: ?token=JWT_TOKEN
 * - Header: Authorization: Bearer JWT_TOKEN
 * - Header: X-Auth-Token: JWT_TOKEN
 * - Reconnection: Last-Event-ID header
 */
router.get('/connect', async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract token from query param, Authorization header, or X-Auth-Token header
    let token: string | undefined;
    
    if (req.query.token) {
      token = req.query.token as string;
    } else if (req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      } else {
        token = authHeader;
      }
    } else if (req.headers['x-auth-token']) {
      token = req.headers['x-auth-token'] as string;
    }

    // Extract last-event-id for reconnection
    const lastEventId = req.headers['last-event-id'] as string | undefined;

    let userId: string | undefined;
    let conversationIds: string[] = [];

    // Validate token if provided
    if (token) {
      try {
        const payload = verifyToken(token);
        userId = payload.userId;

        // Optionally load user's conversations for auto-subscription
        // This can be enhanced to load active conversations
        // For now, we'll let clients subscribe manually
      } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }
    }

    // Detect device type from user agent or query param
    const userAgent = req.headers['user-agent'] || '';
    const deviceType = req.query.deviceType as string || (userAgent.includes('Desktop') || userAgent.includes('Web') ? 'desktop' : 'mobile');
    const isDesktop = deviceType === 'desktop';

    // Register client
    const clientId = sseManager.registerClient(userId, res, {
      userId,
      conversationIds,
      lastEventId,
    });

    // If desktop session, send initial message sync (WhatsApp-like)
    if (isDesktop && userId) {
      console.log(`Desktop session detected for user ${userId}, loading recent messages...`);
      
      // Load recent messages asynchronously and send via SSE
      messageSyncService.getRecentMessagesForUser(userId, 50, 7)
        .then((conversationSyncs) => {
          // Send initial sync event
          sseManager.sendEventToClient(clientId, {
            event: 'sync:initial',
            data: {
              type: 'initial_sync',
              conversations: conversationSyncs,
              timestamp: new Date().toISOString(),
            },
          });

          // Send individual message events for each conversation
          conversationSyncs.forEach((sync) => {
            sync.messages.forEach((message) => {
              sseManager.sendEventToClient(clientId, {
                event: 'message:sync',
                data: {
                  type: 'message_sync',
                  message,
                  conversationId: sync.conversationId,
                },
              });
            });
          });

          console.log(`Sent ${conversationSyncs.length} conversation syncs to desktop client ${clientId}`);
        })
        .catch((error) => {
          console.error('Error loading recent messages for desktop sync:', error);
          // Send error event but don't fail the connection
          sseManager.sendEventToClient(clientId, {
            event: 'sync:error',
            data: {
              type: 'sync_error',
              error: 'Failed to load recent messages',
            },
          });
        });
    }

    // Handle client disconnect
    req.on('close', () => {
      sseManager.removeClient(clientId);
    });

    req.on('aborted', () => {
      sseManager.removeClient(clientId);
    });

    // Keep connection alive with periodic ping
    const pingInterval = setInterval(() => {
      try {
        if (!res.destroyed) {
          res.write(': ping\n\n');
        } else {
          clearInterval(pingInterval);
          sseManager.removeClient(clientId);
        }
      } catch (error) {
        clearInterval(pingInterval);
        sseManager.removeClient(clientId);
      }
    }, 30000); // Ping every 30 seconds

    // Cleanup on disconnect
    req.on('close', () => {
      clearInterval(pingInterval);
    });
  } catch (error) {
    console.error('Error setting up SSE connection:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to establish SSE connection' });
    }
  }
});

export default router;

