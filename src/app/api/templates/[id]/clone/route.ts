import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getTemplate, createTemplate, canAccessTemplate } from '@/lib/database';
import { checkRateLimit, getUserRateLimitKey } from '@/lib/rate-limit';
import { TemplateService } from '@/lib/template-service';
import { z } from 'zod';

interface RouteParams {
  params: {
    id: string;
  };
}

const CloneRequestSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  make_public: z.boolean().default(false),
});

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

    // Check if user can access the original template
    if (!(await canAccessTemplate(id, userId))) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const originalTemplate = await getTemplate(id);
    
    const body = await request.json();
    const validation = CloneRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { name, make_public } = validation.data;

    // Clone the template
    const clonedTemplateData = await TemplateService.cloneTemplate(
      originalTemplate, 
      userId, 
      name
    );

    // Set public status
    clonedTemplateData.is_public = make_public;

    // Create the cloned template
    const clonedTemplate = await createTemplate(clonedTemplateData);

    return NextResponse.json({
      message: 'Template cloned successfully',
      template: clonedTemplate,
      original_template_id: id,
    }, { status: 201 });

  } catch (error) {
    console.error('Error cloning template:', error);
    return NextResponse.json(
      { error: 'Failed to clone template' },
      { status: 500 }
    );
  }
}