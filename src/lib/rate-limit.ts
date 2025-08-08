import { RateLimiterRedis } from 'rate-limiter-flexible';
import { getRedisClient } from './redis';
import { logger } from './logger';

export interface RateLimitConfig {
  keyPrefix?: string;
  points: number; // Number of requests
  duration: number; // Per X seconds
  blockDuration?: number; // How long to block after limit exceeded (seconds)
}

export interface RateLimitResult {
  allowed: boolean;
  totalHits: number;
  remainingPoints: number;
  msBeforeNext: number;
  resetTime: Date;
}

export class RateLimiter {
  private limiter: RateLimiterRedis;
  public config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    
    const redis = getRedisClient();
    
    this.limiter = new RateLimiterRedis({
      storeClient: redis,
      keyPrefix: config.keyPrefix || 'rate_limit',
      points: config.points,
      duration: config.duration,
      blockDuration: config.blockDuration || config.duration,
      execEvenly: true, // Spread requests evenly across duration
    });
  }

  async checkLimit(identifier: string): Promise<RateLimitResult> {
    try {
      const result = await this.limiter.consume(identifier);
      
      return {
        allowed: true,
        totalHits: (result as any).totalHits || 1,
        remainingPoints: result.remainingPoints || 0,
        msBeforeNext: result.msBeforeNext || 0,
        resetTime: new Date(Date.now() + (result.msBeforeNext || 0)),
      };
    } catch (rejectedResult: any) {
      // Rate limit exceeded
      const result = rejectedResult;
      
      logger.warn('Rate limit exceeded', {
        identifier,
        totalHits: result.totalHits,
        remainingPoints: result.remainingPoints,
        msBeforeNext: result.msBeforeNext,
      });

      return {
        allowed: false,
        totalHits: result.totalHits || 0,
        remainingPoints: result.remainingPoints || 0,
        msBeforeNext: result.msBeforeNext || 0,
        resetTime: new Date(Date.now() + (result.msBeforeNext || 0)),
      };
    }
  }

  async getRemainingPoints(identifier: string): Promise<number> {
    try {
      const result = await this.limiter.get(identifier);
      return result?.remainingPoints || this.config.points;
    } catch (error) {
      logger.error('Error getting remaining points', { identifier, error });
      return 0;
    }
  }

  async resetLimit(identifier: string): Promise<void> {
    try {
      await this.limiter.delete(identifier);
      logger.info('Rate limit reset', { identifier });
    } catch (error) {
      logger.error('Error resetting rate limit', { identifier, error });
    }
  }

  async blockKey(identifier: string, seconds: number): Promise<void> {
    try {
      await this.limiter.block(identifier, seconds);
      logger.warn('Key blocked', { identifier, seconds });
    } catch (error) {
      logger.error('Error blocking key', { identifier, error });
    }
  }
}

// Pre-configured rate limiters for different use cases
export const rateLimiters = {
  // General API rate limiting (100 requests per minute)
  api: new RateLimiter({
    keyPrefix: 'api',
    points: 100,
    duration: 60,
    blockDuration: 60,
  }),

  // Authentication rate limiting (5 attempts per 15 minutes)
  auth: new RateLimiter({
    keyPrefix: 'auth',
    points: 5,
    duration: 900, // 15 minutes
    blockDuration: 1800, // 30 minutes
  }),

  // AI API rate limiting (20 requests per minute)
  ai: new RateLimiter({
    keyPrefix: 'ai',
    points: 20,
    duration: 60,
    blockDuration: 120,
  }),

  // File upload rate limiting (10 uploads per 5 minutes)
  upload: new RateLimiter({
    keyPrefix: 'upload',
    points: 10,
    duration: 300,
    blockDuration: 600,
  }),

  // Email sending rate limiting (5 emails per hour)
  email: new RateLimiter({
    keyPrefix: 'email',
    points: 5,
    duration: 3600,
    blockDuration: 3600,
  }),

  // Strict rate limiting for sensitive operations (3 attempts per 10 minutes)
  strict: new RateLimiter({
    keyPrefix: 'strict',
    points: 3,
    duration: 600,
    blockDuration: 1800,
  }),
};

// Middleware helper for Next.js API routes
export function createRateLimitMiddleware(limiter: RateLimiter) {
  return async (req: any, identifier?: string): Promise<RateLimitResult> => {
    // Use custom identifier or fall back to IP address
    const key = identifier || getClientIdentifier(req);
    
    const result = await limiter.checkLimit(key);
    
    if (!result.allowed) {
      logger.warn('Rate limit exceeded in middleware', {
        identifier: key,
        path: req.url,
        userAgent: req.headers['user-agent'],
      });
    }

    return result;
  };
}

// Helper to get client identifier from request
export function getClientIdentifier(req: any): string {
  // Try to get user ID first (if authenticated)
  const userId = req.auth?.userId || req.user?.id;
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.connection?.remoteAddress;
  
  return `ip:${ip || 'unknown'}`;
}

// Helper to add rate limit headers to response
export function addRateLimitHeaders(res: any, result: RateLimitResult): void {
  res.setHeader('X-RateLimit-Limit', rateLimiters.api.config.points);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remainingPoints));
  res.setHeader('X-RateLimit-Reset', result.resetTime.toISOString());
  
  if (!result.allowed) {
    res.setHeader('Retry-After', Math.round(result.msBeforeNext / 1000));
  }
}