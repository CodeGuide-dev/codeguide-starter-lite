import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { templateEngine } from '@/lib/template-engine';
import { logger, ApiResponse, generateRequestId, AppError } from '@/lib/logger';
import { z } from 'zod';

const CustomizeTemplateSchema = z.object({
  sectionCustomizations: z.record(z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
    type: z.enum(['text', 'list', 'table', 'custom']).optional(),
    validation: z.object({
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      pattern: z.string().optional(),
    }).optional(),
  })).optional(),
  reorderedSections: z.array(z.string()).optional(),
  removedSections: z.array(z.string()).optional(),
  addedSections: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string().optional(),
    order: z.number(),
    required: z.boolean().default(true),
    type: z.enum(['text', 'list', 'table', 'custom']).default('text'),
    placeholder: z.string().optional(),
    validation: z.object({
      minLength: z.number().optional(),
      maxLength: z.number().optional(),
      pattern: z.string().optional(),
    }).optional(),
    subsections: z.array(z.any()).optional(),
  })).optional(),
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
    const validationResult = CustomizeTemplateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        ApiResponse.error('Validation failed', 400, validationResult.error.errors),
        { status: 400 }
      );
    }

    const customizations = validationResult.data;
    
    const customizedSchema = await templateEngine.customizeTemplate(
      templateId,
      customizations,
      userId
    );

    logger.info('Template customized successfully', { 
      templateId,
      userId,
      customizationTypes: Object.keys(customizations).filter(key => 
        customizations[key as keyof typeof customizations] !== undefined
      )
    }, userId, requestId);

    return NextResponse.json(
      ApiResponse.success({
        customizedSchema,
        preview: {
          sectionsCount: customizedSchema.sections.length,
          estimatedFields: customizedSchema.sections.reduce((total, section) => 
            total + 1 + (section.subsections?.length || 0), 0
          ),
        }
      }, 'Template customized successfully')
    );

  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        ApiResponse.error(error.message, error.statusCode),
        { status: error.statusCode }
      );
    }

    logger.error('Unexpected error in POST /api/templates/[id]/customize', { 
      error,
      templateId: params.id
    }, undefined, requestId);

    return NextResponse.json(
      ApiResponse.error('Internal server error', 500),
      { status: 500 }
    );
  }
}