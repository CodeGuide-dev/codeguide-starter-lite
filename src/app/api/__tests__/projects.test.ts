import { NextRequest } from 'next/server';
import { GET, POST } from '../projects/route';
import { auth } from '@clerk/nextjs/server';
import { createSupabaseServerClient } from '@/lib/supabase';

// Mock the auth and supabase functions
jest.mock('@clerk/nextjs/server');
jest.mock('@/lib/supabase');

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockCreateSupabaseServerClient = createSupabaseServerClient as jest.MockedFunction<typeof createSupabaseServerClient>;

describe('/api/projects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null } as any);

      const request = new NextRequest('http://localhost:3000/api/projects');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Unauthorized');
    });

    it('should return projects for authenticated user', async () => {
      const mockUserId = 'test-user-123';
      mockAuth.mockResolvedValue({ userId: mockUserId } as any);

      const mockProjects = [
        {
          id: '1',
          title: 'Test Project',
          description: 'A test project',
          status: 'draft',
          is_public: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      const mockSupabase = {
        from: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          range: jest.fn(() => 
            Promise.resolve({ 
              data: mockProjects, 
              error: null, 
              count: mockProjects.length 
            })
          ),
        })),
      };

      mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest('http://localhost:3000/api/projects?page=1&limit=10');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.projects).toHaveLength(1);
      expect(data.data.projects[0].title).toBe('Test Project');
    });
  });

  describe('POST', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null } as any);

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: 'New Project',
          description: 'A new project',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Unauthorized');
    });

    it('should create a new project for authenticated user', async () => {
      const mockUserId = 'test-user-123';
      mockAuth.mockResolvedValue({ userId: mockUserId } as any);

      const mockProject = {
        id: '1',
        title: 'New Project',
        description: 'A new project',
        status: 'draft',
        user_id: mockUserId,
        is_public: false,
        content: {},
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const mockSupabase = {
        from: jest.fn(() => ({
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => 
                Promise.resolve({ 
                  data: mockProject, 
                  error: null 
                })
              ),
            })),
          })),
        })),
      };

      mockCreateSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          title: 'New Project',
          description: 'A new project',
          isPublic: false,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('New Project');
      expect(data.message).toBe('Project created successfully');
    });

    it('should return 400 for invalid data', async () => {
      const mockUserId = 'test-user-123';
      mockAuth.mockResolvedValue({ userId: mockUserId } as any);

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify({
          // Missing required title field
          description: 'A project without title',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Validation failed');
    });
  });
});