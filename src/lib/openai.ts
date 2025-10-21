import { OpenAI } from "openai";
import { rateLimiter, apiRequestQueue } from "./redis";
import { logger, AppError } from "./logger";
import { createSupabaseServerClient } from "./supabase";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting configuration
const RATE_LIMITS = {
  PER_USER_MINUTE: 10,     // 10 requests per minute per user
  PER_USER_HOUR: 100,      // 100 requests per hour per user
  PER_USER_DAY: 1000,      // 1000 requests per day per user
};

// Token and cost tracking
const MODEL_COSTS = {
  'gpt-4': { input: 0.03, output: 0.06 }, // per 1K tokens
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
};

export interface OutlineGenerationRequest {
  prompt: string;
  templateId?: string;
  userId: string;
  requestId: string;
  customSections?: string[];
}

export interface OutlineGenerationResponse {
  outline: {
    title: string;
    sections: Array<{
      id: string;
      title: string;
      content: string;
      order: number;
      subsections?: Array<{
        id: string;
        title: string;
        content: string;
        order: number;
      }>;
    }>;
  };
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
  model: string;
}

class OutlineGenerator {
  async checkRateLimit(userId: string): Promise<void> {
    // Check multiple rate limits
    const [minuteLimit, hourLimit, dayLimit] = await Promise.all([
      rateLimiter.checkLimit(`user:${userId}:minute`, 60 * 1000, RATE_LIMITS.PER_USER_MINUTE),
      rateLimiter.checkLimit(`user:${userId}:hour`, 60 * 60 * 1000, RATE_LIMITS.PER_USER_HOUR),
      rateLimiter.checkLimit(`user:${userId}:day`, 24 * 60 * 60 * 1000, RATE_LIMITS.PER_USER_DAY),
    ]);

    if (!minuteLimit.allowed) {
      throw new AppError(
        `Rate limit exceeded: ${RATE_LIMITS.PER_USER_MINUTE} requests per minute`,
        429,
        true,
        userId
      );
    }

    if (!hourLimit.allowed) {
      throw new AppError(
        `Rate limit exceeded: ${RATE_LIMITS.PER_USER_HOUR} requests per hour`,
        429,
        true,
        userId
      );
    }

    if (!dayLimit.allowed) {
      throw new AppError(
        `Rate limit exceeded: ${RATE_LIMITS.PER_USER_DAY} requests per day`,
        429,
        true,
        userId
      );
    }
  }

  async getTemplate(templateId: string): Promise<any> {
    const supabase = await createSupabaseServerClient();
    const { data: template, error } = await supabase
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !template) {
      throw new AppError(`Template not found: ${templateId}`, 404);
    }

