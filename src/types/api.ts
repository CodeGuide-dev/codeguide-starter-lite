import { z } from 'zod';

// Common response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Request/Response schemas using Zod
export const CreateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  website: z.string().url().optional(),
  avatar_url: z.string().url().optional(),
  is_public: z.boolean().default(false),
});

export const UpdateProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  website: z.string().url().optional(),
  avatar_url: z.string().url().optional(),
  is_public: z.boolean().optional(),
});

export const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().max(10000).optional(),
});

export const UpdatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().max(10000).optional(),
});

export const CreateCommentSchema = z.object({
  post_id: z.string().uuid(),
  content: z.string().min(1).max(1000),
});

export const UpdateCommentSchema = z.object({
  content: z.string().min(1).max(1000),
});

export const CreateCollaborationSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  collaborators: z.array(z.string()).default([]),
});

export const UpdateCollaborationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  collaborators: z.array(z.string()).optional(),
});

export const FileUploadSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1),
  size: z.number().positive().max(10 * 1024 * 1024), // 10MB max
  isPublic: z.boolean().default(false),
  optimizeImage: z.boolean().default(false),
  maxWidth: z.number().positive().optional(),
  maxHeight: z.number().positive().optional(),
  quality: z.number().min(1).max(100).optional(),
});

// Template schemas
export const TemplateSectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['text', 'list', 'table', 'image', 'markdown', 'checkbox', 'select']),
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  description: z.string().optional(),
  options: z.array(z.string()).optional(),
  columns: z.array(z.string()).optional(),
  maxLength: z.number().positive().optional(),
  validation: z.object({
    pattern: z.string().optional(),
    minItems: z.number().min(0).optional(),
    maxItems: z.number().min(1).optional(),
    required: z.boolean().optional(),
  }).optional(),
});

export const TemplateDataSchema = z.object({
  sections: z.array(TemplateSectionSchema),
  metadata: z.object({
    version: z.string().optional(),
    author: z.string().optional(),
    lastUpdated: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

export const CreateTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  category: z.enum(['basic', 'technical', 'marketing', 'business', 'custom']),
  is_public: z.boolean().default(false),
  template_data: TemplateDataSchema,
  preview_image: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
});

export const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  category: z.enum(['basic', 'technical', 'marketing', 'business', 'custom']).optional(),
  is_public: z.boolean().optional(),
  template_data: TemplateDataSchema.optional(),
  preview_image: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
});

// Project schemas
export const ProjectContentSchema = z.record(z.object({
  type: z.string(),
  value: z.any(),
  lastModified: z.string().optional(),
  modifiedBy: z.string().optional(),
}));

export const ProjectMetadataSchema = z.object({
  lastExportedAt: z.string().optional(),
  exportFormats: z.array(z.string()).optional(),
  customFields: z.record(z.any()).optional(),
  settings: z.object({
    allowComments: z.boolean().optional(),
    autoSave: z.boolean().optional(),
    versioningEnabled: z.boolean().optional(),
  }).optional(),
});

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  template_id: z.string().uuid().optional(),
  content: ProjectContentSchema.optional(),
  metadata: ProjectMetadataSchema.optional(),
  is_public: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional(),
  template_id: z.string().uuid().optional(),
  content: ProjectContentSchema.optional(),
  metadata: ProjectMetadataSchema.optional(),
  is_public: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
});

export const PaginationSchema = z.object({
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(10),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Type inference from schemas
export type CreateProfileInput = z.infer<typeof CreateProfileSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>;
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
export type UpdateCommentInput = z.infer<typeof UpdateCommentSchema>;
export type CreateCollaborationInput = z.infer<typeof CreateCollaborationSchema>;
export type UpdateCollaborationInput = z.infer<typeof UpdateCollaborationSchema>;
export type FileUploadInput = z.infer<typeof FileUploadSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;

// WebSocket event types
export interface SocketEvent<T = any> {
  type: string;
  data: T;
  userId?: string;
  timestamp: string;
}

export interface CollaborationEvent extends SocketEvent {
  collaborationId: string;
  type: 'user_joined' | 'user_left' | 'content_changed' | 'comment_added' | 'cursor_moved';
}

export interface UserCursor {
  userId: string;
  userName: string;
  position: {
    line: number;
    character: number;
  };
  color: string;
}

// Rate limiting types
export interface RateLimitHeaders {
  'X-RateLimit-Limit': number;
  'X-RateLimit-Remaining': number;
  'X-RateLimit-Reset': string;
  'Retry-After'?: number;
}

// AI/LLM types
export interface AIPromptTemplate {
  id: string;
  name: string;
  template: string;
  variables: string[];
  category: 'outline' | 'summary' | 'enhancement' | 'custom';
}

export interface AIRequest {
  prompt: string;
  template?: string;
  variables?: Record<string, string>;
  model?: 'gpt-4' | 'gpt-3.5-turbo' | 'claude-3-sonnet' | 'claude-3-haiku';
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
}

// Export format types
export interface ExportOptions {
  format: 'pdf' | 'docx' | 'markdown' | 'html';
  template?: string;
  includeComments?: boolean;
  includeMetadata?: boolean;
  customStyling?: Record<string, any>;
}

export interface ExportResult {
  success: boolean;
  downloadUrl?: string;
  filename: string;
  size: number;
  error?: string;
}