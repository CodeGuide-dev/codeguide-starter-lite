import { templateEngine, TemplateEngine, TemplateSchema } from '../template-engine';
import { createSupabaseServerClient } from '../supabase';
import { logger } from '../logger';

// Mock dependencies
jest.mock('../supabase');
jest.mock('../logger');

const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
  })),
};

const mockCreateSupabaseServerClient = createSupabaseServerClient as jest.MockedFunction<typeof createSupabaseServerClient>;

describe('TemplateEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSupabaseServerClient.mockResolvedValue(mockSupabaseClient as any);
  });

  describe('validateTemplate', () => {
    it('should validate a correct template schema', async () => {
      const validSchema: TemplateSchema = {
        title: 'Test Template',
        description: 'A test template',
        version: '1.0',
        category: 'business',
        sections: [
          {
            id: 'section1',
            title: 'Introduction',
            order: 1,
            required: true,
            type: 'text',
          },
          {
            id: 'section2',
            title: 'Analysis',
            order: 2,
            required: false,
            type: 'list',
          },
        ],
        metadata: {
          estimatedTime: '30 minutes',
          difficulty: 'intermediate',
          tags: ['business', 'strategy'],
        },
      };

      const result = await templateEngine.validateTemplate(validSchema);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('should detect duplicate section IDs', async () => {
      const invalidSchema: TemplateSchema = {
        title: 'Test Template',
        category: 'business',
        sections: [
          {
            id: 'duplicate',
            title: 'Section 1',
            order: 1,
            required: true,
            type: 'text',
          },
          {
            id: 'duplicate',
            title: 'Section 2',
            order: 2,
            required: true,
            type: 'text',
          },
        ],
      };

      const result = await templateEngine.validateTemplate(invalidSchema);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate section ID: duplicate');
    });

    it('should detect duplicate orders', async () => {
      const invalidSchema: TemplateSchema = {
        title: 'Test Template',
        category: 'business',
        sections: [
          {
            id: 'section1',
            title: 'Section 1',
            order: 1,
            required: true,
            type: 'text',
          },
          {
            id: 'section2',
            title: 'Section 2',
            order: 1, // Duplicate order
            required: true,
            type: 'text',
          },
        ],
      };

      const result = await templateEngine.validateTemplate(invalidSchema);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Section orders must be unique');
    });
  });

  describe('createTemplate', () => {
    it('should create a template successfully', async () => {
      const validSchema: TemplateSchema = {
        title: 'New Template',
        category: 'business',
        sections: [
          {
            id: 'section1',
            title: 'Introduction',
            order: 1,
            required: true,
            type: 'text',
          },
        ],
      };

      const mockTemplate = {
        id: 'template123',
        name: 'New Template',
        description: 'A new template',
        category: 'business',
        schema: validSchema,
        sections: { sections: validSchema.sections },
        user_id: 'user123',
        is_public: false,
        usage_count: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      // Mock no existing template
      mockSupabaseClient.from().select().eq().eq().single.mockResolvedValueOnce({ data: null, error: null });
      
      // Mock successful insert
      mockSupabaseClient.from().insert().select().single.mockResolvedValueOnce({ 
        data: mockTemplate, 
        error: null 
      });

      const result = await templateEngine.createTemplate(
        'New Template',
        'A new template',
        'business',
        validSchema,
        'user123',
        false
      );

      expect(result).toEqual(mockTemplate);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('templates');
    });

    it('should throw error for duplicate template name', async () => {
      const validSchema: TemplateSchema = {
        title: 'Duplicate Template',
        category: 'business',
        sections: [
          {
            id: 'section1',
            title: 'Introduction',
            order: 1,
            required: true,
            type: 'text',
          },
        ],
      };

      // Mock existing template
      mockSupabaseClient.from().select().eq().eq().single.mockResolvedValueOnce({ 
        data: { id: 'existing' }, 
        error: null 
      });

      await expect(
        templateEngine.createTemplate(
          'Duplicate Template',
          'A duplicate template',
          'business',
          validSchema,
          'user123',
          false
        )
      ).rejects.toThrow('Template with this name already exists');
    });
  });

  describe('customizeTemplate', () => {
    it('should customize template sections successfully', async () => {
      const mockTemplate = {
        id: 'template123',
        name: 'Original Template',
        schema: {
          title: 'Original Template',
          category: 'business',
          sections: [
            {
              id: 'section1',
              title: 'Introduction',
              order: 1,
              required: true,
              type: 'text' as const,
            },
            {
              id: 'section2',
              title: 'Analysis',
              order: 2,
              required: false,
              type: 'list' as const,
            },
          ],
        },
      };

      // Mock template retrieval
      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({ 
        data: mockTemplate, 
        error: null 
      });

      const customizations = {
        sectionCustomizations: {
          section1: { title: 'Custom Introduction', required: false },
        },
        reorderedSections: ['section2', 'section1'],
      };

      const result = await templateEngine.customizeTemplate(
        'template123',
        customizations,
        'user123'
      );

      expect(result.sections).toHaveLength(2);
      expect(result.sections[0].id).toBe('section2');
      expect(result.sections[0].order).toBe(1);
      expect(result.sections[1].id).toBe('section1');
      expect(result.sections[1].title).toBe('Custom Introduction');
      expect(result.sections[1].required).toBe(false);
    });
  });

  describe('searchTemplates', () => {
    it('should search templates successfully', async () => {
      const mockTemplates = [
        {
          id: 'template1',
          name: 'Business Plan Template',
          description: 'Template for business plans',
          category: 'business',
          is_public: true,
          usage_count: 10,
        },
      ];

      mockSupabaseClient.from().select().or().or().order().limit.mockResolvedValueOnce({ 
        data: mockTemplates, 
        error: null 
      });

      const result = await templateEngine.searchTemplates(
        'business',
        'business',
        'user123',
        10
      );

      expect(result).toEqual(mockTemplates);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('templates');
    });
  });

  describe('previewTemplate', () => {
    it('should generate template preview successfully', async () => {
      const mockTemplate = {
        id: 'template123',
        name: 'Test Template',
        schema: {
          title: 'Test Template',
          category: 'business',
          sections: [
            {
              id: 'section1',
              title: 'Introduction',
              order: 1,
              required: true,
              type: 'text' as const,
              subsections: [
                {
                  id: 'sub1',
                  title: 'Overview',
                  order: 1,
                  required: true,
                  type: 'text' as const,
                },
              ],
            },
          ],
          metadata: {
            estimatedTime: '45 minutes',
            difficulty: 'advanced' as const,
          },
        },
      };

      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({ 
        data: mockTemplate, 
        error: null 
      });

      const result = await templateEngine.previewTemplate('template123', 'user123');

      expect(result.template).toEqual(mockTemplate);
      expect(result.estimatedFields).toBe(2); // 1 section + 1 subsection
      expect(result.estimatedTime).toBe('45 minutes');
      expect(result.complexity).toBe('advanced');
    });
  });
});