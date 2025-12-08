/**
 * Redis Service for SSE Scaling
 * 
 * This service enables Server-Sent Events to work across multiple
 * Node.js instances using Redis Pub/Sub.
 * 
 * When a message is sent, it's published to Redis, and all instances
 * receive the event and broadcast to their connected clients.
 */

import Redis, { RedisOptions } from 'ioredis';

let publisher: Redis | null = null;
let subscriber: Redis | null = null;

interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  retryStrategy?: (times: number) => number | null;
}

/**
 * Initialize Redis connections
 */
export const initRedis = (config: RedisConfig = {}): void => {
  const redisOptions: RedisOptions = {
    host: config.host || process.env.REDIS_HOST || 'localhost',
    port: config.port || parseInt(process.env.REDIS_PORT || '6379'),
    password: config.password || process.env.REDIS_PASSWORD,
    retryStrategy: config.retryStrategy || ((times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    }),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
  };

  // Publisher connection (for sending events)
  if (process.env.REDIS_URL) {
    publisher = new Redis(process.env.REDIS_URL);
  } else {
    publisher = new Redis(redisOptions);
  }

  // Subscriber connection (for receiving events)
  if (process.env.REDIS_URL) {
    subscriber = new Redis(process.env.REDIS_URL);
  } else {
    subscriber = new Redis(redisOptions);
  }

  // Handle connection errors
  publisher.on('error', (err) => {
    console.error('Redis Publisher Error:', err);
  });

  subscriber.on('error', (err) => {
    console.error('Redis Subscriber Error:', err);
  });

  publisher.on('connect', () => {
    console.log('✅ Redis Publisher connected');
  });

  subscriber.on('connect', () => {
    console.log('✅ Redis Subscriber connected');
  });

  // Connect to Redis (ioredis connects automatically, but we call connect() explicitly since lazyConnect is true)
  if (publisher && typeof publisher.connect === 'function') {
    (publisher as any).connect().catch(console.error);
  }
  if (subscriber && typeof subscriber.connect === 'function') {
    (subscriber as any).connect().catch(console.error);
  }
};

/**
 * Publish an event to Redis channel
 */
export const publishEvent = async (
  channel: string,
  event: string,
  data: any
): Promise<number> => {
  if (!publisher) {
    console.warn('Redis publisher not initialized');
    return 0;
  }

  try {
    const message = JSON.stringify({ event, data, timestamp: Date.now() });
    const subscribers = await publisher.publish(channel, message);
    return subscribers;
  } catch (error) {
    console.error('Error publishing to Redis:', error);
    return 0;
  }
};

/**
 * Subscribe to a Redis channel
 */
export const subscribeToChannel = (
  channel: string,
  callback: (event: string, data: any) => void
): (() => void) => {
  if (!subscriber) {
    console.warn('Redis subscriber not initialized');
    return () => {};
  }

  subscriber.subscribe(channel, (err) => {
    if (err) {
      console.error(`Error subscribing to channel ${channel}:`, err);
    } else {
      console.log(`✅ Subscribed to Redis channel: ${channel}`);
    }
  });

  subscriber.on('message', (ch, message) => {
    if (ch === channel) {
      try {
        const parsed = JSON.parse(message);
        callback(parsed.event, parsed.data);
      } catch (error) {
        console.error('Error parsing Redis message:', error);
      }
    }
  });

  // Return unsubscribe function
  return () => {
    subscriber?.unsubscribe(channel);
  };
};

/**
 * Publish SSE event to user channel
 */
export const publishUserEvent = async (
  userId: string,
  eventName: string,
  payload: any
): Promise<number> => {
  return publishEvent(`sse:user:${userId}`, eventName, payload);
};

/**
 * Publish SSE event to conversation channel
 */
export const publishConversationEvent = async (
  conversationId: string,
  eventName: string,
  payload: any
): Promise<number> => {
  return publishEvent(`sse:conversation:${conversationId}`, eventName, payload);
};

/**
 * Subscribe to user events
 */
export const subscribeToUserEvents = (
  userId: string,
  callback: (event: string, data: any) => void
): (() => void) => {
  return subscribeToChannel(`sse:user:${userId}`, callback);
};

/**
 * Subscribe to conversation events
 */
export const subscribeToConversationEvents = (
  conversationId: string,
  callback: (event: string, data: any) => void
): (() => void) => {
  return subscribeToChannel(`sse:conversation:${conversationId}`, callback);
};

/**
 * Close Redis connections
 */
export const closeRedis = async (): Promise<void> => {
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
  console.log('Redis connections closed');
};

/**
 * Check if Redis is connected
 */
export const isRedisConnected = (): boolean => {
  return publisher?.status === 'ready' && subscriber?.status === 'ready';
};

export default {
  initRedis,
  publishEvent,
  subscribeToChannel,
  publishUserEvent,
  publishConversationEvent,
  subscribeToUserEvents,
  subscribeToConversationEvents,
  closeRedis,
  isRedisConnected,
};

