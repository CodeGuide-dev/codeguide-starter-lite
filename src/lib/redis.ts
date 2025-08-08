import { Redis } from "@upstash/redis";
import { RateLimiterRedis } from "rate-limiter-flexible";

// Use Upstash Redis for serverless environments or local Redis for development
const redis = new Redis({
  url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Rate limiter configuration
export const rateLimiter = new RateLimiterRedis({
  storeClient: redis as any, // Type assertion needed for compatibility
  keyPrefix: "rl:", // Rate limiter key prefix
  points: 5, // Number of requests
  duration: 60, // Per 60 seconds
  blockDuration: 300, // Block for 5 minutes if limit exceeded
});

// API rate limiter (more restrictive)
export const apiRateLimiter = new RateLimiterRedis({
  storeClient: redis as any,
  keyPrefix: "api_rl:",
  points: 100, // Number of API requests
  duration: 3600, // Per hour
  blockDuration: 3600, // Block for 1 hour
});

// Export Redis client for other uses
export { redis };

// Session cache utilities
export class SessionCache {
  private static keyPrefix = "session:";

  static async set(sessionId: string, data: any, ttlSeconds = 3600): Promise<void> {
    await redis.set(
      `${this.keyPrefix}${sessionId}`,
      JSON.stringify(data),
      { ex: ttlSeconds }
    );
  }

  static async get<T = any>(sessionId: string): Promise<T | null> {
    const data = await redis.get(`${this.keyPrefix}${sessionId}`);
    return data ? JSON.parse(data as string) : null;
  }

  static async delete(sessionId: string): Promise<void> {
    await redis.del(`${this.keyPrefix}${sessionId}`);
  }

  static async extend(sessionId: string, ttlSeconds = 3600): Promise<void> {
    await redis.expire(`${this.keyPrefix}${sessionId}`, ttlSeconds);
  }
}

// Cache utilities for application data
export class AppCache {
  private static keyPrefix = "app:";

  static async set(key: string, data: any, ttlSeconds = 300): Promise<void> {
    await redis.set(
      `${this.keyPrefix}${key}`,
      JSON.stringify(data),
      { ex: ttlSeconds }
    );
  }

  static async get<T = any>(key: string): Promise<T | null> {
    const data = await redis.get(`${this.keyPrefix}${key}`);
    return data ? JSON.parse(data as string) : null;
  }

  static async delete(key: string): Promise<void> {
    await redis.del(`${this.keyPrefix}${key}`);
  }

  static async increment(key: string, amount = 1): Promise<number> {
    return await redis.incrby(`${this.keyPrefix}${key}`, amount);
  }
}