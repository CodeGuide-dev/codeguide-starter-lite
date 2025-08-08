import { createSupabaseServerClient } from './supabase';
import { logger } from './logger';
import { cacheManager } from './redis';
import {
  Template,
  Project,
  ProjectVersion,
  ProjectCollaborator,
  ProjectComment,
  TemplateCategory,
  ProjectStatus,
  CreateTemplateRequest,
  UpdateTemplateRequest,
  CreateProjectRequest,
  UpdateProjectRequest,
  CreateCollaboratorRequest,
  UpdateCollaboratorRequest,
  CreateCommentRequest,
  UpdateCommentRequest,
  TemplateSearchFilters,
  ProjectSearchFilters,
  TemplateValidationResult,
  ProjectValidationResult,
  ProjectContent,
} from '../types/templates';
import { PaginatedResponse } from '../types/api';

export class TemplateService {
  private cachePrefix = 'template:';
  private cacheTTL = 3600; // 1 hour

  /**
   * Get all templates with optional filtering
   */
  async getTemplates(
    filters: TemplateSearchFilters = {},
    page = 1,
    limit = 10
  ): Promise<PaginatedResponse<Template>> {
    try {
      const supabase = await createSupabaseServerClient();
      let query = supabase.from('templates').select('*', { count: 'exact' });

      // Apply filters
      if (filters.category && filters.category.length > 0) {
        query = query.in('category', filters.category);
      }
      if (filters.isPublic !== undefined) {
        query = query.eq('is_public', filters.isPublic);
      }
      if (filters.isSystem !== undefined) {
        query = query.eq('is_system', filters.isSystem);
      }
      if (filters.createdBy) {
        query = query.eq('created_by', filters.createdBy);
      }
      if (filters.tags && filters.tags.length > 0) {
        query = query.overlaps('tags', filters.tags);
      }
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      // Order by usage count and created date
      query = query.order('usage_count', { ascending: false });
      query = query.order('created_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error fetching templates:', error);
        throw new Error(`Failed to fetch templates: ${error.message}`);
      }

      const totalPages = Math.ceil((count || 0) / limit);

      return {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error('Template service error:', error);
      throw error;
    }
  }

