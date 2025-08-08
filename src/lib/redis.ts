import Redis from 'ioredis';

let redis: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    
    redis = new Redis(redisUrl, {
      // Connection options
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // Connection timeout
      connectTimeout: 5000,
      // Command timeout
      commandTimeout: 2000,
    });

    redis.on('error', (error) => {
      console.error('Redis connection error:', error);
    });

    redis.on('connect', () => {
      console.log('Connected to Redis');
    });

    redis.on('ready', () => {
      console.log('Redis client ready');
    });

    redis.on('close', () => {
      console.log('Redis connection closed');
    });
  }

  return redis;
}

export async function setSession(sessionId: string, data: any, ttlSeconds = 86400) {
  try {
    const client = getRedisClient();
    await client.setex(sessionId, ttlSeconds, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Failed to set session:', error);
    return false;
  }
}

export async function getSession(sessionId: string) {
  try {
    const client = getRedisClient();
    const data = await client.get(sessionId);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

export async function deleteSession(sessionId: string) {
  try {
    const client = getRedisClient();
    await client.del(sessionId);
    return true;
  } catch (error) {
    console.error('Failed to delete session:', error);
    return false;
  }
}

export async function cacheGet(key: string) {
  try {
    const client = getRedisClient();
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get cached data:', error);
    return null;
  }
}

export async function cacheSet(key: string, data: any, ttlSeconds = 3600) {
  try {
    const client = getRedisClient();
    await client.setex(key, ttlSeconds, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('Failed to cache data:', error);
    return false;
  }
}

export async function closeRedisConnection() {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}