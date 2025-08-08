import { Project, Template } from './database';

export interface ExportOptions {
  format: 'json' | 'markdown' | 'pdf' | 'docx';
  includeMetadata: boolean;
  includeComments: boolean;
  templateInfo: boolean;
}

export class ExportService {
  /**
   * Export project to JSON format
   */
  static exportToJSON(project: Project, options: ExportOptions): string {
    const exportData: any = {
      title: project.title,
      description: project.description,
      content: project.content,
      status: project.status,
      created_at: project.created_at,
      updated_at: project.updated_at,
    };

    if (options.includeMetadata) {
      exportData.metadata = {
        project_id: project.id,
        user_id: project.user_id,
      };
    }

    if (options.templateInfo && project.template) {
      exportData.template_info = {
        template_id: project.template_id,
        template_name: project.template.name,
        template_category: project.template.category,
      };
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Export project to Markdown format
   */
  static exportToMarkdown(project: Project, options: ExportOptions): string {
    let markdown = `# ${project.title}\n\n`;

    if (project.description) {
      markdown += `${project.description}\n\n`;
    }

    if (options.includeMetadata) {
      markdown += `---\n`;
      markdown += `Created: ${new Date(project.created_at).toLocaleDateString()}\n`;
      markdown += `Updated: ${new Date(project.updated_at).toLocaleDateString()}\n`;
      if (project.template) {
        markdown += `Template: ${project.template.name}\n`;
        markdown += `Category: ${project.template.category}\n`;
      }
      markdown += `---\n\n`;
    }

    // Export sections
    const sections = project.content?.sections || {};
    const template = project.template;

    if (template) {
      // Use template section order and names
      template.default_sections.forEach(templateSection => {
        const content = sections[templateSection.id];
        if (content) {
          markdown += `## ${templateSection.name}\n\n`;
          markdown += this.formatContentForMarkdown(content);
          markdown += `\n\n`;
        }
      });
    } else {
      // Export all sections without template structure
      Object.entries(sections).forEach(([sectionId, content]) => {
        const sectionName = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
        markdown += `## ${sectionName}\n\n`;
        markdown += this.formatContentForMarkdown(content);
        markdown += `\n\n`;
      });
    }

    return markdown;
  }

  /**
   * Import project from JSON
   */
  static importFromJSON(jsonData: string): Partial<Project> {
    try {
      const data = JSON.parse(jsonData);
      
      return {
        title: data.title,
        description: data.description,
        content: data.content || { sections: {} },
        settings: data.settings || {},
        status: data.status || 'draft',
        template_id: data.template_info?.template_id,
      };
    } catch (error) {
      throw new Error('Invalid JSON format');
    }
  }

  /**
   * Validate import data
   */
  static validateImportData(data: Partial<Project>): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
      errors.push('Title is required');
    }

    if (data.title && data.title.length > 255) {
      errors.push('Title is too long (maximum 255 characters)');
    }

    if (data.description && data.description.length > 1000) {
      errors.push('Description is too long (maximum 1000 characters)');
    }

    if (data.content && typeof data.content !== 'object') {
      errors.push('Content must be an object');
    }

    if (data.settings && typeof data.settings !== 'object') {
      errors.push('Settings must be an object');
    }

    if (data.status && !['draft', 'published', 'archived'].includes(data.status)) {
      warnings.push('Invalid status, will default to "draft"');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Generate export filename
   */
  static generateExportFilename(project: Project, format: string): string {
    const sanitizedTitle = project.title
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
    
    const timestamp = new Date().toISOString().split('T')[0];
    return `${sanitizedTitle}_${timestamp}.${format}`;
  }

  /**
   * Get export size estimate
   */
  static getExportSizeEstimate(project: Project, format: string): number {
    const jsonExport = this.exportToJSON(project, {
      format: 'json',
      includeMetadata: true,
      includeComments: false,
      templateInfo: true,
    });

    const baseSize = new Blob([jsonExport]).size;

    // Rough size multipliers for different formats
    const multipliers = {
      json: 1,
      markdown: 0.8,
      pdf: 2.5,
      docx: 2.0,
    };

    return Math.round(baseSize * (multipliers[format as keyof typeof multipliers] || 1));
  }

  /**
   * Format content for markdown output
   */
  private static formatContentForMarkdown(content: any): string {
    if (Array.isArray(content)) {
      return content.map(item => `- ${item}`).join('\n');
    }

    if (typeof content === 'string') {
      // Remove HTML tags for cleaner markdown
      return content.replace(/<[^>]*>/g, '');
    }

    if (typeof content === 'object' && content !== null) {
      if (content.url) {
        return `[File: ${content.filename || 'Download'}](${content.url})`;
      }
      return JSON.stringify(content, null, 2);
    }

    return String(content);
  }
}

export default ExportService;