import { z } from 'zod';

// Schema for template sections
export const TemplateSectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['text', 'textarea', 'richtext', 'list', 'image', 'file']),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
  }).optional(),
  defaultValue: z.any().optional(),
});

// Schema for template structure
export const TemplateStructureSchema = z.object({
  sections: z.array(z.string()), // Array of section IDs
  customizable: z.boolean().default(true),
  layout: z.enum(['linear', 'grid', 'sidebar']).default('linear'),
  settings: z.object({
    allowReordering: z.boolean().default(true),
    allowAddingSections: z.boolean().default(false),
    allowRemovingSections: z.boolean().default(false),
    maxSections: z.number().optional(),
  }).optional(),
});

// Schema for creating templates
export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  category: z.string().min(1).max(100),
  structure: TemplateStructureSchema,
  default_sections: z.array(TemplateSectionSchema),
  is_public: z.boolean().default(false),
});

// Schema for updating templates
export const UpdateTemplateSchema = CreateTemplateSchema.partial();

// Schema for project content validation
export const ProjectContentSchema = z.object({
  sections: z.record(z.string(), z.any()), // section_id -> content
  metadata: z.object({
    lastModified: z.string().optional(),
    version: z.number().optional(),
    contributors: z.array(z.string()).optional(),
  }).optional(),
});

// Schema for project settings
export const ProjectSettingsSchema = z.object({
  visibility: z.enum(['private', 'public', 'shared']).default('private'),
  collaboration: z.object({
    allowComments: z.boolean().default(true),
    allowEditing: z.boolean().default(false),
    requireApproval: z.boolean().default(false),
  }).optional(),
  export: z.object({
    formats: z.array(z.enum(['pdf', 'docx', 'markdown'])).default(['pdf']),
    includeComments: z.boolean().default(false),
    watermark: z.boolean().default(false),
  }).optional(),
  ai: z.object({
    enableSuggestions: z.boolean().default(true),
    autoGenerateOutlines: z.boolean().default(false),
    model: z.enum(['gpt-4', 'gpt-3.5-turbo', 'claude-3']).default('gpt-4'),
  }).optional(),
});

// Schema for creating projects
export const CreateProjectSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  template_id: z.string().uuid().optional(),
  content: ProjectContentSchema.default({ sections: {} }),
  settings: ProjectSettingsSchema.default({}),
});

// Schema for updating projects
export const UpdateProjectSchema = CreateProjectSchema.partial();

// Template categories enum
export const TemplateCategories = [
  'general',
  'technical',
  'marketing',
  'business',
  'academic',
  'creative',
  'legal',
  'personal',
] as const;

export type TemplateCategory = typeof TemplateCategories[number];

// Helper function to validate template structure
export function validateTemplateStructure(structure: any, sections: any[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  try {
    // Validate structure schema
    TemplateStructureSchema.parse(structure);
    
    // Validate sections schema
    sections.forEach((section, index) => {
      try {
        TemplateSectionSchema.parse(section);
      } catch (error) {
        errors.push(`Section ${index + 1}: Invalid section format`);
      }
    });
    
    // Validate that structure.sections references exist in sections array
    const sectionIds = sections.map(s => s.id);
    const missingSections = structure.sections.filter((id: string) => !sectionIds.includes(id));
    if (missingSections.length > 0) {
      errors.push(`Missing sections: ${missingSections.join(', ')}`);
    }
    
    // Validate no duplicate section IDs
    const duplicateIds = sectionIds.filter((id, index) => sectionIds.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate section IDs: ${duplicateIds.join(', ')}`);
    }
    
    return { valid: errors.length === 0, errors };
  } catch (error) {
    errors.push('Invalid structure format');
    return { valid: false, errors };
  }
}

// Helper function to validate project content against template
export function validateProjectContent(content: any, template: any): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    ProjectContentSchema.parse(content);
    
    if (!template) {
      return { valid: true, errors, warnings };
    }
    
    // Check required sections
    const requiredSections = template.default_sections
      .filter((section: any) => section.required)
      .map((section: any) => section.id);
    
    const providedSections = Object.keys(content.sections || {});
    const missingRequired = requiredSections.filter((id: string) => !providedSections.includes(id));
    
    if (missingRequired.length > 0) {
      errors.push(`Missing required sections: ${missingRequired.join(', ')}`);
    }
    
    // Check for extra sections not in template
    const templateSectionIds = template.default_sections.map((s: any) => s.id);
    const extraSections = providedSections.filter(id => !templateSectionIds.includes(id));
    
    if (extraSections.length > 0) {
      warnings.push(`Extra sections not in template: ${extraSections.join(', ')}`);
    }
    
    // Validate individual sections
    template.default_sections.forEach((templateSection: any) => {
      const sectionContent = content.sections[templateSection.id];
      if (sectionContent && templateSection.validation) {
        const validation = templateSection.validation;
        
        if (validation.minLength && typeof sectionContent === 'string' && sectionContent.length < validation.minLength) {
          errors.push(`Section '${templateSection.name}' is too short (minimum ${validation.minLength} characters)`);
        }
        
        if (validation.maxLength && typeof sectionContent === 'string' && sectionContent.length > validation.maxLength) {
          errors.push(`Section '${templateSection.name}' is too long (maximum ${validation.maxLength} characters)`);
        }
        
        if (validation.pattern && typeof sectionContent === 'string' && !new RegExp(validation.pattern).test(sectionContent)) {
          errors.push(`Section '${templateSection.name}' does not match required pattern`);
        }
      }
    });
    
    return { valid: errors.length === 0, errors, warnings };
  } catch (error) {
    errors.push('Invalid content format');
    return { valid: false, errors, warnings };
  }
}

// Helper function to get default content for a template
export function getDefaultProjectContent(template: any): any {
  const sections: Record<string, any> = {};
  
  template.default_sections.forEach((section: any) => {
    if (section.defaultValue !== undefined) {
      sections[section.id] = section.defaultValue;
    } else {
      // Set appropriate default based on type
      switch (section.type) {
        case 'text':
          sections[section.id] = '';
          break;
        case 'textarea':
        case 'richtext':
          sections[section.id] = '';
          break;
        case 'list':
          sections[section.id] = [];
          break;
        case 'image':
        case 'file':
          sections[section.id] = null;
          break;
        default:
          sections[section.id] = '';
      }
    }
  });
  
  return {
    sections,
    metadata: {
      lastModified: new Date().toISOString(),
      version: 1,
      contributors: [],
    },
  };
}