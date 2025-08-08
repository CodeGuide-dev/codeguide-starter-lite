import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getTemplate, updateTemplate, deleteTemplate, canAccessTemplate } from '@/lib/database';
import { checkRateLimit, getUserRateLimitKey } from '@/lib/rate-limit';
import { UpdateTemplateSchema, validateTemplateStructure } from '@/lib/template-validation';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    const { id } = params;

    // Rate limiting
    if (userId) {
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
    }

    const template = await getTemplate(id);
    
    // Check if user can access this template
    if (!template.is_public && !template.is_system && template.created_by !== userId) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error fetching template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    // Check if template exists and user can modify it
    const existingTemplate = await getTemplate(id);
    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Only allow template owner to update (not system templates)
    if (existingTemplate.is_system || existingTemplate.created_by !== userId) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate input
    const validation = UpdateTemplateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Validate template structure if provided
    if (updates.structure && updates.default_sections) {
      const structureValidation = validateTemplateStructure(updates.structure, updates.default_sections);
      if (!structureValidation.valid) {
        return NextResponse.json(
          { error: 'Invalid template structure', details: structureValidation.errors },
          { status: 400 }
        );
      }
    }

    const updatedTemplate = await updateTemplate(id, updates);

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating template:', error);
    return NextResponse.json(
      { error: 'Failed to update template' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
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

    // Check if template exists and user can delete it
    const template = await getTemplate(id);
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Only allow template owner to delete (not system templates)
    if (template.is_system || template.created_by !== userId) {
      return NextResponse.json(
        { error: 'Permission denied' },
        { status: 403 }
      );
    }

    await deleteTemplate(id);

    return NextResponse.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}