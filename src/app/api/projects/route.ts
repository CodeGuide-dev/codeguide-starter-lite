import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { projectService } from '@/lib/templates';
import { rateLimiters, createRateLimitMiddleware, addRateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { CreateProjectSchema, PaginationSchema } from '@/types/api';

const rateLimitMiddleware = createRateLimitMiddleware(rateLimiters.api);

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimitMiddleware(request, userId);
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
      addRateLimitHeaders(response, rateLimitResult);
      return response;
    }

    const { searchParams } = new URL(request.url);
    
    // Parse and validate pagination
    const paginationResult = PaginationSchema.safeParse({
      page: parseInt(searchParams.get('page') || '1'),
      limit: parseInt(searchParams.get('limit') || '10'),
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: searchParams.get('sortOrder') || 'desc',
    });

    if (!paginationResult.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query parameters' },
        { status: 400 }
      );
    }

    const { page, limit } = paginationResult.data;

    // Parse filters
    const filters = {
      status: searchParams.get('status')?.split(',') as any[],
      templateId: searchParams.get('templateId') || undefined,
      isPublic: searchParams.get('isPublic') === 'true' ? true : 
                searchParams.get('isPublic') === 'false' ? false : undefined,
      tags: searchParams.get('tags')?.split(','),
      sharedWith: searchParams.get('sharedWith') === 'true',
      search: searchParams.get('search') || undefined,
      dateRange: searchParams.get('from') && searchParams.get('to') ? {
        from: searchParams.get('from')!,
        to: searchParams.get('to')!,
      } : undefined,
    };

    const result = await projectService.getUserProjects(userId, filters, page, limit);
    
    const response = NextResponse.json({ success: true, ...result });
    addRateLimitHeaders(response, rateLimitResult);
    return response;

  } catch (error) {
    logger.error('Projects GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimitMiddleware(request, userId);
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
      addRateLimitHeaders(response, rateLimitResult);
      return response;
    }

    const body = await request.json();
    
    // Validate request body
    const validationResult = CreateProjectSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validationResult.error.format()
        },
        { status: 400 }
      );
    }

    const project = await projectService.createProject(userId, validationResult.data);
    
    const response = NextResponse.json({ success: true, data: project }, { status: 201 });
    addRateLimitHeaders(response, rateLimitResult);
    return response;

  } catch (error) {
    logger.error('Projects POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}