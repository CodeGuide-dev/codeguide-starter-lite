import { NextRequest, NextResponse } from "next/server";
import { rateLimiter, apiRateLimiter } from "./redis";

export async function rateLimit(
  req: NextRequest,
  identifier?: string,
  isApiRoute = false
) {
  // Use provided identifier or fall back to IP
  const key = identifier || getClientIP(req);
  const limiter = isApiRoute ? apiRateLimiter : rateLimiter;

  try {
    await limiter.consume(key);
    return null; // No rate limit hit
  } catch (rejRes: any) {
    // Rate limit exceeded
    const remainingPoints = rejRes?.remainingPoints || 0;
    const msBeforeNext = rejRes?.msBeforeNext || 0;

    const response = NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfter: Math.ceil(msBeforeNext / 1000),
      },
      { status: 429 }
    );

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", limiter.points.toString());
    response.headers.set("X-RateLimit-Remaining", remainingPoints.toString());
    response.headers.set(
      "X-RateLimit-Reset",
      new Date(Date.now() + msBeforeNext).toISOString()
    );
    response.headers.set("Retry-After", Math.ceil(msBeforeNext / 1000).toString());

    return response;
  }
}

// Helper function to get client IP
function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIP = req.headers.get("x-real-ip");
  const remoteAddr = req.headers.get("remote-addr");
  
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (remoteAddr) {
    return remoteAddr;
  }
  
  return "127.0.0.1";
}

// Rate limit decorator for API routes
export function withRateLimit(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  identifier?: (req: NextRequest) => string
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const key = identifier ? identifier(req) : undefined;
    const rateLimitResponse = await rateLimit(req, key, true);
    
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    
    return handler(req, ...args);
  };
}