import { z } from 'zod';
import { createSupabaseServerClient } from './supabase';
import { logger, AppError } from './logger';

// Template schema validation
const TemplateSectionSchema: z.ZodType<any> = z.lazy(() => z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  order: z.number(),
  required: z.boolean().default(true),
  type: z.enum(['text', 'list', 'table', 'custom']).default('text'),
  placeholder: z.string().optional(),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
  subsections: z.array(TemplateSectionSchema).optional(),
}));

const TemplateSchemaValidator = z.object({
  title: z.string(),
  description: z.string().optional(),
  version: z.string().default('1.0'),
  category: z.enum(['business', 'technical', 'academic', 'personal', 'custom']),
  sections: z.array(TemplateSectionSchema),
  metadata: z.object({
    estimatedTime: z.string().optional(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    tags: z.array(z.string()).default([]),
  }).optional(),
});

export type TemplateSection = z.infer<typeof TemplateSectionSchema>;
export type TemplateSchema = z.infer<typeof TemplateSchemaValidator>;

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  schema: TemplateSchema;
  sections: {
    sections: TemplateSection[];
  };
  is_public: boolean;
  user_id: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export class TemplateEngine {
  async validateTemplate(templateData: TemplateSchema): Promise<{ isValid: boolean; errors?: string[] }> {
    try {
      TemplateSchemaValidator.parse(templateData);
      
      // Additional validation logic
      const errors: string[] = [];
      
      // Check for duplicate section IDs
      const sectionIds = new Set();
      const checkDuplicateIds = (sections: TemplateSection[]) => {
        sections.forEach(section => {
          if (sectionIds.has(section.id)) {
            errors.push(`Duplicate section ID: ${section.id}`);
          }
          sectionIds.add(section.id);
          
          if (section.subsections) {
            checkDuplicateIds(section.subsections);
          }
        });
      };
      
      checkDuplicateIds(templateData.sections);
      
      // Validate order sequences
      const orders = templateData.sections.map(s => s.order);
      const uniqueOrders = new Set(orders);
      if (orders.length !== uniqueOrders.size) {
        errors.push('Section orders must be unique');
      }
      
      if (errors.length > 0) {
        return { isValid: false, errors };
      }
      
      return { isValid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        };
      }
      throw error;
    }
  }

  async createTemplate(
    name: string,
    description: string | undefined,
    category: string,
    schema: TemplateSchema,
    userId: string,
    isPublic: boolean = false
  ): Promise<Template> {
    // Validate template structure
    const validation = await this.validateTemplate(schema);
    if (!validation.isValid) {
      throw new AppError(`Template validation failed: ${validation.errors?.join(', ')}`, 400);
    }

    const supabase = await createSupabaseServerClient();
    
    // Check for duplicate name for this user
    const { data: existing } = await supabase
      .from('templates')
      .select('id')
      .eq('name', name)
      .eq('user_id', userId)
      .single();
    
    if (existing) {
      throw new AppError('Template with this name already exists', 409);
    }

    const sections = { sections: schema.sections };
    
    const { data: template, error } = await supabase
      .from('templates')
      .insert({
        name,
        description,
        category,
        schema,
        sections,
        user_id: userId,
        is_public: isPublic,
      })
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to create template', { error, userId, name });
      throw new AppError('Failed to create template', 500);
    }

    logger.info('Template created successfully', { 
      templateId: template.id,
      userId,
      name,
      category,
      sectionsCount: schema.sections.length
    });

    return template as Template;
  }

  async updateTemplate(
    templateId: string,
    updates: Partial<Pick<Template, 'name' | 'description' | 'schema' | 'sections' | 'is_public'>>,
    userId: string
  ): Promise<Template> {
    // Validate schema if provided
    if (updates.schema) {
      const validation = await this.validateTemplate(updates.schema);
      if (!validation.isValid) {
        throw new AppError(`Template validation failed: ${validation.errors?.join(', ')}`, 400);
      }
      
      // Update sections based on schema
      updates.sections = { sections: updates.schema.sections };
    }

    const supabase = await createSupabaseServerClient();
    
    const { data: template, error } = await supabase
      .from('templates')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      logger.error('Failed to update template', { error, templateId, userId });
      throw new AppError('Failed to update template', 500);
    }

    if (!template) {
      throw new AppError('Template not found or access denied', 404);
    }

    logger.info('Template updated successfully', { templateId, userId });
    return template as Template;
  }

  async getTemplate(templateId: string, userId?: string): Promise<Template> {
    const supabase = await createSupabaseServerClient();
    
    const { data: template, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !template) {
      throw new AppError('Template not found', 404);
    }

    // Check access permissions
    if (!template.is_public && template.user_id !== userId) {
      throw new AppError('Access denied', 403);
    }

    return template as Template;
  }

  async duplicateTemplate(
    templateId: string,
    newName: string,
    userId: string
  ): Promise<Template> {
    const originalTemplate = await this.getTemplate(templateId, userId);
    
    return this.createTemplate(
      newName,
      `Copy of ${originalTemplate.description || originalTemplate.name}`,
      originalTemplate.category,
      originalTemplate.schema,
      userId,
      false // Duplicates are private by default
    );
  }

  async customizeTemplate(
    templateId: string,
    customizations: {
      sectionCustomizations?: { [sectionId: string]: Partial<TemplateSection> };
      reorderedSections?: string[];
      removedSections?: string[];
      addedSections?: TemplateSection[];
    },
    userId: string
  ): Promise<TemplateSchema> {
    const template = await this.getTemplate(templateId, userId);
    let sections = [...template.schema.sections];
    
    // Apply section customizations
    if (customizations.sectionCustomizations) {
      sections = sections.map(section => {
        const customization = customizations.sectionCustomizations![section.id];
        return customization ? { ...section, ...customization } : section;
      });
    }
    
    // Remove sections
    if (customizations.removedSections) {
      sections = sections.filter(section => 
        !customizations.removedSections!.includes(section.id)
      );
    }
    
    // Add new sections
    if (customizations.addedSections) {
      sections.push(...customizations.addedSections);
    }
    
    // Reorder sections
    if (customizations.reorderedSections) {
      const reorderedSections: TemplateSection[] = [];
      customizations.reorderedSections.forEach((sectionId, index) => {
        const section = sections.find(s => s.id === sectionId);
        if (section) {
          reorderedSections.push({ ...section, order: index + 1 });
        }
      });
      sections = reorderedSections;
    }
    
    // Create customized schema
    const customizedSchema: TemplateSchema = {
      ...template.schema,
      sections,
    };
    
    // Validate the customized template
    const validation = await this.validateTemplate(customizedSchema);
    if (!validation.isValid) {
      throw new AppError(`Customization validation failed: ${validation.errors?.join(', ')}`, 400);
    }
    
    return customizedSchema;
  }

  async getPopularTemplates(
    category?: string,
    limit: number = 10
  ): Promise<Template[]> {
    const supabase = await createSupabaseServerClient();
    
    let query = supabase
      .from('templates')
      .select('*')
      .eq('is_public', true);
    
    if (category) {
      query = query.eq('category', category);
    }
    
    const { data: templates, error } = await query
      .order('usage_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      logger.error('Failed to fetch popular templates', { error, category });
      throw new AppError('Failed to fetch templates', 500);
    }
    
    return templates as Template[];
  }

  async searchTemplates(
    query: string,
    category?: string,
    userId?: string,
    limit: number = 20
  ): Promise<Template[]> {
    const supabase = await createSupabaseServerClient();
    
    let dbQuery = supabase
      .from('templates')
      .select('*');
    
    // Build access filter
    if (userId) {
      dbQuery = dbQuery.or(`is_public.eq.true,user_id.eq.${userId}`);
    } else {
      dbQuery = dbQuery.eq('is_public', true);
    }
    
    if (category) {
      dbQuery = dbQuery.eq('category', category);
    }
    
    // Add text search (this would need full-text search index in production)
    dbQuery = dbQuery.or(`name.ilike.%${query}%,description.ilike.%${query}%`);
    
    const { data: templates, error } = await dbQuery
      .order('usage_count', { ascending: false })
      .limit(limit);
    
    if (error) {
      logger.error('Failed to search templates', { error, query, category });
      throw new AppError('Failed to search templates', 500);
    }
    
    return templates as Template[];
  }

  async previewTemplate(templateId: string, userId?: string): Promise<{
    template: Template;
    estimatedFields: number;
    estimatedTime: string;
    complexity: string;
  }> {
    const template = await this.getTemplate(templateId, userId);
    
    // Count total fields
    const countFields = (sections: TemplateSection[]): number => {
      return sections.reduce((total, section) => {
        let count = 1; // The section itself
        if (section.subsections) {
          count += countFields(section.subsections);
        }
        return total + count;
      }, 0);
    };
    
    const estimatedFields = countFields(template.schema.sections);
    const estimatedTime = template.schema.metadata?.estimatedTime || `${Math.ceil(estimatedFields * 2)} minutes`;
    const complexity = template.schema.metadata?.difficulty || 'intermediate';
    
    return {
      template,
      estimatedFields,
      estimatedTime,
      complexity,
    };
  }
}

export const templateEngine = new TemplateEngine();