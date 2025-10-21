import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { logger, ApiResponse, generateRequestId } from '@/lib/logger';
import { z } from 'zod';

const CreateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().optional(),
  templateId: z.string().uuid().optional(),
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
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const status = searchParams.get('status');
    const offset = (page - 1) * limit;

    const supabase = await createSupabaseServerClient();
    
    let query = supabase
      .from('projects')
      .select(`
        id,
        title,
        description,
        status,
        is_public,
        created_at,
        updated_at,
        templates(id, name, category)
      `)
      .or(`user_id.eq.${userId},collaborators.cs.{${userId}}`);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: projects, error, count } = await query
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to fetch projects', { error, userId }, userId, requestId);
      return NextResponse.json(
        ApiResponse.error('Failed to fetch projects', 500),
        { status: 500 }
      );
    }

    logger.info('Projects fetched successfully', { 
      userId, 
      count: projects?.length || 0,
      page,
      limit 
    }, userId, requestId);

    return NextResponse.json(
      ApiResponse.success({
        projects: projects || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      })
    );

  } catch (error) {
    logger.error('Unexpected error in GET /api/projects', { error }, undefined, requestId);
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
    const validationResult = CreateProjectSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        ApiResponse.error('Validation failed', 400, validationResult.error.errors),
        { status: 400 }
      );
    }

    const { title, description, templateId, isPublic } = validationResult.data;

    const supabase = await createSupabaseServerClient();

    // Verify template exists if provided
    if (templateId) {
      const { data: template, error: templateError } = await supabase
        .from('templates')
        .select('id')
        .eq('id', templateId)
        .single();

      if (templateError || !template) {
        return NextResponse.json(
          ApiResponse.error('Template not found', 404),
          { status: 404 }
        );
      }
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        title,
        description,
        template_id: templateId,
        user_id: userId,
        is_public: isPublic,
        status: 'draft',
        content: {},
      })
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to create project', { error, userId, title }, userId, requestId);
      return NextResponse.json(
        ApiResponse.error('Failed to create project', 500),
        { status: 500 }
      );
    }

    logger.info('Project created successfully', { 
      userId, 
      projectId: project.id,
      title,
      templateId 
    }, userId, requestId);

    return NextResponse.json(
      ApiResponse.success(project, 'Project created successfully', 201),
      { status: 201 }
    );

  } catch (error) {
    logger.error('Unexpected error in POST /api/projects', { error }, undefined, requestId);
    return NextResponse.json(
      ApiResponse.error('Internal server error', 500),
      { status: 500 }
    );
  }
}