  /**
   * Get a single template by ID
   */
  async getTemplate(id: string): Promise<Template | null> {
    try {
      const cacheKey = `${this.cachePrefix}${id}`;
      
      // Try cache first
      const cached = await cacheManager.get<Template>(cacheKey);
      if (cached) {
        return cached;
      }

      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error fetching template:', error);
        throw new Error(`Failed to fetch template: ${error.message}`);
      }

      // Cache the result
      await cacheManager.set(cacheKey, data, this.cacheTTL);
      
      return data;
    } catch (error) {
      logger.error('Template service error:', error);
      throw error;
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(userId: string, templateData: CreateTemplateRequest): Promise<Template> {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from('templates')
        .insert({
          ...templateData,
          created_by: userId,
          is_system: false,
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating template:', error);
        throw new Error(`Failed to create template: ${error.message}`);
      }

      logger.info('Template created successfully', { templateId: data.id, userId });
      return data;
    } catch (error) {
      logger.error('Template service error:', error);
      throw error;
    }
  }

  /**
   * Update an existing template
   */
  async updateTemplate(userId: string, updateData: UpdateTemplateRequest): Promise<Template> {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from('templates')
        .update({
          ...updateData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', updateData.id)
        .eq('created_by', userId) // Ensure user owns the template
        .select()
        .single();

      if (error) {
        logger.error('Error updating template:', error);
        throw new Error(`Failed to update template: ${error.message}`);
      }

      // Clear cache
      await cacheManager.del(`${this.cachePrefix}${updateData.id}`);

      logger.info('Template updated successfully', { templateId: updateData.id, userId });
      return data;
    } catch (error) {
      logger.error('Template service error:', error);
      throw error;
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(userId: string, templateId: string): Promise<void> {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', templateId)
        .eq('created_by', userId); // Ensure user owns the template

      if (error) {
        logger.error('Error deleting template:', error);
        throw new Error(`Failed to delete template: ${error.message}`);
      }

      // Clear cache
      await cacheManager.del(`${this.cachePrefix}${templateId}`);

      logger.info('Template deleted successfully', { templateId, userId });
    } catch (error) {
      logger.error('Template service error:', error);
      throw error;
    }
  }

  /**
   * Increment template usage count
   */
  async incrementUsageCount(templateId: string): Promise<void> {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.rpc('increment_template_usage', {
        template_id: templateId
      });

      if (error) {
        logger.error('Error incrementing template usage:', error);
      }

      // Clear cache to ensure fresh data
      await cacheManager.del(`${this.cachePrefix}${templateId}`);
    } catch (error) {
      logger.error('Template service error:', error);
    }
  }

  /**
   * Validate template structure
   */
  validateTemplate(template: CreateTemplateRequest | UpdateTemplateRequest): TemplateValidationResult {
    const errors: Array<{ field: string; message: string; severity: 'error' | 'warning' }> = [];

    // Basic validation
    if (!template.name || template.name.trim().length === 0) {
      errors.push({ field: 'name', message: 'Template name is required', severity: 'error' });
    }

    if (template.name && template.name.length > 255) {
      errors.push({ field: 'name', message: 'Template name must be 255 characters or less', severity: 'error' });
    }

    if (!template.template_data || !template.template_data.sections) {
      errors.push({ field: 'template_data', message: 'Template must have sections', severity: 'error' });
    } else {
      // Validate sections
      const sectionIds = new Set<string>();
      template.template_data.sections.forEach((section, index) => {
        if (!section.id) {
          errors.push({ 
            field: `sections[${index}].id`, 
            message: 'Section ID is required', 
            severity: 'error' 
          });
        } else if (sectionIds.has(section.id)) {
          errors.push({ 
            field: `sections[${index}].id`, 
            message: 'Section ID must be unique', 
            severity: 'error' 
          });
        } else {
          sectionIds.add(section.id);
        }

        if (!section.name || section.name.trim().length === 0) {
          errors.push({ 
            field: `sections[${index}].name`, 
            message: 'Section name is required', 
            severity: 'error' 
          });
        }

        if (!['text', 'list', 'table', 'image', 'markdown', 'checkbox', 'select'].includes(section.type)) {
          errors.push({ 
            field: `sections[${index}].type`, 
            message: 'Invalid section type', 
            severity: 'error' 
          });
        }

        // Type-specific validation
        if (section.type === 'table' && (!section.columns || section.columns.length === 0)) {
          errors.push({ 
            field: `sections[${index}].columns`, 
            message: 'Table sections must have columns defined', 
            severity: 'error' 
          });
        }

        if (section.type === 'select' && (!section.options || section.options.length === 0)) {
          errors.push({ 
            field: `sections[${index}].options`, 
            message: 'Select sections must have options defined', 
            severity: 'error' 
          });
        }
      });
    }

    return {
      isValid: errors.filter(e => e.severity === 'error').length === 0,
      errors,
    };
  }
}

export class ProjectService {
  private cachePrefix = 'project:';
  private cacheTTL = 1800; // 30 minutes

  /**
   * Get user's projects with optional filtering
   */
  async getUserProjects(
    userId: string,
    filters: ProjectSearchFilters = {},
    page = 1,
    limit = 10
  ): Promise<PaginatedResponse<Project>> {
    try {
      const supabase = await createSupabaseServerClient();
      let query = supabase.from('projects').select('*', { count: 'exact' });

      // Base filter for user's own projects and shared projects
      query = query.or(`user_id.eq.${userId},shared_with.cs.{${userId}}`);

      // Apply additional filters
      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }
      if (filters.templateId) {
        query = query.eq('template_id', filters.templateId);
      }
      if (filters.isPublic !== undefined) {
        query = query.eq('is_public', filters.isPublic);
      }
      if (filters.tags && filters.tags.length > 0) {
        query = query.overlaps('tags', filters.tags);
      }
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }
      if (filters.dateRange) {
        query = query.gte('created_at', filters.dateRange.from);
        query = query.lte('created_at', filters.dateRange.to);
      }

      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      // Order by last edited
      query = query.order('last_edited_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error fetching projects:', error);
        throw new Error(`Failed to fetch projects: ${error.message}`);
      }

      const totalPages = Math.ceil((count || 0) / limit);

      return {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error('Project service error:', error);
      throw error;
    }
  }

