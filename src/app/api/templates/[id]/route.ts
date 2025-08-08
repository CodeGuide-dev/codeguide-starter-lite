import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { templateService } from '@/lib/templates';
import { rateLimiters, createRateLimitMiddleware, addRateLimitHeaders } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { UpdateTemplateSchema } from '@/types/api';

const rateLimitMiddleware = createRateLimitMiddleware(rateLimiters.api);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    
    // Rate limiting
    const rateLimitResult = await rateLimitMiddleware(request, userId || undefined);
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
      addRateLimitHeaders(response, rateLimitResult);
      return response;
    }

    const template = await templateService.getTemplate(params.id);
    
    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      );
    }

    const response = NextResponse.json({ success: true, data: template });
    addRateLimitHeaders(response, rateLimitResult);
    return response;

  } catch (error) {
    logger.error('Template GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimitMiddleware(request, userId || undefined);
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
      addRateLimitHeaders(response, rateLimitResult);
      return response;
    }

    const body = await request.json();
    
    // Validate request body
    const validationResult = UpdateTemplateSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request data',
          details: validationResult.error.format()
        },
        { status: 400 }
      );
    }

    const updateData = { ...validationResult.data, id: params.id };

    // Validate template structure if template_data is being updated
    if (updateData.template_data) {
      const templateValidation = templateService.validateTemplate(updateData);
      if (!templateValidation.isValid) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid template structure',
            details: templateValidation.errors
          },
          { status: 400 }
        );
      }
    }

    const template = await templateService.updateTemplate(userId, updateData);
    
    const response = NextResponse.json({ success: true, data: template });
    addRateLimitHeaders(response, rateLimitResult);
    return response;

  } catch (error) {
    logger.error('Template PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimitMiddleware(request, userId || undefined);
    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { success: false, error: 'Rate limit exceeded' },
        { status: 429 }
      );
      addRateLimitHeaders(response, rateLimitResult);
      return response;
    }

    await templateService.deleteTemplate(userId, params.id);
    
    const response = NextResponse.json({ success: true, message: 'Template deleted successfully' });
    addRateLimitHeaders(response, rateLimitResult);
    return response;

  } catch (error) {
    logger.error('Template DELETE error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}