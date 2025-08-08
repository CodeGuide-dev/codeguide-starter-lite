import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Database types
export interface Template {
  id: string;
  name: string;
  description?: string;
  category: string;
  structure: any;
  default_sections: any[];
  is_system: boolean;
  is_public: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  template_id?: string;
  content: any;
  settings: any;
  status: 'draft' | 'published' | 'archived';
  user_id: string;
  created_at: string;
  updated_at: string;
  template?: Template;
}

export interface ProjectVersion {
  id: string;
  project_id: string;
  version_number: number;
  content: any;
  settings: any;
  change_summary?: string;
  created_by: string;
  created_at: string;
}

export interface ProjectCollaborator {
  id: string;
  project_id: string;
  user_id: string;
  role: 'owner' | 'editor' | 'viewer';
  invited_by: string;
  created_at: string;
}

export interface ProjectComment {
  id: string;
  project_id: string;
  section_id?: string;
  content: string;
  user_id: string;
  parent_comment_id?: string;
  resolved: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIGeneration {
  id: string;
  project_id?: string;
  user_id: string;
  prompt: string;
  response?: any;
  model_used?: string;
  tokens_used?: number;
  processing_time_ms?: number;
  status: 'pending' | 'completed' | 'failed';
  error_message?: string;
  created_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  filename: string;
  file_size: number;
  file_type: string;
  s3_key: string;
  s3_url: string;
  uploaded_by: string;
  created_at: string;
}

// Template functions
export async function getTemplates(userId?: string) {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .or(`is_public.eq.true,is_system.eq.true${userId ? `,created_by.eq.${userId}` : ''}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as Template[];
}

export async function getTemplate(id: string) {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Template;
}

export async function createTemplate(template: Omit<Template, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('templates')
    .insert(template)
    .select()
    .single();

  if (error) throw error;
  return data as Template;
}

export async function updateTemplate(id: string, updates: Partial<Template>) {
  const { data, error } = await supabase
    .from('templates')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Template;
}

export async function deleteTemplate(id: string) {
  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function canAccessTemplate(templateId: string, userId?: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('templates')
    .select('is_public, is_system, created_by')
    .eq('id', templateId)
    .single();

  if (error || !data) return false;
  
  return data.is_public || data.is_system || data.created_by === userId;
}

// Project functions
export async function getProjects(userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      template:templates(*)
    `)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data as (Project & { template?: Template })[];
}

export async function getProject(id: string) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      template:templates(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Project & { template?: Template };
}

export async function createProject(project: Omit<Project, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('projects')
    .insert(project)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

export async function updateProject(id: string, updates: Partial<Project>) {
  const { data, error } = await supabase
    .from('projects')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Project;
}

export async function deleteProject(id: string) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Project version functions
export async function getProjectVersions(projectId: string) {
  const { data, error } = await supabase
    .from('project_versions')
    .select('*')
    .eq('project_id', projectId)
    .order('version_number', { ascending: false });

  if (error) throw error;
  return data as ProjectVersion[];
}

export async function createProjectVersion(version: Omit<ProjectVersion, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('project_versions')
    .insert(version)
    .select()
    .single();

  if (error) throw error;
  return data as ProjectVersion;
}

// Project collaborator functions
export async function getProjectCollaborators(projectId: string) {
  const { data, error } = await supabase
    .from('project_collaborators')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as ProjectCollaborator[];
}

export async function addCollaborator(
  projectId: string,
  userId: string,
  role: ProjectCollaborator['role'],
  invitedBy: string
) {
  const { data, error } = await supabase
    .from('project_collaborators')
    .insert({
      project_id: projectId,
      user_id: userId,
      role,
      invited_by: invitedBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data as ProjectCollaborator;
}

// Project comment functions
export async function getProjectComments(projectId: string, sectionId?: string) {
  let query = supabase
    .from('project_comments')
    .select('*')
    .eq('project_id', projectId);

  if (sectionId) {
    query = query.eq('section_id', sectionId);
  }

  const { data, error } = await query
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data as ProjectComment[];
}

export async function createComment(comment: Omit<ProjectComment, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('project_comments')
    .insert(comment)
    .select()
    .single();

  if (error) throw error;
  return data as ProjectComment;
}

// AI generation functions
export async function logAIGeneration(generation: Omit<AIGeneration, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('ai_generations')
    .insert(generation)
    .select()
    .single();

  if (error) throw error;
  return data as AIGeneration;
}

export async function updateAIGeneration(id: string, updates: Partial<AIGeneration>) {
  const { data, error } = await supabase
    .from('ai_generations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as AIGeneration;
}

// Project file functions
export async function getProjectFiles(projectId: string) {
  const { data, error } = await supabase
    .from('project_files')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as ProjectFile[];
}

export async function createProjectFile(file: Omit<ProjectFile, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('project_files')
    .insert(file)
    .select()
    .single();

  if (error) throw error;
  return data as ProjectFile;
}

// Utility function to check if user can access project
export async function canAccessProject(projectId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      user_id,
      project_collaborators!inner(user_id)
    `)
    .eq('id', projectId)
    .or(`user_id.eq.${userId},project_collaborators.user_id.eq.${userId}`)
    .limit(1);

  if (error) return false;
  return data.length > 0;
}