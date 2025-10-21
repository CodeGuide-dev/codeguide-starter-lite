import { NextRequest, NextResponse } from 'next/server';
import { templateEngine } from '@/lib/template-engine';
import { logger, ApiResponse, generateRequestId, AppError } from '@/lib/logger';

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  
  try {
    const { searchParams } = new URL(request.url);
    
    const category = searchParams.get('category') || undefined;
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);

    const templates = await templateEngine.getPopularTemplates(category, limit);

    logger.info('Popular templates fetched', { 
      category,
      limit,
      resultsCount: templates.length
    }, undefined, requestId);

    return NextResponse.json(
      ApiResponse.success({
        category,
        templates: templates.map(template => ({
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          usage_count: template.usage_count,
          created_at: template.created_at,
          sectionsCount: template.schema.sections.length,
          estimatedTime: template.schema.metadata?.estimatedTime,
          difficulty: template.schema.metadata?.difficulty,
          tags: template.schema.metadata?.tags || [],
          preview: {
            sections: template.schema.sections.slice(0, 3).map(section => ({
              title: section.title,
              description: section.description,
              required: section.required,
            }))
          }
        }))
      })
    );

  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        ApiResponse.error(error.message, error.statusCode),
        { status: error.statusCode }
      );
    }

    logger.error('Unexpected error in GET /api/templates/popular', { error }, undefined, requestId);

    return NextResponse.json(
      ApiResponse.error('Internal server error', 500),
      { status: 500 }
    );
  }
}