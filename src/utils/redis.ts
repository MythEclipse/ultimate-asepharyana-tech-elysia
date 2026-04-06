import Redis from 'ioredis';
import { systemLogger } from './logger';

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (redis) {
    return redis
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: true,
  })

  redis.on('connect', () => {
    systemLogger.info('Connected to Redis');
  });

  redis.on('error', (err) => {
    systemLogger.error('Redis error', err);
  });

  return redis
}

export async function blacklistToken(
  token: string,
  expiresIn: number,
): Promise<void> {
  const client = getRedis()
  await client.setex(`blacklist:${token}`, expiresIn, '1')
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const client = getRedis()
  const result = await client.get(`blacklist:${token}`)
  return result === '1'
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    systemLogger.info('Redis connection closed');
  }
}
