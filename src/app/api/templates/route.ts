import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { templateEngine, TemplateSchema } from '@/lib/template-engine';
import { logger, ApiResponse, generateRequestId, AppError } from '@/lib/logger';
import { z } from 'zod';

const CreateTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  description: z.string().optional(),
  category: z.enum(['business', 'technical', 'academic', 'personal', 'custom']),
  schema: z.object({}).passthrough(), // Will be validated by templateEngine
  isPublic: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  const requestId = generateRequestId();
  
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        ApiResponse.error('Unauthorized', 401),
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const includePublic = searchParams.get('public') !== 'false';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = (page - 1) * limit;

    const supabase = await createSupabaseServerClient();
    
    let query = supabase
      .from('templates')
      .select(`
        id,
        name,
        description,
        category,
        schema,
        sections,
        is_public,
        usage_count,
        created_at,
        user_id
      `);

    // Build the filter condition
    let filter = `user_id.eq.${userId}`;
    if (includePublic) {
      filter += `,is_public.eq.true`;
    }
    
    query = query.or(filter);

    if (category) {
      query = query.eq('category', category);
    }

    const { data: templates, error, count } = await query
      .order('usage_count', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to fetch templates', { error, userId }, userId, requestId);
      return NextResponse.json(
        ApiResponse.error('Failed to fetch templates', 500),
        { status: 500 }
      );
    }

    logger.info('Templates fetched successfully', { 
      userId, 
      count: templates?.length || 0,
      category,
      includePublic
    }, userId, requestId);

    return NextResponse.json(
      ApiResponse.success({
        templates: templates || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      })
    );

  } catch (error) {
    logger.error('Unexpected error in GET /api/templates', { error }, undefined, requestId);
    return NextResponse.json(
      ApiResponse.error('Internal server error', 500),
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        ApiResponse.error('Unauthorized', 401),
        { status: 401 }
      );
    }

    const body = await request.json();
    const validationResult = CreateTemplateSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        ApiResponse.error('Validation failed', 400, validationResult.error.errors),
        { status: 400 }
      );
    }

    const { name, description, category, schema, isPublic } = validationResult.data;

    const template = await templateEngine.createTemplate(
      name,
      description,
      category,
      schema as TemplateSchema,
      userId,
      isPublic
    );

    logger.info('Template created successfully via engine', { 
      userId, 
      templateId: template.id,
      name,
      category,
      sectionsCount: template.schema.sections.length
    }, userId, requestId);

    return NextResponse.json(
      ApiResponse.success(template, 'Template created successfully', 201),
      { status: 201 }
    );

  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        ApiResponse.error(error.message, error.statusCode),
        { status: error.statusCode }
      );
    }

    logger.error('Unexpected error in POST /api/templates', { error }, undefined, requestId);
    return NextResponse.json(
      ApiResponse.error('Internal server error', 500),
      { status: 500 }
    );
  }
}