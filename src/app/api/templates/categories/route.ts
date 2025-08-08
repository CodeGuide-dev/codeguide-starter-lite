import { NextRequest, NextResponse } from 'next/server';
import { TemplateCategories } from '@/lib/template-validation';
import { supabase } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Get template counts per category
    const { data: categoryCounts, error } = await supabase
      .from('templates')
      .select('category')
      .or('is_public.eq.true,is_system.eq.true');

    if (error) {
      console.error('Error fetching category counts:', error);
      // Return categories without counts if query fails
      const categories = TemplateCategories.map(category => ({
        id: category,
        name: category.charAt(0).toUpperCase() + category.slice(1),
        count: 0,
      }));
      
      return NextResponse.json(categories);
    }

    // Count templates per category
    const countMap = categoryCounts.reduce((acc, template) => {
      acc[template.category] = (acc[template.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Format response with counts
    const categories = TemplateCategories.map(category => ({
      id: category,
      name: category.charAt(0).toUpperCase() + category.slice(1),
      count: countMap[category] || 0,
      description: getCategoryDescription(category),
    }));

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching template categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch template categories' },
      { status: 500 }
    );
  }
}

function getCategoryDescription(category: string): string {
  const descriptions = {
    general: 'General purpose templates for various use cases',
    technical: 'Technical documentation and specifications',
    marketing: 'Marketing materials and campaign briefs',
    business: 'Business plans and proposals',
    academic: 'Academic papers and research documents',
    creative: 'Creative briefs and artistic projects',
    legal: 'Legal documents and contracts',
    personal: 'Personal projects and documentation',
  };

  return descriptions[category as keyof typeof descriptions] || 'Various templates';
}