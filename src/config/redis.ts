import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

let redisClient: RedisClientType | null = null;
let redisUnavailable = false;

export function getRedisSocketConfig() {
  const raw = process.env.REDIS_URL || process.env.REDIS_HOST || 'localhost';

  if (raw.startsWith('redis://') || raw.startsWith('rediss://')) {
    return { url: raw };
  }

  const isTls = process.env.REDIS_TLS === 'true';
  const password = process.env.REDIS_PASSWORD ? encodeURIComponent(process.env.REDIS_PASSWORD) : undefined;
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const scheme = isTls ? 'rediss' : 'redis';
  const auth = password ? `:${password}@` : '';

  return {
    url: `${scheme}://${auth}${raw}:${port}`,
  };
}

export async function getRedisClient(): Promise<RedisClientType | null> {
  if (redisUnavailable) return null;
  if (redisClient?.isReady) return redisClient;

  try {
    redisClient = createClient(getRedisSocketConfig());

    redisClient.on('error', (err) => {
      redisUnavailable = true;
      logger.error({ err: err.message }, 'Redis error');
    });

    await redisClient.connect();
    logger.info('Redis connected');
    return redisClient;
  } catch (err: any) {
    redisUnavailable = true;
    logger.warn({ err: err?.message }, 'Redis unavailable; continuing without Redis');
    return null;
  }
}

// For BullMQ — returns config object
export function getRedisConnection() {
  const raw = process.env.REDIS_URL || process.env.REDIS_HOST || 'localhost';

  if (raw.startsWith('redis://') || raw.startsWith('rediss://')) {
    const parsed = new URL(raw);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || (parsed.protocol === 'rediss:' ? '6380' : '6379'), 10),
      username: parsed.username || undefined,
      password: parsed.password || process.env.REDIS_PASSWORD,
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
    };
  }

  const isTls = process.env.REDIS_TLS === 'true';

  return {
    host: raw,
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    tls: isTls ? {} : undefined,
    // Scale: add { enableReadyCheck: false, maxRetriesPerRequest: null } for cluster mode
  };
}

// Cache helpers — swap to ElastiCache later without touching code
export async function cacheGet(key: string): Promise<string | null> {
  const client = await getRedisClient();
  if (!client) return null;
  return client.get(key);
}

export async function cacheSet(key: string, value: string, ttlSeconds: number): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  await client.setEx(key, ttlSeconds, value);
}

export async function cacheDelete(key: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;
  await client.del(key);
}