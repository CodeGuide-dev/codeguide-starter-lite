import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { templateEngine, TemplateSchema } from '@/lib/template-engine';
import { logger, ApiResponse, generateRequestId, AppError } from '@/lib/logger';
import { z } from 'zod';

const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  schema: z.object({}).passthrough().optional(), // Will be validated by templateEngine
  isPublic: z.boolean().optional(),
});

const CustomizeTemplateSchema = z.object({
  sectionCustomizations: z.record(z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    placeholder: z.string().optional(),
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
  })).optional(),
});

interface RouteParams {
  params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const requestId = generateRequestId();
  
  try {
    const { userId } = await auth();
    const templateId = params.id;

    const template = await templateEngine.getTemplate(templateId, userId || undefined);

    logger.info('Template fetched successfully', { 
      templateId,
      userId: userId || 'anonymous',
      templateName: template.name
    }, userId || undefined, requestId);

    return NextResponse.json(
      ApiResponse.success(template)
    );

  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        ApiResponse.error(error.message, error.statusCode),
        { status: error.statusCode }
      );
    }

    logger.error('Unexpected error in GET /api/templates/[id]', { 
      error,
      templateId: params.id
    }, undefined, requestId);

    return NextResponse.json(
      ApiResponse.error('Internal server error', 500),
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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
    const validationResult = UpdateTemplateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        ApiResponse.error('Validation failed', 400, validationResult.error.errors),
        { status: 400 }
      );
    }

    const { name, description, schema, isPublic } = validationResult.data;
    
    const updates: Parameters<typeof templateEngine.updateTemplate>[1] = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (schema !== undefined) updates.schema = schema as TemplateSchema;
    if (isPublic !== undefined) updates.is_public = isPublic;

    const template = await templateEngine.updateTemplate(templateId, updates, userId);

    logger.info('Template updated successfully', { 
      templateId,
      userId,
      updatedFields: Object.keys(updates)
    }, userId, requestId);

    return NextResponse.json(
      ApiResponse.success(template, 'Template updated successfully')
    );

  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        ApiResponse.error(error.message, error.statusCode),
        { status: error.statusCode }
      );
    }

    logger.error('Unexpected error in PUT /api/templates/[id]', { 
      error,
      templateId: params.id
    }, undefined, requestId);

    return NextResponse.json(
      ApiResponse.error('Internal server error', 500),
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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
    const { createSupabaseServerClient } = await import('@/lib/supabase');
    const supabase = await createSupabaseServerClient();

    // Check if template is used in any projects
    const { count: projectCount, error: countError } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('template_id', templateId);

    if (countError) {
      throw new AppError('Failed to check template usage', 500);
    }

    if (projectCount && projectCount > 0) {
      return NextResponse.json(
        ApiResponse.error(`Cannot delete template. It is used in ${projectCount} project(s)`, 400),
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', templateId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to delete template', { error, templateId, userId }, userId, requestId);
      throw new AppError('Failed to delete template', 500);
    }

    logger.info('Template deleted successfully', { templateId, userId }, userId, requestId);

    return NextResponse.json(
      ApiResponse.success(null, 'Template deleted successfully')
    );

  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        ApiResponse.error(error.message, error.statusCode),
        { status: error.statusCode }
      );
    }

    logger.error('Unexpected error in DELETE /api/templates/[id]', { 
      error,
      templateId: params.id
    }, undefined, requestId);

    return NextResponse.json(
      ApiResponse.error('Internal server error', 500),
      { status: 500 }
    );
  }
}