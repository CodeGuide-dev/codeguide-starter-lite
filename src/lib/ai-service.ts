import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText } from "ai";
import { z } from "zod";
import { AppCache } from "./redis";
import { createSupabaseServerClient } from "./supabase";

// Define the outline structure schema
const outlineSchema = z.object({
  title: z.string(),
  sections: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      subsections: z.array(
        z.object({
          title: z.string(),
          content: z.string(),
        })
      ).optional(),
      bulletPoints: z.array(z.string()).optional(),
      estimatedTime: z.string().optional(),
      priority: z.enum(["high", "medium", "low"]).optional(),
    })
  ),
  summary: z.string(),
  keyObjectives: z.array(z.string()),
  estimatedDuration: z.string().optional(),
  requiredResources: z.array(z.string()).optional(),
});

export type GeneratedOutline = z.infer<typeof outlineSchema>;

interface GenerationOptions {
  model?: "gpt-4" | "gpt-4-turbo" | "claude-3-5-sonnet";
  temperature?: number;
  maxTokens?: number;
  userId?: string;
}

interface TemplateSection {
  title: string;
  description: string;
  required: boolean;
}

interface Template {
  id: string;
  name: string;
  category: string;
  sections: TemplateSection[];
}

export class AIOutlineGenerator {
  private static readonly DEFAULT_MODEL = "gpt-4";
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static readonly MAX_RETRIES = 3;

  static async generateOutline(
    prompt: string,
    template?: Template,
    options: GenerationOptions = {}
  ): Promise<GeneratedOutline> {
    const {
      model = this.DEFAULT_MODEL,
      temperature = 0.7,
      maxTokens = 4000,
      userId,
    } = options;

    // Check cache first
    const cacheKey = `outline:${this.hashPrompt(prompt)}:${template?.id || "default"}`;
    const cached = await AppCache.get<GeneratedOutline>(cacheKey);
    if (cached) {
      return cached;
    }

    // Log the generation attempt
    const logData = {
      prompt,
      model,
      start_time: Date.now(),
      user_id: userId,
    };

    try {
      let result: GeneratedOutline;
      
      if (model.startsWith("claude")) {
        result = await this.generateWithAnthropic(prompt, {
          temperature,
          maxTokens,
        }, template);
      } else {
        result = await this.generateWithOpenAI(prompt, {
          temperature,
          maxTokens,
        }, template);
      }

      // Cache the result
      await AppCache.set(cacheKey, result, this.CACHE_TTL);

      // Log successful generation
      await this.logGeneration({
        ...logData,
        success: true,
        tokens_used: this.estimateTokens(JSON.stringify(result)),
        response_time_ms: Date.now() - logData.start_time,
        generated_content: result,
      });

      return result;
    } catch (error) {
      // Log failed generation
      await this.logGeneration({
        ...logData,
        success: false,
        error_message: error instanceof Error ? error.message : "Unknown error",
        response_time_ms: Date.now() - logData.start_time,
      });

      // Try fallback approach
      return this.generateFallbackOutline(prompt, template);
    }
  }

  private static async generateWithOpenAI(
    prompt: string,
    options: { temperature: number; maxTokens: number },
    template?: Template
  ): Promise<GeneratedOutline> {
    const systemPrompt = this.buildSystemPrompt(template);
    const userPrompt = this.buildUserPrompt(prompt, template);

    const { object } = await generateObject({
      model: openai("gpt-4"),
      schema: outlineSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });

    return object;
  }

  private static async generateWithAnthropic(
    prompt: string,
    options: { temperature: number; maxTokens: number },
    template?: Template
  ): Promise<GeneratedOutline> {
    const systemPrompt = this.buildSystemPrompt(template);
    const userPrompt = this.buildUserPrompt(prompt, template);

    const { object } = await generateObject({
      model: anthropic("claude-3-5-sonnet-20241022"),
      schema: outlineSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
    });

    return object;
  }

