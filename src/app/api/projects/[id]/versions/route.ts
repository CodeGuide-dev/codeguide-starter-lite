import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProjectVersions, createProjectVersion, canAccessProject, getProject } from '@/lib/database';
import { checkRateLimit, getUserRateLimitKey } from '@/lib/rate-limit';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    const { id } = params;

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

    // Check access permissions
    if (!(await canAccessProject(id, userId))) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const versions = await getProjectVersions(id);
    return NextResponse.json(versions);
  } catch (error) {
    console.error('Error fetching project versions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project versions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    const { id } = params;

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

    // Check access permissions (must be able to edit)
    const project = await getProject(id);
    if (!project || project.user_id !== userId) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { change_summary } = body;

    // Get current project content and settings
    const currentProject = await getProject(id);
    
    // Get existing versions to determine next version number
    const existingVersions = await getProjectVersions(id);
    const nextVersionNumber = Math.max(...existingVersions.map(v => v.version_number), 0) + 1;

    const newVersion = await createProjectVersion({
      project_id: id,
      version_number: nextVersionNumber,
      content: currentProject.content,
      settings: currentProject.settings,
      change_summary: change_summary || `Version ${nextVersionNumber}`,
      created_by: userId,
    });

    return NextResponse.json(newVersion, { status: 201 });
  } catch (error) {
    console.error('Error creating project version:', error);
    return NextResponse.json(
      { error: 'Failed to create project version' },
      { status: 500 }
    );
  }
}