    return template;
  }

  private buildPrompt(request: OutlineGenerationRequest, template?: any): string {
    let prompt = `Generate a comprehensive, professional outline for: "${request.prompt}"\n\n`;

    // Context and template integration
    if (template) {
      prompt += `TEMPLATE STRUCTURE TO FOLLOW:\n`;
      prompt += `Template: ${template.name}\n`;
      prompt += `Category: ${template.category}\n`;
      prompt += `Description: ${template.description}\n\n`;
      
      if (template.schema?.sections) {
        prompt += `Required sections (in order):\n`;
        template.schema.sections
          .sort((a: any, b: any) => a.order - b.order)
          .forEach((section: any) => {
            prompt += `${section.order}. ${section.title}`;
            if (section.description) prompt += ` - ${section.description}`;
            if (section.required) prompt += ` [REQUIRED]`;
            prompt += `\n`;
            
            if (section.subsections?.length) {
              section.subsections.forEach((sub: any) => {
                prompt += `   - ${sub.title}`;
                if (sub.description) prompt += ` (${sub.description})`;
                prompt += `\n`;
              });
            }
          });
        prompt += `\n`;
      }
      
      // Add template-specific guidance
      if (template.schema?.metadata) {
        const meta = template.schema.metadata;
        if (meta.difficulty) {
          prompt += `Target difficulty level: ${meta.difficulty}\n`;
        }
        if (meta.estimatedTime) {
          prompt += `Estimated completion time: ${meta.estimatedTime}\n`;
        }
        if (meta.tags?.length) {
          prompt += `Focus areas: ${meta.tags.join(', ')}\n`;
        }
        prompt += `\n`;
      }
    } else if (request.customSections?.length) {
      prompt += `CUSTOM SECTIONS TO INCLUDE:\n`;
      request.customSections.forEach((section, index) => {
        prompt += `${index + 1}. ${section}\n`;
      });
      prompt += `\n`;
    }

    // Specific instructions based on content analysis
    const contentType = this.analyzeContentType(request.prompt);
    prompt += this.getContentTypeInstructions(contentType);

    prompt += `\nGENERATION REQUIREMENTS:
1. Create a compelling, specific title that accurately reflects the content
2. Generate detailed, actionable content for each section (not just headings)
3. Ensure logical flow and coherent structure
4. Include specific examples, key points, and actionable insights where appropriate
5. Maintain professional tone and clarity
6. Each section should have substantive content (50-200 words)
7. Use relevant industry terminology and best practices

OUTPUT FORMAT (JSON):
{
  "title": "Compelling and Specific Title Here",
  "summary": "Brief 2-3 sentence overview of what this outline covers",
  "sections": [
    {
      "id": "section_1",
      "title": "Clear Section Title",
      "content": "Detailed, substantive content with specific points, examples, and actionable insights. This should be comprehensive and valuable.",
      "order": 1,
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
      "subsections": [
        {
          "id": "subsection_1_1",
          "title": "Specific Subsection Title",
          "content": "Detailed subsection content with examples and specifics",
          "order": 1,
          "keyPoints": ["Specific point 1", "Specific point 2"]
        }
      ]
    }
  ],
  "metadata": {
    "totalSections": 0,
    "estimatedReadingTime": "X minutes",
    "keyTakeaways": ["Main takeaway 1", "Main takeaway 2", "Main takeaway 3"]
  }
}`;

    return prompt;
  }

  private analyzeContentType(prompt: string): string {
    const businessKeywords = ['business', 'strategy', 'market', 'revenue', 'plan', 'startup', 'company'];
    const technicalKeywords = ['technical', 'software', 'system', 'api', 'architecture', 'development', 'code'];
    const academicKeywords = ['research', 'study', 'analysis', 'academic', 'thesis', 'paper', 'methodology'];
    const personalKeywords = ['personal', 'goal', 'self', 'improve', 'habit', 'life', 'career'];

    const lowerPrompt = prompt.toLowerCase();
    
    const scores = {
      business: businessKeywords.reduce((sum, word) => sum + (lowerPrompt.includes(word) ? 1 : 0), 0),
      technical: technicalKeywords.reduce((sum, word) => sum + (lowerPrompt.includes(word) ? 1 : 0), 0),
      academic: academicKeywords.reduce((sum, word) => sum + (lowerPrompt.includes(word) ? 1 : 0), 0),
      personal: personalKeywords.reduce((sum, word) => sum + (lowerPrompt.includes(word) ? 1 : 0), 0),
    };

    return Object.entries(scores).reduce((max, [type, score]) => 
      score > scores[max as keyof typeof scores] ? type : max, 'business'
    );
  }

  private getContentTypeInstructions(contentType: string): string {
    const instructions = {
      business: `BUSINESS CONTEXT INSTRUCTIONS:
- Focus on strategic value, market implications, and business outcomes
- Include competitive analysis, market opportunities, and risk assessment
- Provide actionable business recommendations and next steps
- Consider stakeholder perspectives and ROI implications
- Use business terminology and industry best practices

`,
      technical: `TECHNICAL CONTEXT INSTRUCTIONS:
- Emphasize technical specifications, implementation details, and architecture
- Include system requirements, dependencies, and technical constraints
- Provide code examples, technical diagrams, and integration points
- Consider scalability, performance, and security implications
- Use precise technical language and industry standards

`,
      academic: `ACADEMIC CONTEXT INSTRUCTIONS:
- Structure content with clear methodology and evidence-based approach
- Include literature review, theoretical framework, and research methods
- Provide citations, references, and scholarly analysis
- Consider peer review standards and academic rigor
- Use formal academic tone and proper research methodology

`,
      personal: `PERSONAL DEVELOPMENT INSTRUCTIONS:
- Focus on practical application, personal growth, and actionable steps
- Include self-reflection questions, progress tracking, and milestones
- Provide motivational elements and real-world examples
- Consider individual circumstances and personal goals
- Use encouraging, supportive tone with practical guidance

`,
    };

    return instructions[contentType as keyof typeof instructions] || instructions.business;
  }

  private calculateCost(usage: any, model: string): number {
    const costs = MODEL_COSTS[model as keyof typeof MODEL_COSTS];
    if (!costs) return 0;

    const inputCost = (usage.prompt_tokens / 1000) * costs.input;
    const outputCost = (usage.completion_tokens / 1000) * costs.output;
    return inputCost + outputCost;
  }

  async generateOutline(request: OutlineGenerationRequest): Promise<OutlineGenerationResponse> {
    try {
      // Check rate limits
      await this.checkRateLimit(request.userId);

      // Get template if specified
      let template = null;
      if (request.templateId) {
        template = await this.getTemplate(request.templateId);
      }

      // Build the prompt
      const prompt = this.buildPrompt(request, template);

      logger.info('Generating outline', {
        userId: request.userId,
        templateId: request.templateId,
        promptLength: prompt.length,
      }, request.userId, request.requestId);

      // Generate outline using OpenAI
      const model = 'gpt-4-turbo';
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional content strategist and writer. Generate well-structured, comprehensive outlines that are actionable and valuable.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: "json_object" }
      });

      const usage = completion.usage;
      if (!usage) {
        throw new AppError('No usage data returned from OpenAI', 500);
      }

      const cost = this.calculateCost(usage, model);

      // Parse the generated outline
      const outlineText = completion.choices[0].message.content;
      if (!outlineText) {
        throw new AppError('No content generated by OpenAI', 500);
      }

      let outline;
      try {
        outline = JSON.parse(outlineText);
      } catch (parseError) {
        logger.error('Failed to parse OpenAI response', {
          error: parseError,
          response: outlineText,
        }, request.userId, request.requestId);
        throw new AppError('Invalid response format from AI service', 500);
      }

      // Log API usage for tracking
      await this.logApiUsage(request.userId, 'outline_generation', usage, cost);

      const response: OutlineGenerationResponse = {
        outline,
        usage: {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
          cost,
        },
        model,
      };

      logger.info('Outline generated successfully', {
        userId: request.userId,
        tokensUsed: usage.total_tokens,
        cost,
        sectionsGenerated: outline.sections?.length || 0,
      }, request.userId, request.requestId);

      return response;

    } catch (error) {
      logger.error('Outline generation failed', {
        error,
        userId: request.userId,
        templateId: request.templateId,
      }, request.userId, request.requestId);

      if (error instanceof AppError) {
        throw error;
      }

      // Handle OpenAI specific errors
      if (error instanceof Error && 'status' in error) {
        const apiError = error as any;
        if (apiError.status === 429) {
          throw new AppError('AI service is currently busy. Please try again later.', 429);
        }
        if (apiError.status === 401) {
          throw new AppError('AI service authentication failed', 500);
        }
      }

      throw new AppError('Failed to generate outline', 500);
    }
  }

  private async logApiUsage(
    userId: string, 
    endpoint: string, 
    usage: any, 
    cost: number
  ): Promise<void> {
    try {
      const supabase = await createSupabaseServerClient();
      await supabase.from('api_usage').insert({
        user_id: userId,
        endpoint,
        tokens_used: usage.total_tokens,
        request_count: 1,
        cost,
      });
    } catch (error) {
      logger.error('Failed to log API usage', { error, userId });
    }
  }

  async queueGeneration(request: OutlineGenerationRequest): Promise<string> {
    const jobId = `outline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await apiRequestQueue.enqueue('outline_generation', {
      ...request,
      jobId,
    });

    return jobId;
  }
}

export const outlineGenerator = new OutlineGenerator();

// Queue processor for handling background jobs
export class OutlineQueueProcessor {
  private isProcessing = false;

  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;

    try {
      const job = await apiRequestQueue.dequeue('outline_generation');
      if (!job) {
        this.isProcessing = false;
        return;
      }

      logger.info('Processing outline generation job', { jobId: job.id });

      const result = await outlineGenerator.generateOutline(job.data);
      
      // Store result (could be in database or cache)
      // For now, we'll log it
      logger.info('Outline generation job completed', { 
        jobId: job.id, 
        tokensUsed: result.usage.totalTokens 
      });

    } catch (error) {
      logger.error('Queue processing error', { error });
    } finally {
      this.isProcessing = false;
    }
  }

  startProcessing(intervalMs: number = 5000): void {
    setInterval(() => {
      this.processQueue();
    }, intervalMs);
  }
}

export const queueProcessor = new OutlineQueueProcessor();