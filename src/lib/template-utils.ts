import { z } from "zod";

// Template section schema
export const templateSectionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string(),
  required: z.boolean(),
  placeholder: z.string().optional(),
  type: z.enum(["text", "list", "table", "markdown"]).default("text"),
  validation: z.object({
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    required: z.boolean().default(false),
  }).optional(),
});

// Template schema
export const templateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().min(1).max(50),
  sections: z.array(templateSectionSchema).min(1),
  is_public: z.boolean().default(false),
  created_by: z.string().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

// Define outline section schema with explicit typing
export const outlineSectionSchema: z.ZodSchema<any> = z.lazy(() => z.object({
  id: z.string().optional(),
  title: z.string(),
  description: z.string(),
  content: z.string().optional(),
  subsections: z.array(outlineSectionSchema).optional(),
  bulletPoints: z.array(z.string()).optional(),
  estimatedTime: z.string().optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  status: z.enum(["not_started", "in_progress", "completed"]).default("not_started"),
  assignee: z.string().optional(),
  dueDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
}));

// Complete outline schema
export const outlineSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  sections: z.array(outlineSectionSchema),
  summary: z.string(),
  keyObjectives: z.array(z.string()),
  estimatedDuration: z.string().optional(),
  requiredResources: z.array(z.string()).optional(),
  metadata: z.object({
    version: z.string().default("1.0"),
    lastModified: z.string().optional(),
    template_id: z.string().uuid().optional(),
    generated_by: z.enum(["ai", "manual", "template"]).default("manual"),
  }).optional(),
});

export type TemplateSection = z.infer<typeof templateSectionSchema>;
export type Template = z.infer<typeof templateSchema>;
export type OutlineSection = z.infer<typeof outlineSectionSchema>;
export type Outline = z.infer<typeof outlineSchema>;

// Template validation utilities
export class TemplateValidator {
  static validateTemplate(template: any): { valid: boolean; errors?: string[] } {
    try {
      templateSchema.parse(template);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        };
      }
      return { valid: false, errors: ["Unknown validation error"] };
    }
  }

  static validateOutline(outline: any): { valid: boolean; errors?: string[] } {
    try {
      outlineSchema.parse(outline);
      return { valid: true };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          valid: false,
          errors: error.errors.map(err => `${err.path.join('.')}: ${err.message}`)
        };
      }
      return { valid: false, errors: ["Unknown validation error"] };
    }
  }

  static validateSectionContent(
    section: OutlineSection, 
    templateSection?: TemplateSection
  ): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!section.title || section.title.trim().length === 0) {
      errors.push("Section title is required");
    }

    if (!section.description || section.description.trim().length === 0) {
      errors.push("Section description is required");
    }

    if (templateSection?.validation) {
      const validation = templateSection.validation;
      const content = section.content || "";

      if (validation.required && content.trim().length === 0) {
        errors.push(`Content is required for section: ${section.title}`);
      }

      if (validation.minLength && content.length < validation.minLength) {
        errors.push(`Content must be at least ${validation.minLength} characters`);
      }

      if (validation.maxLength && content.length > validation.maxLength) {
        errors.push(`Content must not exceed ${validation.maxLength} characters`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined
    };
  }
}

// Template processing utilities
export class TemplateProcessor {
  static createOutlineFromTemplate(template: Template, userInput?: Partial<Outline>): Outline {
    const sections: OutlineSection[] = template.sections.map(templateSection => ({
      title: templateSection.title,
      description: templateSection.description,
      content: templateSection.placeholder || "",
      bulletPoints: [],
      priority: templateSection.required ? "high" : "medium",
      status: "not_started" as const,
    }));

    return {
      title: userInput?.title || `New ${template.name}`,
      description: userInput?.description || template.description,
      sections,
      summary: userInput?.summary || `Outline based on ${template.name} template`,
      keyObjectives: userInput?.keyObjectives || [],
      estimatedDuration: userInput?.estimatedDuration,
      requiredResources: userInput?.requiredResources || [],
      metadata: {
        version: "1.0",
        lastModified: new Date().toISOString(),
        template_id: template.id,
        generated_by: "template",
      },
    };
  }

