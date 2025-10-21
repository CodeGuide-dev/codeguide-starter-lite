import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { templateEngine } from '@/lib/template-engine';
import { logger, ApiResponse, generateRequestId, AppError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  
  try {
    const { userId } = await auth();
    const { searchParams } = new URL(request.url);
    
    const query = searchParams.get('q');
    const category = searchParams.get('category') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    if (!query) {
      return NextResponse.json(
        ApiResponse.error('Search query is required', 400),
        { status: 400 }
      );
    }

    if (query.length < 2) {
      return NextResponse.json(
        ApiResponse.error('Search query must be at least 2 characters', 400),
        { status: 400 }
      );
    }

    const templates = await templateEngine.searchTemplates(
      query,
      category,
      userId || undefined,
      limit
    );

    logger.info('Template search completed', { 
      query,
      category,
      userId: userId || 'anonymous',
      resultsCount: templates.length
    }, userId || undefined, requestId);

    return NextResponse.json(
      ApiResponse.success({
        query,
        category,
        results: templates.map(template => ({
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          usage_count: template.usage_count,
          is_public: template.is_public,
          created_at: template.created_at,
          sectionsCount: template.schema.sections.length,
          estimatedTime: template.schema.metadata?.estimatedTime,
          difficulty: template.schema.metadata?.difficulty,
          tags: template.schema.metadata?.tags || [],
        })),
        totalResults: templates.length
      })
    );

  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        ApiResponse.error(error.message, error.statusCode),
        { status: error.statusCode }
      );
    }

    logger.error('Unexpected error in GET /api/templates/search', { error }, undefined, requestId);

    return NextResponse.json(
      ApiResponse.error('Internal server error', 500),
      { status: 500 }
    );
  }
}