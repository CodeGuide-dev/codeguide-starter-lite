import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getTemplates, createTemplate } from '@/lib/database';
import { checkRateLimit, getUserRateLimitKey } from '@/lib/rate-limit';
import { CreateTemplateSchema, validateTemplateStructure } from '@/lib/template-validation';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
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

    const templates = await getTemplates(userId || undefined);
    
    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
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

    // Validate input using schema
    const validation = CreateTemplateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { name, description, category, structure, default_sections, is_public } = validation.data;

    // Validate template structure
    const structureValidation = validateTemplateStructure(structure, default_sections);
    if (!structureValidation.valid) {
      return NextResponse.json(
        { error: 'Invalid template structure', details: structureValidation.errors },
        { status: 400 }
      );
    }

    const template = await createTemplate({
      name,
      description: description || null,
      category,
      structure,
      default_sections,
      is_system: false,
      is_public: is_public || false,
      created_by: userId,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}