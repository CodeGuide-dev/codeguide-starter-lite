import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { templateEngine } from '@/lib/template-engine';
import { logger, ApiResponse, generateRequestId, AppError } from '@/lib/logger';

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId();
  
  try {
    const { userId } = await auth();
    const templateId = params.id;

    const preview = await templateEngine.previewTemplate(templateId, userId || undefined);

    logger.info('Template preview generated successfully', { 
      templateId,
      userId: userId || 'anonymous',
      estimatedFields: preview.estimatedFields,
      complexity: preview.complexity
    }, userId || undefined, requestId);

    return NextResponse.json(
      ApiResponse.success({
        ...preview,
        sections: preview.template.schema.sections.map(section => ({
          id: section.id,
          title: section.title,
          description: section.description,
          required: section.required,
          type: section.type,
          subsections: section.subsections?.map((sub: any) => ({
            id: sub.id,
            title: sub.title,
            description: sub.description,
            required: sub.required,
            type: sub.type,
          })) || []
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

    logger.error('Unexpected error in GET /api/templates/[id]/preview', { 
      error,
      templateId: params.id
    }, undefined, requestId);

    return NextResponse.json(
      ApiResponse.error('Internal server error', 500),
      { status: 500 }
    );
  }
}