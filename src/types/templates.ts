// Template system types

export type TemplateCategory = 'basic' | 'technical' | 'marketing' | 'business' | 'custom';
export type ProjectStatus = 'draft' | 'active' | 'completed' | 'archived';
export type CollaboratorRole = 'owner' | 'collaborator' | 'viewer';
export type CollaboratorStatus = 'pending' | 'accepted' | 'declined';

export interface TemplateSection {
  id: string;
  name: string;
  type: 'text' | 'list' | 'table' | 'image' | 'markdown' | 'checkbox' | 'select';
  required: boolean;
  placeholder?: string;
  description?: string;
  options?: string[]; // For select type
  columns?: string[]; // For table type
  maxLength?: number; // For text type
  validation?: {
    pattern?: string;
    minItems?: number;
    maxItems?: number;
    required?: boolean;
  };
}

export interface TemplateData {
  sections: TemplateSection[];
  metadata?: {
    version?: string;
    author?: string;
    lastUpdated?: string;
    tags?: string[];
  };
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  category: TemplateCategory;
  is_public: boolean;
  is_system: boolean;
  created_by?: string;
  template_data: TemplateData;
  preview_image?: string;
  tags: string[];
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectContent {
  [sectionId: string]: {
    type: string;
    value?: any;
    lastModified?: string;
    modifiedBy?: string;
  };
}

export interface ProjectMetadata {
  lastExportedAt?: string;
  exportFormats?: string[];
  customFields?: Record<string, any>;
  settings?: {
    allowComments?: boolean;
    autoSave?: boolean;
    versioningEnabled?: boolean;
  };
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  template_id?: string;
  status: ProjectStatus;
  content: ProjectContent;
  metadata: ProjectMetadata;
  is_public: boolean;
  shared_with: string[];
  tags: string[];
  last_edited_at: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  content: ProjectContent;
  change_summary?: string;
  created_by: string;
  created_at: string;
}

export interface CollaboratorPermissions {
  read: boolean;
  write: boolean;
  admin: boolean;
  comment?: boolean;
  export?: boolean;
}

export interface ProjectCollaborator {
  id: string;
  project_id: string;
  user_id: string;
  role: CollaboratorRole;
  permissions: CollaboratorPermissions;
  invited_by: string;
  invited_at: string;
  accepted_at?: string;
  status: CollaboratorStatus;
}

export interface ProjectComment {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  section_id?: string;
  position?: {
    line?: number;
    character?: number;
    selection?: { start: number; end: number };
  };
  parent_id?: string;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
}

// API request/response types
export interface CreateTemplateRequest {
  name: string;
  description?: string;
  category: TemplateCategory;
  is_public?: boolean;
  template_data: TemplateData;
  preview_image?: string;
  tags?: string[];
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {
  id: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  template_id?: string;
  content?: ProjectContent;
  metadata?: ProjectMetadata;
  is_public?: boolean;
  tags?: string[];
}

export interface UpdateProjectRequest extends Partial<CreateProjectRequest> {
  id: string;
  status?: ProjectStatus;
  last_edited_at?: string;
}

export interface CreateCollaboratorRequest {
  project_id: string;
  user_id: string;
  role?: CollaboratorRole;
  permissions?: Partial<CollaboratorPermissions>;
}

export interface UpdateCollaboratorRequest {
  id: string;
  role?: CollaboratorRole;
  permissions?: Partial<CollaboratorPermissions>;
  status?: CollaboratorStatus;
}

export interface CreateCommentRequest {
  project_id: string;
  content: string;
  section_id?: string;
  position?: ProjectComment['position'];
  parent_id?: string;
}

export interface UpdateCommentRequest {
  id: string;
  content?: string;
  is_resolved?: boolean;
}

// Template validation types
export interface TemplateValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
}

export interface ProjectValidationResult {
  isValid: boolean;
  completionPercentage: number;
  missingRequired: string[];
  errors: Array<{
    sectionId: string;
    field: string;
    message: string;
  }>;
}

// Search and filter types
export interface TemplateSearchFilters {
  category?: TemplateCategory[];
  isPublic?: boolean;
  isSystem?: boolean;
  tags?: string[];
  createdBy?: string;
  search?: string;
}

export interface ProjectSearchFilters {
  status?: ProjectStatus[];
  templateId?: string;
  isPublic?: boolean;
  tags?: string[];
  sharedWith?: boolean;
  search?: string;
  dateRange?: {
    from: string;
    to: string;
  };
}

// Template builder types for UI
export interface TemplateBuilderSection extends TemplateSection {
  isEditing?: boolean;
  errors?: string[];
}

export interface TemplateBuilderState {
  name: string;
  description: string;
  category: TemplateCategory;
  is_public: boolean;
  sections: TemplateBuilderSection[];
  tags: string[];
  preview_image?: string;
  isDirty: boolean;
  isValid: boolean;
  errors: string[];
}

// Export types
export interface ExportTemplate {
  format: 'json' | 'yaml' | 'markdown';
  includeMetadata?: boolean;
  includeSystemInfo?: boolean;
}

export interface ExportProject {
  format: 'pdf' | 'docx' | 'markdown' | 'json';
  includeComments?: boolean;
  includeVersionHistory?: boolean;
  includeMetadata?: boolean;
  template?: {
    useCustomTemplate?: boolean;
    templateId?: string;
    customStyling?: Record<string, any>;
  };
}

// Real-time collaboration types
export interface CollaborationEvent {
  type: 'cursor_move' | 'content_change' | 'user_join' | 'user_leave' | 'comment_add' | 'comment_resolve';
  projectId: string;
  userId: string;
  timestamp: string;
  data: any;
}

export interface UserCursor {
  userId: string;
  userName: string;
  sectionId: string;
  position: number;
  color: string;
}

export interface ContentChange {
  sectionId: string;
  type: 'insert' | 'delete' | 'replace';
  position: number;
  content: any;
  userId: string;
  timestamp: string;
}