  static mergeTemplateWithOutline(template: Template, outline: Outline): Outline {
    // Create a map of existing sections by title for quick lookup
    const existingSections = new Map(
      outline.sections.map(section => [section.title.toLowerCase(), section])
    );

    // Process template sections
    const mergedSections: OutlineSection[] = template.sections.map(templateSection => {
      const existingSection = existingSections.get(templateSection.title.toLowerCase());
      
      if (existingSection) {
        // Update existing section with template metadata
        return {
          ...existingSection,
          description: existingSection.description || templateSection.description,
        };
      } else {
        // Create new section from template
        return {
          title: templateSection.title,
          description: templateSection.description,
          content: templateSection.placeholder || "",
          priority: templateSection.required ? "high" : "medium",
          status: "not_started" as const,
        };
      }
    });

    // Add any existing sections that aren't in the template
    outline.sections.forEach(section => {
      const isInTemplate = template.sections.some(
        ts => ts.title.toLowerCase() === section.title.toLowerCase()
      );
      if (!isInTemplate) {
        mergedSections.push(section);
      }
    });

    return {
      ...outline,
      sections: mergedSections,
      metadata: {
        version: outline.metadata?.version || "1.0",
        generated_by: outline.metadata?.generated_by || "template",
        template_id: template.id,
        lastModified: new Date().toISOString(),
      },
    };
  }

  static calculateCompletionPercentage(outline: Outline): number {
    if (outline.sections.length === 0) return 0;

    const completedSections = outline.sections.filter(
      section => section.status === "completed"
    ).length;

    return Math.round((completedSections / outline.sections.length) * 100);
  }

  static generateSectionId(): string {
    return `section_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static estimateTotalDuration(outline: Outline): string {
    const sections = outline.sections;
    if (sections.length === 0) return "Unknown";

    let totalMinutes = 0;
    let hasEstimates = false;

    sections.forEach(section => {
      if (section.estimatedTime) {
        const time = this.parseTimeEstimate(section.estimatedTime);
        if (time > 0) {
          totalMinutes += time;
          hasEstimates = true;
        }
      }
    });

    if (!hasEstimates) return "Unknown";

    return this.formatDuration(totalMinutes);
  }

  private static parseTimeEstimate(timeStr: string): number {
    // Parse various time formats: "2 hours", "30 minutes", "2-4 hours", "1.5 hours"
    const lowerStr = timeStr.toLowerCase();
    
    // Extract numbers
    const numbers = lowerStr.match(/\d+(?:\.\d+)?/g);
    if (!numbers) return 0;

    const value = parseFloat(numbers[0]);
    
    if (lowerStr.includes('hour')) {
      return value * 60; // Convert to minutes
    } else if (lowerStr.includes('minute')) {
      return value;
    } else if (lowerStr.includes('day')) {
      return value * 480; // 8 hours per day
    } else if (lowerStr.includes('week')) {
      return value * 2400; // 5 days * 8 hours
    }
    
    return 0; // Default if format not recognized
  }

  private static formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} minutes`;
    } else if (minutes < 480) { // Less than 8 hours
      const hours = Math.round(minutes / 60 * 10) / 10; // Round to 1 decimal
      return hours === 1 ? "1 hour" : `${hours} hours`;
    } else if (minutes < 2400) { // Less than 5 days
      const days = Math.round(minutes / 480 * 10) / 10;
      return days === 1 ? "1 day" : `${days} days`;
    } else {
      const weeks = Math.round(minutes / 2400 * 10) / 10;
      return weeks === 1 ? "1 week" : `${weeks} weeks`;
    }
  }
}

// Common template categories and their default sections
export const TEMPLATE_CATEGORIES = {
  basic: {
    name: "Basic",
    description: "General purpose templates for common projects",
    color: "#6B7280"
  },
  technical: {
    name: "Technical",
    description: "Templates for software development and technical projects",
    color: "#3B82F6"
  },
  marketing: {
    name: "Marketing",
    description: "Templates for marketing campaigns and strategies",
    color: "#EF4444"
  },
  business: {
    name: "Business",
    description: "Templates for business planning and operations",
    color: "#10B981"
  },
  academic: {
    name: "Academic",
    description: "Templates for research and academic projects",
    color: "#8B5CF6"
  },
  personal: {
    name: "Personal",
    description: "Templates for personal projects and goals",
    color: "#F59E0B"
  }
} as const;

export type TemplateCategoryKey = keyof typeof TEMPLATE_CATEGORIES;