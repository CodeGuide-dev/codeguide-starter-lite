import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProjects, createProject, getTemplate } from '@/lib/database';
import { checkRateLimit, getUserRateLimitKey } from '@/lib/rate-limit';
import { CreateProjectSchema, getDefaultProjectContent } from '@/lib/template-validation';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(getUserRateLimitKey(userId), 'api');
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimitResult.remainingPoints?.toString() || '0',
            'X-RateLimit-Reset': new Date(Date.now() + (rateLimitResult.msBeforeNext || 0)).toISOString(),
          }
        }
      );
    }

    const projects = await getProjects(userId);
    
    return NextResponse.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = await checkRateLimit(getUserRateLimitKey(userId), 'api');
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimitResult.remainingPoints?.toString() || '0',
            'X-RateLimit-Reset': new Date(Date.now() + (rateLimitResult.msBeforeNext || 0)).toISOString(),
          }
        }
      );
    }

    const body = await request.json();

    // Validate input
    const validation = CreateProjectSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { title, description, template_id, content, settings } = validation.data;

    // If template_id is provided, get the template and use its default content
    let projectContent = content;
    if (template_id) {
      try {
        const template = await getTemplate(template_id);
        if (template) {
          // If no content provided, use template defaults
          if (!content || Object.keys(content.sections || {}).length === 0) {
            projectContent = getDefaultProjectContent(template);
          }
        }
      } catch (error) {
        // Template not found or not accessible, continue with provided content
        console.warn('Template not found or not accessible:', template_id);
      }
    }

    const project = await createProject({
      title,
      description: description || null,
      template_id: template_id || null,
      content: projectContent,
      settings: settings,
      status: 'draft',
      user_id: userId,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}