  private static buildSystemPrompt(template?: Template): string {
    let systemPrompt = `You are an expert project planning assistant. Your task is to generate comprehensive, well-structured outlines based on user descriptions.

Key requirements:
- Create detailed, actionable sections
- Provide clear descriptions for each section
- Include relevant subsections and bullet points where appropriate
- Estimate time requirements and set priorities
- Ensure the outline is practical and achievable
- Focus on clarity and organization`;

    if (template) {
      systemPrompt += `\n\nTemplate Structure:
The user has selected the "${template.name}" template (${template.category} category).
Required sections to include:
${template.sections
  .filter((s) => s.required)
  .map((s) => `- ${s.title}: ${s.description}`)
  .join("\n")}

Optional sections to consider:
${template.sections
  .filter((s) => !s.required)
  .map((s) => `- ${s.title}: ${s.description}`)
  .join("\n")}

Adapt these sections to fit the user's specific project needs.`;
    }

    return systemPrompt;
  }

  private static buildUserPrompt(prompt: string, template?: Template): string {
    let userPrompt = `Please create a detailed outline for the following project:

${prompt}`;

    if (template) {
      userPrompt += `\n\nUse the "${template.name}" template as a guide, but adapt it to fit this specific project. Include all required sections and any relevant optional sections.`;
    }

    userPrompt += `\n\nProvide a comprehensive outline that includes:
- A clear project title
- Detailed sections with descriptions
- Subsections where appropriate
- Key bullet points for each section
- Estimated timeframes
- Priority levels
- A project summary
- Key objectives
- Required resources

Make sure the outline is practical, actionable, and well-organized.`;

    return userPrompt;
  }

  private static generateFallbackOutline(
    prompt: string,
    template?: Template
  ): GeneratedOutline {
    // Generate a basic outline structure as fallback
    const sections = template?.sections || [
      { title: "Overview", description: "Project description and goals", required: true },
      { title: "Planning", description: "Detailed project planning", required: true },
      { title: "Implementation", description: "Execution strategy", required: true },
      { title: "Review", description: "Project review and next steps", required: true },
    ];

    return {
      title: `Project Outline: ${prompt.slice(0, 50)}...`,
      sections: sections.map((section) => ({
        title: section.title,
        description: section.description,
        bulletPoints: [
          "Define objectives and scope",
          "Identify key requirements",
          "Plan implementation approach",
        ],
        priority: "medium" as const,
        estimatedTime: "2-4 hours",
      })),
      summary: `This is a fallback outline generated for: ${prompt}. Please review and customize as needed.`,
      keyObjectives: [
        "Complete project planning",
        "Execute implementation",
        "Review and iterate",
      ],
      estimatedDuration: "1-2 weeks",
      requiredResources: ["Team members", "Project tools", "Time allocation"],
    };
  }

  private static hashPrompt(prompt: string): string {
    // Simple hash function for caching
    let hash = 0;
    for (let i = 0; i < prompt.length; i++) {
      const char = prompt.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private static estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private static async logGeneration(logData: any): Promise<void> {
    try {
      if (!logData.user_id) return; // Skip logging if no user ID

      const supabase = await createSupabaseServerClient();
      await supabase.from("ai_generation_logs").insert({
        project_id: null, // Will be set later when associated with a project
        prompt: logData.prompt,
        model: logData.model,
        tokens_used: logData.tokens_used,
        response_time_ms: logData.response_time_ms,
        success: logData.success,
        error_message: logData.error_message,
        generated_content: logData.generated_content,
        created_by: logData.user_id,
      });
    } catch (error) {
      console.error("Failed to log AI generation:", error);
      // Don't throw here - logging failure shouldn't break the main flow
    }
  }
}

// Rate limiting wrapper for AI requests
export class AIRateLimit {
  private static readonly MAX_REQUESTS_PER_HOUR = 100;
  private static readonly MAX_REQUESTS_PER_MINUTE = 20;

  static async checkRateLimit(userId: string): Promise<boolean> {
    const hourKey = `ai_rate_limit:hour:${userId}:${Math.floor(Date.now() / 3600000)}`;
    const minuteKey = `ai_rate_limit:minute:${userId}:${Math.floor(Date.now() / 60000)}`;

    const [hourlyCount, minuteCount] = await Promise.all([
      AppCache.increment(hourKey, 1),
      AppCache.increment(minuteKey, 1),
    ]);

    return (
      hourlyCount <= this.MAX_REQUESTS_PER_HOUR &&
      minuteCount <= this.MAX_REQUESTS_PER_MINUTE
    );
  }
}