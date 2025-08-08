import { Template, Project } from './database';
import { 
  TemplateCategories, 
  validateTemplateStructure, 
  validateProjectContent,
  getDefaultProjectContent 
} from './template-validation';

export class TemplateService {
  /**
   * Clone a template for a user to customize
   */
  static async cloneTemplate(originalTemplate: Template, userId: string, newName?: string): Promise<Omit<Template, 'id' | 'created_at' | 'updated_at'>> {
    return {
      name: newName || `${originalTemplate.name} (Copy)`,
      description: originalTemplate.description,
      category: originalTemplate.category,
      structure: JSON.parse(JSON.stringify(originalTemplate.structure)), // Deep clone
      default_sections: JSON.parse(JSON.stringify(originalTemplate.default_sections)), // Deep clone
      is_system: false,
      is_public: false,
      created_by: userId,
    };
  }

  /**
   * Get template recommendations based on user's usage patterns
   */
  static getRecommendedTemplates(userProjects: Project[], availableTemplates: Template[]): Template[] {
    // Simple recommendation algorithm
    const userCategories = userProjects.map(p => p.template?.category).filter(Boolean);
    const categoryFrequency = userCategories.reduce((acc, category) => {
      acc[category!] = (acc[category!] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Sort templates by relevance to user's preferred categories
    return availableTemplates.sort((a, b) => {
      const aScore = categoryFrequency[a.category] || 0;
      const bScore = categoryFrequency[b.category] || 0;
      
      if (aScore !== bScore) {
        return bScore - aScore; // Higher frequency first
      }
      
      // If same frequency, prioritize system templates, then public, then by name
      if (a.is_system !== b.is_system) {
        return a.is_system ? -1 : 1;
      }
      
      if (a.is_public !== b.is_public) {
        return a.is_public ? -1 : 1;
      }
      
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * Validate template compatibility with existing project content
   */
  static validateTemplateCompatibility(template: Template, existingContent: any): {
    compatible: boolean;
    issues: string[];
    suggestions: string[];
  } {
    const issues: string[] = [];
    const suggestions: string[] = [];

    if (!existingContent?.sections) {
      return { compatible: true, issues, suggestions };
    }

    const templateSectionIds = template.default_sections.map(s => s.id);
    const existingSectionIds = Object.keys(existingContent.sections);

    // Check for missing template sections
    const missingSections = templateSectionIds.filter(id => !existingSectionIds.includes(id));
    if (missingSections.length > 0) {
      suggestions.push(`Consider adding content for sections: ${missingSections.join(', ')}`);
    }

    // Check for extra sections not in template
    const extraSections = existingSectionIds.filter(id => !templateSectionIds.includes(id));
    if (extraSections.length > 0) {
      issues.push(`Existing sections not in template: ${extraSections.join(', ')}`);
    }

    // Validate content against template requirements
    const contentValidation = validateProjectContent(existingContent, template);
    if (!contentValidation.valid) {
      issues.push(...contentValidation.errors);
    }
    if (contentValidation.warnings.length > 0) {
      suggestions.push(...contentValidation.warnings);
    }

    return {
      compatible: issues.length === 0,
      issues,
      suggestions,
    };
  }

  /**
   * Generate template from existing project content
   */
  static generateTemplateFromProject(project: Project, templateName: string): Omit<Template, 'id' | 'created_at' | 'updated_at'> {
    const sections = project.content?.sections || {};
    
    // Create default sections based on project content
    const defaultSections = Object.entries(sections).map(([id, content], index) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1).replace(/([A-Z])/g, ' $1'),
      type: inferSectionType(content),
      required: false,
      placeholder: `Enter ${id} content here`,
      description: `Content for ${id} section`,
      defaultValue: '',
    }));

    // Create structure
    const structure = {
      sections: Object.keys(sections),
      customizable: true,
      layout: 'linear' as const,
      settings: {
        allowReordering: true,
        allowAddingSections: true,
        allowRemovingSections: false,
      },
    };

    return {
      name: templateName,
      description: `Template generated from project: ${project.title}`,
      category: 'general',
      structure,
      default_sections: defaultSections,
      is_system: false,
      is_public: false,
      created_by: project.user_id,
    };
  }

  /**
   * Merge template updates while preserving user customizations
   */
  static mergeTemplateUpdates(
    originalTemplate: Template, 
    updatedTemplate: Template, 
    userCustomizations: any
  ): Template {
    // This is a complex operation that would need careful implementation
    // For now, return a simple merge
    return {
      ...originalTemplate,
      ...updatedTemplate,
      // Preserve critical user data
      created_by: originalTemplate.created_by,
      created_at: originalTemplate.created_at,
    };
  }

  /**
   * Get template usage statistics
   */
  static async getTemplateStats(templateId: string, projects: Project[]): Promise<{
    usageCount: number;
    lastUsed?: Date;
    averageProjectSize: number;
    popularSections: string[];
  }> {
    const templatedProjects = projects.filter(p => p.template_id === templateId);
    
    const usageCount = templatedProjects.length;
    const lastUsed = templatedProjects.length > 0 
      ? new Date(Math.max(...templatedProjects.map(p => new Date(p.created_at).getTime())))
      : undefined;

    // Calculate average project size (number of sections with content)
    const projectSizes = templatedProjects.map(p => {
      const sections = p.content?.sections || {};
      return Object.keys(sections).filter(key => sections[key] && sections[key] !== '').length;
    });
    const averageProjectSize = projectSizes.length > 0 
      ? Math.round(projectSizes.reduce((sum, size) => sum + size, 0) / projectSizes.length)
      : 0;

    // Find most commonly used sections
    const sectionUsage = templatedProjects.reduce((acc, project) => {
      const sections = project.content?.sections || {};
      Object.keys(sections).forEach(sectionId => {
        if (sections[sectionId] && sections[sectionId] !== '') {
          acc[sectionId] = (acc[sectionId] || 0) + 1;
        }
      });
      return acc;
    }, {} as Record<string, number>);

    const popularSections = Object.entries(sectionUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([sectionId]) => sectionId);

    return {
      usageCount,
      lastUsed,
      averageProjectSize,
      popularSections,
    };
  }
}

/**
 * Infer section type from content
 */
function inferSectionType(content: any): 'text' | 'textarea' | 'richtext' | 'list' | 'image' | 'file' {
  if (Array.isArray(content)) {
    return 'list';
  }
  
  if (typeof content === 'string') {
    if (content.includes('<') && content.includes('>')) {
      return 'richtext';
    }
    if (content.length > 100 || content.includes('\n')) {
      return 'textarea';
    }
    return 'text';
  }
  
  if (content && typeof content === 'object' && content.url) {
    if (content.type?.startsWith('image/')) {
      return 'image';
    }
    return 'file';
  }
  
  return 'text';
}