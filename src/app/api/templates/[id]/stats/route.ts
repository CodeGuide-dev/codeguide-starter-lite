import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getTemplate, getProjects, canAccessTemplate } from '@/lib/database';
import { checkRateLimit, getUserRateLimitKey } from '@/lib/rate-limit';
import { TemplateService } from '@/lib/template-service';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    const { id } = params;

    // Rate limiting (allow anonymous access for public templates)
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

    // Check if user can access the template
    if (!(await canAccessTemplate(id, userId))) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const template = await getTemplate(id);

    // For privacy, only show detailed stats to template owner or for public templates
    const canSeeDetailedStats = template.created_by === userId || template.is_public || template.is_system;

    if (!canSeeDetailedStats) {
      return NextResponse.json({
        template_id: id,
        template_name: template.name,
        public_stats_only: true,
        message: 'Detailed statistics are only available to template owners or for public templates',
      });
    }

    // Get all projects that use this template
    // Note: This would need optimization for large datasets
    const allProjects = userId ? await getProjects(userId) : [];
    
    // Get template statistics
    const stats = await TemplateService.getTemplateStats(id, allProjects);

    // Additional metadata
    const response = {
      template_id: id,
      template_name: template.name,
      template_category: template.category,
      is_system: template.is_system,
      is_public: template.is_public,
      created_at: template.created_at,
      ...stats,
      sections_info: {
        total_sections: template.default_sections.length,
        required_sections: template.default_sections.filter(s => s.required).length,
        section_types: template.default_sections.reduce((acc, section) => {
          acc[section.type] = (acc[section.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      },
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching template statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template statistics' },
      { status: 500 }
    );
  }
}