import { RateLimiterRedis } from 'rate-limiter-flexible';
import { getRedisClient } from './redis';

// Different rate limiters for different use cases
const rateLimiters = {
  // API rate limiter - 100 requests per 15 minutes
  api: new RateLimiterRedis({
    storeClient: getRedisClient(),
    keyPrefix: 'api_rate_limit',
    points: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000, // Convert to seconds
  }),

  // AI generation rate limiter - 10 requests per minute
  aiGeneration: new RateLimiterRedis({
    storeClient: getRedisClient(),
    keyPrefix: 'ai_rate_limit',
    points: 10,
    duration: 60,
  }),

  // Authentication rate limiter - 5 attempts per 15 minutes
  auth: new RateLimiterRedis({
    storeClient: getRedisClient(),
    keyPrefix: 'auth_rate_limit',
    points: 5,
    duration: 900,
  }),

  // File upload rate limiter - 20 uploads per hour
  fileUpload: new RateLimiterRedis({
    storeClient: getRedisClient(),
    keyPrefix: 'upload_rate_limit',
    points: 20,
    duration: 3600,
  }),
};

export type RateLimitType = keyof typeof rateLimiters;

export interface RateLimitResult {
  allowed: boolean;
  remainingPoints?: number;
  msBeforeNext?: number;
  totalHits?: number;
}

export async function checkRateLimit(
  key: string,
  type: RateLimitType = 'api'
): Promise<RateLimitResult> {
  try {
    const rateLimiter = rateLimiters[type];
    const result = await rateLimiter.consume(key);

    return {
      allowed: true,
      remainingPoints: result.remainingPoints,
      msBeforeNext: result.msBeforeNext,
      totalHits: result.totalHits,
    };
  } catch (rateLimiterRes: any) {
    // Rate limit exceeded
    return {
      allowed: false,
      remainingPoints: rateLimiterRes.remainingPoints || 0,
      msBeforeNext: rateLimiterRes.msBeforeNext || 0,
      totalHits: rateLimiterRes.totalHits || 0,
    };
  }
}

export async function getRateLimitInfo(
  key: string,
  type: RateLimitType = 'api'
): Promise<{
  remainingPoints: number;
  msBeforeNext: number;
  totalHits: number;
} | null> {
  try {
    const rateLimiter = rateLimiters[type];
    const result = await rateLimiter.get(key);
    
    if (!result) {
      return null;
    }

    return {
      remainingPoints: result.remainingPoints || 0,
      msBeforeNext: result.msBeforeNext || 0,
      totalHits: result.totalHits || 0,
    };
  } catch (error) {
    console.error('Failed to get rate limit info:', error);
    return null;
  }
}

export async function resetRateLimit(
  key: string,
  type: RateLimitType = 'api'
): Promise<boolean> {
  try {
    const rateLimiter = rateLimiters[type];
    await rateLimiter.delete(key);
    return true;
  } catch (error) {
    console.error('Failed to reset rate limit:', error);
    return false;
  }
}

// Utility function to get user key for rate limiting
export function getUserRateLimitKey(userId: string, identifier?: string): string {
  return identifier ? `user:${userId}:${identifier}` : `user:${userId}`;
}

// Utility function to get IP-based key for rate limiting
export function getIPRateLimitKey(ip: string, identifier?: string): string {
  return identifier ? `ip:${ip}:${identifier}` : `ip:${ip}`;
}