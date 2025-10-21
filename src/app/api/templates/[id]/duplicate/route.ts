import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { templateEngine } from '@/lib/template-engine';
import { logger, ApiResponse, generateRequestId, AppError } from '@/lib/logger';
import { z } from 'zod';

const DuplicateTemplateSchema = z.object({
  newName: z.string().min(1, 'Name is required').max(100, 'Name too long'),
});

interface RouteParams {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId();
  
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        ApiResponse.error('Unauthorized', 401),
        { status: 401 }
      );
    }

    const templateId = params.id;
    const body = await request.json();
    const validationResult = DuplicateTemplateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        ApiResponse.error('Validation failed', 400, validationResult.error.errors),
        { status: 400 }
      );
    }

    const { newName } = validationResult.data;
    
    const duplicatedTemplate = await templateEngine.duplicateTemplate(
      templateId,
      newName,
      userId
    );

    logger.info('Template duplicated successfully', { 
      originalTemplateId: templateId,
      newTemplateId: duplicatedTemplate.id,
      newName,
      userId
    }, userId, requestId);

    return NextResponse.json(
      ApiResponse.success(duplicatedTemplate, 'Template duplicated successfully', 201),
      { status: 201 }
    );

  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        ApiResponse.error(error.message, error.statusCode),
        { status: error.statusCode }
      );
    }

    logger.error('Unexpected error in POST /api/templates/[id]/duplicate', { 
      error,
      templateId: params.id
    }, undefined, requestId);

    return NextResponse.json(
      ApiResponse.error('Internal server error', 500),
      { status: 500 }
    );
  }
}