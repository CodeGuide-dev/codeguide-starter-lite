import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { templateService } from '@/lib/templates';
import { rateLimiters, createRateLimitMiddleware, addRateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { CreateTemplateSchema, PaginationSchema } from '@/types/api';
import { z } from 'zod';

const rateLimitMiddleware = createRateLimitMiddleware(rateLimiters.api);

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    // Rate limiting
    const rateLimitResult = await rateLimitMiddleware(request, userId || undefined);
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
      addRateLimitHeaders(response, rateLimitResult);
      return response;
    }

    const { searchParams } = new URL(request.url);
    
    // Parse and validate query parameters
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
      category: searchParams.get('category')?.split(',') as any[],
      isPublic: searchParams.get('isPublic') === 'true' ? true : 
                searchParams.get('isPublic') === 'false' ? false : undefined,
      isSystem: searchParams.get('isSystem') === 'true' ? true :
                searchParams.get('isSystem') === 'false' ? false : undefined,
      tags: searchParams.get('tags')?.split(','),
      createdBy: searchParams.get('createdBy') || undefined,
      search: searchParams.get('search') || undefined,
    };

    const result = await templateService.getTemplates(filters, page, limit);
    
    const response = NextResponse.json({ success: true, ...result });
    addRateLimitHeaders(response, rateLimitResult);
    return response;

  } catch (error) {
    logger.error('Templates GET error:', error);
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
    const rateLimitResult = await rateLimitMiddleware(request, userId || undefined);
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
    const validationResult = CreateTemplateSchema.safeParse(body);
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

    const templateData = validationResult.data;

    // Validate template structure
    const templateValidation = templateService.validateTemplate(templateData);
    if (!templateValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid template structure',
          details: templateValidation.errors
        },
        { status: 400 }
      );
    }

    const template = await templateService.createTemplate(userId, templateData);
    
    const response = NextResponse.json({ success: true, data: template }, { status: 201 });
    addRateLimitHeaders(response, rateLimitResult);
    return response;

  } catch (error) {
    logger.error('Templates POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}