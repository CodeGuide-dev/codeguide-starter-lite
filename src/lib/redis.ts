import { Redis } from "ioredis";

// Create Redis client with connection pooling and retry logic
const createRedisClient = () => {
  const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    keepAlive: 30000,
    connectTimeout: 10000,
    commandTimeout: 5000,
    family: 4, // Use IPv4
  });

  redis.on('error', (err) => {
    console.error('Redis connection error:', err);
  });

  redis.on('connect', () => {
    console.log('Connected to Redis');
  });

  return redis;
};

export const redis = createRedisClient();

// Rate limiting utility
export class RateLimiter {
  private redis: Redis;
  
  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  async checkLimit(
    identifier: string, 
    windowMs: number, 
    maxRequests: number
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = `rate_limit:${identifier}`;
    const now = Date.now();
    const window = Math.floor(now / windowMs);
    const windowKey = `${key}:${window}`;

    try {
      const pipeline = this.redis.pipeline();
      pipeline.incr(windowKey);
      pipeline.expire(windowKey, Math.ceil(windowMs / 1000));
      
      const results = await pipeline.exec();
      const count = results?.[0]?.[1] as number || 0;
      
      const allowed = count <= maxRequests;
      const remaining = Math.max(0, maxRequests - count);
      const resetTime = (window + 1) * windowMs;
      
      return { allowed, remaining, resetTime };
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open - allow request if Redis is down
      return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
    }
  }
}

export const rateLimiter = new RateLimiter(redis);

// Session cache utilities
export class SessionCache {
  private redis: Redis;
  
  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<void> {
    try {
      await this.redis.setex(
        `session:${key}`, 
        ttlSeconds, 
        JSON.stringify(value)
      );
    } catch (error) {
      console.error('Session cache set error:', error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.redis.get(`session:${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Session cache get error:', error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(`session:${key}`);
    } catch (error) {
      console.error('Session cache delete error:', error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(`session:${key}`);
      return result === 1;
    } catch (error) {
      console.error('Session cache exists error:', error);
      return false;
    }
  }
}

export const sessionCache = new SessionCache(redis);

// API request queue for handling OpenAI API calls
export class APIRequestQueue {
  private redis: Redis;
  
  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  async enqueue(queueName: string, job: any, priority: number = 0): Promise<void> {
    try {
      const jobData = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        data: job,
        priority,
        enqueuedAt: Date.now(),
      };
      
      await this.redis.zadd(
        `queue:${queueName}`, 
        priority, 
        JSON.stringify(jobData)
      );
    } catch (error) {
      console.error('Queue enqueue error:', error);
      throw error;
    }
  }

  async dequeue(queueName: string): Promise<any | null> {
    try {
      const result = await this.redis.zpopmax(`queue:${queueName}`);
      if (result.length === 0) return null;
      
      const [jobData] = result;
      return JSON.parse(jobData);
    } catch (error) {
      console.error('Queue dequeue error:', error);
      return null;
    }
  }

  async getQueueLength(queueName: string): Promise<number> {
    try {
      return await this.redis.zcard(`queue:${queueName}`);
    } catch (error) {
      console.error('Queue length error:', error);
      return 0;
    }
  }
}

export const apiRequestQueue = new APIRequestQueue(redis);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Closing Redis connection...');
  await redis.quit();
});

process.on('SIGINT', async () => {
  console.log('Closing Redis connection...');
  await redis.quit();
});