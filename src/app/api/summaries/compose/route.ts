import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { summaryComposer, SummaryCompositionRequest } from '@/lib/summary-composer';
import { logger, ApiResponse, generateRequestId, AppError } from '@/lib/logger';
import { z } from 'zod';

const ComposeSummarySchema = z.object({
  content: z.string().min(50, 'Content must be at least 50 characters').max(10000, 'Content too long'),
  type: z.enum(['executive', 'technical', 'abstract', 'overview']),
  targetLength: z.enum(['brief', 'medium', 'detailed']),
  audience: z.enum(['executive', 'technical', 'general', 'academic']),
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
    const validationResult = ComposeSummarySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        ApiResponse.error('Validation failed', 400, validationResult.error.errors),
        { status: 400 }
      );
    }

    const { content, type, targetLength, audience } = validationResult.data;

    const summaryRequest: SummaryCompositionRequest = {
      content,
      type,
      targetLength,
      audience,
      userId,
      requestId,
    };

    const startTime = Date.now();
    const result = await summaryComposer.composeSummary(summaryRequest);
    const endTime = Date.now();

    logger.info('Summary composed successfully', {
      userId,
      type,
      targetLength,
      audience,
      contentLength: content.length,
      summaryWordCount: result.wordCount,
      responseTimeMs: endTime - startTime,
      tokensUsed: result.usage.totalTokens,
      cost: result.usage.cost,
    }, userId, requestId);

    return NextResponse.json(
      ApiResponse.success({
        ...result,
        generatedAt: new Date().toISOString(),
        responseTimeMs: endTime - startTime,
      }, 'Summary composed successfully')
    );

  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        ApiResponse.error(error.message, error.statusCode),
        { status: error.statusCode }
      );
    }

    logger.error('Unexpected error in POST /api/summaries/compose', { 
      error 
    }, undefined, requestId);

    return NextResponse.json(
      ApiResponse.error('Failed to compose summary', 500),
      { status: 500 }
    );
  }
}