import { outlineGenerator, OutlineGenerator } from '../openai';
import { rateLimiter } from '../redis';
import { createSupabaseServerClient } from '../supabase';
import { logger } from '../logger';
import { OpenAI } from 'openai';

// Mock dependencies
jest.mock('openai');
jest.mock('../redis');
jest.mock('../supabase');
jest.mock('../logger');

const mockOpenAI = {
  chat: {
    completions: {
      create: jest.fn(),
    },
  },
};

const mockRateLimiter = rateLimiter as jest.Mocked<typeof rateLimiter>;
const mockCreateSupabaseServerClient = createSupabaseServerClient as jest.MockedFunction<typeof createSupabaseServerClient>;

// Mock OpenAI constructor
(OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(() => mockOpenAI as any);

describe('OutlineGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock for rate limiting - allow requests
    mockRateLimiter.checkLimit.mockResolvedValue({ 
      allowed: true, 
      remaining: 10, 
      resetTime: Date.now() + 60000 
    });
  });

  describe('generateOutline', () => {
    it('should generate outline successfully without template', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Comprehensive Business Strategy',
              summary: 'A strategic business plan outline',
              sections: [
                {
                  id: 'section_1',
                  title: 'Executive Summary',
                  content: 'Overview of the business strategy and key objectives',
                  order: 1,
                  keyPoints: ['Strategic vision', 'Key objectives', 'Success metrics'],
                },
                {
                  id: 'section_2',
                  title: 'Market Analysis',
                  content: 'Detailed analysis of target market and competitive landscape',
                  order: 2,
                  keyPoints: ['Market size', 'Customer segments', 'Competitive analysis'],
                },
              ],
              metadata: {
                totalSections: 2,
                estimatedReadingTime: '15 minutes',
                keyTakeaways: ['Strategic focus', 'Market opportunity', 'Execution plan'],
              },
            }),
          },
        }],
        usage: {
          prompt_tokens: 150,
          completion_tokens: 300,
          total_tokens: 450,
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockCompletion);

      const mockSupabase = {
        from: jest.fn(() => ({
          insert: jest.fn(() => Promise.resolve({ error: null })),
        })),
      };
      mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = {
        prompt: 'Create a business strategy for a tech startup',
        userId: 'user123',
        requestId: 'req123',
      };

      const result = await outlineGenerator.generateOutline(request);

      expect(result.outline.title).toBe('Comprehensive Business Strategy');
      expect(result.outline.sections).toHaveLength(2);
      expect(result.outline.sections[0].title).toBe('Executive Summary');
      expect(result.usage.totalTokens).toBe(450);
      expect(result.usage.cost).toBeGreaterThan(0);
      expect(result.model).toBe('gpt-4-turbo');
    });

    it('should generate outline with template', async () => {
      const mockTemplate = {
        id: 'template123',
        name: 'Business Plan Template',
        description: 'Comprehensive business plan template',
        category: 'business',
        schema: {
          sections: [
            {
              id: 'executive_summary',
              title: 'Executive Summary',
              description: 'High-level overview',
              order: 1,
              required: true,
              type: 'text',
            },
            {
              id: 'market_analysis',
              title: 'Market Analysis',
              description: 'Market research and analysis',
              order: 2,
              required: true,
              type: 'text',
            },
          ],
          metadata: {
            difficulty: 'intermediate',
            estimatedTime: '2 hours',
            tags: ['business', 'strategy', 'planning'],
          },
        },
      };

      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn(() => Promise.resolve({ data: mockTemplate, error: null })),
          insert: jest.fn(() => Promise.resolve({ error: null })),
        })),
      };
      mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const mockCompletion = {
        choices: [{
          message: {
            content: JSON.stringify({
              title: 'Tech Startup Business Plan',
              summary: 'Comprehensive business plan for tech startup',
              sections: [
                {
                  id: 'executive_summary',
                  title: 'Executive Summary',
                  content: 'Executive summary tailored to tech startup context',
                  order: 1,
                  keyPoints: ['Vision', 'Mission', 'Key objectives'],
                },
              ],
            }),
          },
        }],
        usage: {
          prompt_tokens: 200,
          completion_tokens: 400,
          total_tokens: 600,
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockCompletion);

      const request = {
        prompt: 'Create a business plan for an AI-powered SaaS platform',
        templateId: 'template123',
        userId: 'user123',
        requestId: 'req123',
      };

      const result = await outlineGenerator.generateOutline(request);

      expect(result.outline.title).toBe('Tech Startup Business Plan');
      expect(result.outline.sections[0].id).toBe('executive_summary');
      expect(result.usage.totalTokens).toBe(600);
    });

    it('should handle rate limiting', async () => {
      mockRateLimiter.checkLimit
        .mockResolvedValueOnce({ allowed: false, remaining: 0, resetTime: Date.now() + 60000 }) // minute limit
        .mockResolvedValueOnce({ allowed: true, remaining: 50, resetTime: Date.now() + 3600000 }) // hour limit
        .mockResolvedValueOnce({ allowed: true, remaining: 500, resetTime: Date.now() + 86400000 }); // day limit

      const request = {
        prompt: 'Create a business strategy',
        userId: 'user123',
        requestId: 'req123',
      };

      await expect(outlineGenerator.generateOutline(request)).rejects.toThrow('Rate limit exceeded: 10 requests per minute');
    });

    it('should handle OpenAI API errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValueOnce({
        status: 429,
        message: 'Rate limit exceeded',
      });

      const request = {
        prompt: 'Create a business strategy',
        userId: 'user123',
        requestId: 'req123',
      };

      await expect(outlineGenerator.generateOutline(request)).rejects.toThrow('AI service is currently busy');
    });

    it('should handle invalid JSON response', async () => {
      const mockCompletion = {
        choices: [{
          message: {
            content: 'Invalid JSON response',
          },
        }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
        },
      };

      mockOpenAI.chat.completions.create.mockResolvedValueOnce(mockCompletion);

      const mockSupabase = {
        from: jest.fn(() => ({
          insert: jest.fn(() => Promise.resolve({ error: null })),
        })),
      };
      mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = {
        prompt: 'Create a business strategy',
        userId: 'user123',
        requestId: 'req123',
      };

      await expect(outlineGenerator.generateOutline(request)).rejects.toThrow('Invalid response format from AI service');
    });
  });

  describe('content type analysis', () => {
    it('should identify business content type', () => {
      const generator = new OutlineGenerator();
      const contentType = (generator as any).analyzeContentType('Create a business plan for my startup company');
      expect(contentType).toBe('business');
    });

    it('should identify technical content type', () => {
      const generator = new OutlineGenerator();
      const contentType = (generator as any).analyzeContentType('Design the software architecture for our API system');
      expect(contentType).toBe('technical');
    });

    it('should identify academic content type', () => {
      const generator = new OutlineGenerator();
      const contentType = (generator as any).analyzeContentType('Write a research paper on machine learning methodology');
      expect(contentType).toBe('academic');
    });

    it('should identify personal content type', () => {
      const generator = new OutlineGenerator();
      const contentType = (generator as any).analyzeContentType('Create a personal development plan to improve my career');
      expect(contentType).toBe('personal');
    });

    it('should default to business for ambiguous content', () => {
      const generator = new OutlineGenerator();
      const contentType = (generator as any).analyzeContentType('Create an outline for something');
      expect(contentType).toBe('business');
    });
  });

  describe('prompt building', () => {
    it('should build enhanced prompt with template context', () => {
      const generator = new OutlineGenerator();
      const template = {
        name: 'Business Plan Template',
        category: 'business',
        description: 'Comprehensive business plan',
        schema: {
          sections: [
            {
              id: 'exec_summary',
              title: 'Executive Summary',
              description: 'High-level overview',
              order: 1,
              required: true,
              subsections: [
                {
                  id: 'vision',
                  title: 'Vision Statement',
                  description: 'Company vision',
                  order: 1,
                }
              ]
            }
          ],
          metadata: {
            difficulty: 'intermediate',
            estimatedTime: '2 hours',
            tags: ['business', 'strategy']
          }
        }
      };

      const request = {
        prompt: 'Create a business plan for AI startup',
        userId: 'user123',
        requestId: 'req123',
      };

      const prompt = (generator as any).buildPrompt(request, template);

      expect(prompt).toContain('TEMPLATE STRUCTURE TO FOLLOW');
      expect(prompt).toContain('Business Plan Template');
      expect(prompt).toContain('Executive Summary');
      expect(prompt).toContain('Target difficulty level: intermediate');
      expect(prompt).toContain('Estimated completion time: 2 hours');
      expect(prompt).toContain('Focus areas: business, strategy');
      expect(prompt).toContain('BUSINESS CONTEXT INSTRUCTIONS');
    });

    it('should build prompt with custom sections', () => {
      const generator = new OutlineGenerator();
      const request = {
        prompt: 'Create a technical document',
        customSections: ['Introduction', 'Architecture', 'Implementation'],
        userId: 'user123',
        requestId: 'req123',
      };

      const prompt = (generator as any).buildPrompt(request);

      expect(prompt).toContain('CUSTOM SECTIONS TO INCLUDE');
      expect(prompt).toContain('1. Introduction');
      expect(prompt).toContain('2. Architecture');
      expect(prompt).toContain('3. Implementation');
      expect(prompt).toContain('TECHNICAL CONTEXT INSTRUCTIONS');
    });
  });
});