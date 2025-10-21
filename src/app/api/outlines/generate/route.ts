import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { outlineGenerator, OutlineGenerationRequest } from '@/lib/openai';
import { logger, ApiResponse, generateRequestId, AppError } from '@/lib/logger';
import { z } from 'zod';

const GenerateOutlineSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters').max(1000, 'Prompt too long'),
  templateId: z.string().uuid().optional(),
  customSections: z.array(z.string()).optional(),
  projectId: z.string().uuid().optional(),
});

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
    const validationResult = GenerateOutlineSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        ApiResponse.error('Validation failed', 400, validationResult.error.errors),
        { status: 400 }
      );
    }

    const { prompt, templateId, customSections, projectId } = validationResult.data;

    const generationRequest: OutlineGenerationRequest = {
      prompt,
      templateId,
      customSections,
      userId,
      requestId,
    };

    const startTime = Date.now();
    const result = await outlineGenerator.generateOutline(generationRequest);
    const endTime = Date.now();

    // If projectId is provided, update the project with the generated outline
    if (projectId) {
      try {
        const { createSupabaseServerClient } = await import('@/lib/supabase');
        const supabase = await createSupabaseServerClient();
        
        const { error: updateError } = await supabase
          .from('projects')
          .update({
            content: result.outline,
            updated_at: new Date().toISOString(),
          })
          .eq('id', projectId)
          .eq('user_id', userId); // Ensure user owns the project

        if (updateError) {
          logger.warn('Failed to update project with generated outline', {
            error: updateError,
            projectId,
            userId,
          }, userId, requestId);
        }
      } catch (updateError) {
        logger.warn('Error updating project with outline', {
          error: updateError,
          projectId,
        }, userId, requestId);
      }
    }

    logger.info('Outline generated successfully', {
      userId,
      templateId,
      promptLength: prompt.length,
      tokensUsed: result.usage.totalTokens,
      cost: result.usage.cost,
      responseTimeMs: endTime - startTime,
      sectionsCount: result.outline.sections?.length || 0,
    }, userId, requestId);

    return NextResponse.json(
      ApiResponse.success({
        outline: result.outline,
        usage: result.usage,
        model: result.model,
        generatedAt: new Date().toISOString(),
      }, 'Outline generated successfully')
    );

  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        ApiResponse.error(error.message, error.statusCode),
        { status: error.statusCode }
      );
    }

    logger.error('Unexpected error in POST /api/outlines/generate', { 
      error 
    }, undefined, requestId);

    return NextResponse.json(
      ApiResponse.error('Failed to generate outline', 500),
      { status: 500 }
    );
  }
}