  /**
   * Get a single project by ID
   */
  async getProject(userId: string, projectId: string): Promise<Project | null> {
    try {
      const cacheKey = `${this.cachePrefix}${projectId}`;
      
      // Try cache first
      const cached = await cacheManager.get<Project>(cacheKey);
      if (cached) {
        // Verify user has access
        if (this.hasProjectAccess(cached, userId)) {
          return cached;
        }
      }

      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Error fetching project:', error);
        throw new Error(`Failed to fetch project: ${error.message}`);
      }

      // Verify user has access
      if (!this.hasProjectAccess(data, userId)) {
        return null;
      }

      // Cache the result
      await cacheManager.set(cacheKey, data, this.cacheTTL);
      
      return data;
    } catch (error) {
      logger.error('Project service error:', error);
      throw error;
    }
  }

  /**
   * Create a new project
   */
  async createProject(userId: string, projectData: CreateProjectRequest): Promise<Project> {
    try {
      const supabase = await createSupabaseServerClient();
      
      // If template is specified, validate it and increment usage
      if (projectData.template_id) {
        const templateService = new TemplateService();
        const template = await templateService.getTemplate(projectData.template_id);
        if (template) {
          await templateService.incrementUsageCount(projectData.template_id);
        }
      }

      const { data, error } = await supabase
        .from('projects')
        .insert({
          ...projectData,
          user_id: userId,
          content: projectData.content || {},
          metadata: projectData.metadata || {},
          shared_with: [],
          tags: projectData.tags || [],
          last_edited_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        logger.error('Error creating project:', error);
        throw new Error(`Failed to create project: ${error.message}`);
      }

      logger.info('Project created successfully', { projectId: data.id, userId });
      return data;
    } catch (error) {
      logger.error('Project service error:', error);
      throw error;
    }
  }

  /**
   * Update an existing project
   */
  async updateProject(userId: string, updateData: UpdateProjectRequest): Promise<Project> {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from('projects')
        .update({
          ...updateData,
          last_edited_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', updateData.id)
        .or(`user_id.eq.${userId},shared_with.cs.{${userId}}`) // User owns or has access
        .select()
        .single();

      if (error) {
        logger.error('Error updating project:', error);
        throw new Error(`Failed to update project: ${error.message}`);
      }

      // Clear cache
      await cacheManager.del(`${this.cachePrefix}${updateData.id}`);

      logger.info('Project updated successfully', { projectId: updateData.id, userId });
      return data;
    } catch (error) {
      logger.error('Project service error:', error);
      throw error;
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', userId); // Only owner can delete

      if (error) {
        logger.error('Error deleting project:', error);
        throw new Error(`Failed to delete project: ${error.message}`);
      }

      // Clear cache
      await cacheManager.del(`${this.cachePrefix}${projectId}`);

      logger.info('Project deleted successfully', { projectId, userId });
    } catch (error) {
      logger.error('Project service error:', error);
      throw error;
    }
  }

  /**
   * Share project with users
   */
  async shareProject(userId: string, projectId: string, userIds: string[]): Promise<void> {
    try {
      const supabase = await createSupabaseServerClient();
      
      // Get current project
      const project = await this.getProject(userId, projectId);
      if (!project || project.user_id !== userId) {
        throw new Error('Project not found or access denied');
      }

      // Update shared_with array
      const updatedSharedWith = [...new Set([...project.shared_with, ...userIds])];
      
      const { error } = await supabase
        .from('projects')
        .update({ shared_with: updatedSharedWith })
        .eq('id', projectId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error sharing project:', error);
        throw new Error(`Failed to share project: ${error.message}`);
      }

      // Clear cache
      await cacheManager.del(`${this.cachePrefix}${projectId}`);

      logger.info('Project shared successfully', { projectId, userId, sharedWith: userIds });
    } catch (error) {
      logger.error('Project service error:', error);
      throw error;
    }
  }

  /**
   * Validate project content
   */
  async validateProject(projectId: string, userId: string): Promise<ProjectValidationResult> {
    try {
      const project = await this.getProject(userId, projectId);
      if (!project) {
        throw new Error('Project not found');
      }

      let template = null;
      if (project.template_id) {
        const templateService = new TemplateService();
        template = await templateService.getTemplate(project.template_id);
      }

      const errors: Array<{ sectionId: string; field: string; message: string }> = [];
      const missingRequired: string[] = [];
      let completedSections = 0;
      let totalSections = 0;

      if (template) {
        totalSections = template.template_data.sections.length;
        
        template.template_data.sections.forEach(section => {
          const sectionContent = project.content[section.id];
          
          if (section.required) {
            if (!sectionContent || !sectionContent.value || 
                (Array.isArray(sectionContent.value) && sectionContent.value.length === 0) ||
                (typeof sectionContent.value === 'string' && sectionContent.value.trim().length === 0)) {
              missingRequired.push(section.id);
              errors.push({
                sectionId: section.id,
                field: 'value',
                message: `${section.name} is required`
              });
            } else {
              completedSections++;
            }
          } else if (sectionContent && sectionContent.value) {
            completedSections++;
          }

          // Type-specific validation
          if (sectionContent && sectionContent.value) {
            this.validateSectionContent(section, sectionContent, errors);
          }
        });
      }

      const completionPercentage = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 100;

      return {
        isValid: errors.length === 0,
        completionPercentage,
        missingRequired,
        errors,
      };
    } catch (error) {
      logger.error('Project validation error:', error);
      throw error;
    }
  }

  private validateSectionContent(
    section: any, 
    content: any, 
    errors: Array<{ sectionId: string; field: string; message: string }>
  ): void {
    // Add specific validation logic based on section type
    if (section.validation) {
      if (section.validation.pattern && typeof content.value === 'string') {
        const regex = new RegExp(section.validation.pattern);
        if (!regex.test(content.value)) {
          errors.push({
            sectionId: section.id,
            field: 'value',
            message: `Invalid format for ${section.name}`
          });
        }
      }

      if (section.validation.minItems && Array.isArray(content.value)) {
        if (content.value.length < section.validation.minItems) {
          errors.push({
            sectionId: section.id,
            field: 'value',
            message: `${section.name} requires at least ${section.validation.minItems} items`
          });
        }
      }

      if (section.validation.maxItems && Array.isArray(content.value)) {
        if (content.value.length > section.validation.maxItems) {
          errors.push({
            sectionId: section.id,
            field: 'value',
            message: `${section.name} cannot have more than ${section.validation.maxItems} items`
          });
        }
      }
    }

    if (section.maxLength && typeof content.value === 'string') {
      if (content.value.length > section.maxLength) {
        errors.push({
          sectionId: section.id,
          field: 'value',
          message: `${section.name} cannot exceed ${section.maxLength} characters`
        });
      }
    }
  }

  private hasProjectAccess(project: Project, userId: string): boolean {
    return project.user_id === userId || 
           project.shared_with.includes(userId) || 
           project.is_public;
  }
}

// Export singleton instances
export const templateService = new TemplateService();
export const projectService = new ProjectService();