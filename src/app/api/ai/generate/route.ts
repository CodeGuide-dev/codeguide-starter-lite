import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { openai } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { z } from 'zod';
import { checkRateLimit, getUserRateLimitKey } from '@/lib/rate-limit';
import { logAIGeneration, updateAIGeneration } from '@/lib/database';

// Schema for AI-generated outline
const OutlineSchema = z.object({
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      content: z.string(),
      subsections: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          content: z.string(),
        })
      ).optional(),
    })
  ),
  summary: z.string(),
  keywords: z.array(z.string()),
});

export async function POST(request: NextRequest) {
  let aiGenerationId: string | null = null;
  
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Rate limiting for AI generation (stricter limits)
    const rateLimitResult = await checkRateLimit(
      getUserRateLimitKey(userId, 'ai'), 
      'aiGeneration'
    );
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'AI generation rate limit exceeded. Please try again later.' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': rateLimitResult.remainingPoints?.toString() || '0',
            'X-RateLimit-Reset': new Date(Date.now() + (rateLimitResult.msBeforeNext || 0)).toISOString(),
          }
        }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { prompt, project_id, template_context } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Valid prompt is required' },
        { status: 400 }
      );
    }

    // Log the AI generation request
    const aiGeneration = await logAIGeneration({
      project_id: project_id || null,
      user_id: userId,
      prompt: prompt.trim(),
      model_used: 'gpt-4o',
      status: 'pending',
    });

    aiGenerationId = aiGeneration.id;

    const startTime = Date.now();

    // Create a comprehensive prompt for outline generation
    const systemPrompt = `You are an expert content strategist and outline generator. Generate a structured outline based on the user's prompt. 
    
    ${template_context ? `Context: This outline is for a ${template_context.category || 'general'} document using template "${template_context.name}".` : ''}
    
    Guidelines:
    - Create logical, well-structured sections
    - Include detailed content suggestions for each section
    - Provide actionable subsections where appropriate
    - Include relevant keywords for searchability
    - Ensure the outline flows logically from introduction to conclusion
    - Adapt the structure to match the user's specific needs and context`;

    // Generate structured outline using AI
    const result = await generateObject({
      model: openai('gpt-4o'),
      schema: OutlineSchema,
      system: systemPrompt,
      prompt: prompt.trim(),
      temperature: 0.7,
    });

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    // Update the AI generation log with results
    await updateAIGeneration(aiGenerationId, {
      response: result.object,
      processing_time_ms: processingTime,
      tokens_used: result.usage?.totalTokens || 0,
      status: 'completed',
    });

    return NextResponse.json({
      success: true,
      data: result.object,
      processing_time_ms: processingTime,
      tokens_used: result.usage?.totalTokens || 0,
    });

  } catch (error: any) {
    console.error('Error generating AI outline:', error);

    // Update AI generation log with error
    if (aiGenerationId) {
      await updateAIGeneration(aiGenerationId, {
        status: 'failed',
        error_message: error.message || 'Unknown error occurred',
      });
    }

    // Handle specific error types
    if (error.name === 'AI_APICallError' && error.status === 429) {
      return NextResponse.json(
        { error: 'OpenAI API rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }

    if (error.name === 'AI_APICallError' && error.status === 401) {
      return NextResponse.json(
        { error: 'OpenAI API authentication failed' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to generate outline. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}