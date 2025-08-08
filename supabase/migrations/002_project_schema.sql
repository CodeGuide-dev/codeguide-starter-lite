-- Project-specific database schema for CodeGuide application
-- This migration creates tables for templates, projects, and version management

-- Templates table for storing customizable templates
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL DEFAULT 'general',
  structure JSONB NOT NULL, -- Template structure and configuration
  default_sections JSONB NOT NULL DEFAULT '[]', -- Default sections for the template
  is_system BOOLEAN DEFAULT false, -- System templates cannot be deleted
  is_public BOOLEAN DEFAULT false, -- Public templates visible to all users
  created_by TEXT, -- Clerk user ID of creator (NULL for system templates)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table for user projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  content JSONB NOT NULL DEFAULT '{}', -- Project content and configuration
  settings JSONB NOT NULL DEFAULT '{}', -- Project-specific settings
  status VARCHAR(50) DEFAULT 'draft', -- draft, published, archived
  user_id TEXT NOT NULL, -- Clerk user ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project versions for version control
CREATE TABLE IF NOT EXISTS public.project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  change_summary TEXT,
  created_by TEXT NOT NULL, -- Clerk user ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project collaborators for shared projects
CREATE TABLE IF NOT EXISTS public.project_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Clerk user ID
  role VARCHAR(50) DEFAULT 'viewer', -- owner, editor, viewer
  invited_by TEXT NOT NULL, -- Clerk user ID of inviter
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Comments for project sections
CREATE TABLE IF NOT EXISTS public.project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  section_id VARCHAR(255), -- Reference to section in project content
  content TEXT NOT NULL,
  user_id TEXT NOT NULL, -- Clerk user ID
  parent_comment_id UUID REFERENCES public.project_comments(id) ON DELETE CASCADE,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI generation requests log
CREATE TABLE IF NOT EXISTS public.ai_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  user_id TEXT NOT NULL, -- Clerk user ID
  prompt TEXT NOT NULL,
  response JSONB,
  model_used VARCHAR(100),
  tokens_used INTEGER,
  processing_time_ms INTEGER,
  status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- File uploads associated with projects
CREATE TABLE IF NOT EXISTS public.project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  file_size BIGINT NOT NULL,
  file_type VARCHAR(100) NOT NULL,
  s3_key VARCHAR(500) NOT NULL,
  s3_url VARCHAR(500) NOT NULL,
  uploaded_by TEXT NOT NULL, -- Clerk user ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security on all new tables
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for templates table
-- Users can read public templates or their own templates
CREATE POLICY "Users can read accessible templates" ON public.templates
  FOR SELECT USING (
    is_public = true OR 
    is_system = true OR 
    auth.jwt() ->> 'sub' = created_by
  );

-- Users can create their own templates
CREATE POLICY "Users can create templates" ON public.templates
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'sub' = created_by AND
    is_system = false
  );

-- Users can update their own templates
CREATE POLICY "Users can update own templates" ON public.templates
  FOR UPDATE USING (
    auth.jwt() ->> 'sub' = created_by AND
    is_system = false
  );

-- Users can delete their own templates (not system templates)
CREATE POLICY "Users can delete own templates" ON public.templates
  FOR DELETE USING (
    auth.jwt() ->> 'sub' = created_by AND
    is_system = false
  );

-- RLS Policies for projects table
-- Users can read their own projects or projects they collaborate on
CREATE POLICY "Users can read accessible projects" ON public.projects
  FOR SELECT USING (
    auth.jwt() ->> 'sub' = user_id OR
    EXISTS (
      SELECT 1 FROM public.project_collaborators 
      WHERE project_id = public.projects.id 
      AND user_id = auth.jwt() ->> 'sub'
    )
  );

-- Users can create their own projects
CREATE POLICY "Users can create projects" ON public.projects
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);

-- Users can update their own projects or projects they can edit
CREATE POLICY "Users can update accessible projects" ON public.projects
  FOR UPDATE USING (
    auth.jwt() ->> 'sub' = user_id OR
    EXISTS (
      SELECT 1 FROM public.project_collaborators 
      WHERE project_id = public.projects.id 
      AND user_id = auth.jwt() ->> 'sub'
      AND role IN ('owner', 'editor')
    )
  );

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.jwt() ->> 'sub' = user_id);

-- RLS Policies for project_versions table
-- Users can read versions of projects they have access to
CREATE POLICY "Users can read accessible project versions" ON public.project_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = public.project_versions.project_id
      AND (
        user_id = auth.jwt() ->> 'sub' OR
        EXISTS (
          SELECT 1 FROM public.project_collaborators 
          WHERE project_id = public.projects.id 
          AND user_id = auth.jwt() ->> 'sub'
        )
      )
    )
  );

-- Users can create versions for projects they have access to
CREATE POLICY "Users can create versions for accessible projects" ON public.project_versions
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'sub' = created_by AND
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = public.project_versions.project_id
      AND (
        user_id = auth.jwt() ->> 'sub' OR
        EXISTS (
          SELECT 1 FROM public.project_collaborators 
          WHERE project_id = public.projects.id 
          AND user_id = auth.jwt() ->> 'sub'
          AND role IN ('owner', 'editor')
        )
      )
    )
  );

-- RLS Policies for project_collaborators table
-- Users can read collaborators of projects they have access to
CREATE POLICY "Users can read collaborators of accessible projects" ON public.project_collaborators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = public.project_collaborators.project_id
      AND (
        user_id = auth.jwt() ->> 'sub' OR
        EXISTS (
          SELECT 1 FROM public.project_collaborators pc2
          WHERE pc2.project_id = public.projects.id 
          AND pc2.user_id = auth.jwt() ->> 'sub'
        )
      )
    )
  );

-- Only project owners can manage collaborators
CREATE POLICY "Project owners can manage collaborators" ON public.project_collaborators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = public.project_collaborators.project_id
      AND user_id = auth.jwt() ->> 'sub'
    )
  );

-- RLS Policies for project_comments table
-- Users can read comments on projects they have access to
CREATE POLICY "Users can read comments on accessible projects" ON public.project_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = public.project_comments.project_id
      AND (
        user_id = auth.jwt() ->> 'sub' OR
        EXISTS (
          SELECT 1 FROM public.project_collaborators 
          WHERE project_id = public.projects.id 
          AND user_id = auth.jwt() ->> 'sub'
        )
      )
    )
  );

-- Users can create comments on projects they have access to
CREATE POLICY "Users can create comments on accessible projects" ON public.project_comments
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'sub' = user_id AND
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = public.project_comments.project_id
      AND (
        user_id = auth.jwt() ->> 'sub' OR
        EXISTS (
          SELECT 1 FROM public.project_collaborators 
          WHERE project_id = public.projects.id 
          AND user_id = auth.jwt() ->> 'sub'
        )
      )
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments" ON public.project_comments
  FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON public.project_comments
  FOR DELETE USING (auth.jwt() ->> 'sub' = user_id);

-- RLS Policies for ai_generations table
-- Users can only see their own AI generations
CREATE POLICY "Users can access own AI generations" ON public.ai_generations
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

-- RLS Policies for project_files table
-- Users can read files from projects they have access to
CREATE POLICY "Users can read files from accessible projects" ON public.project_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = public.project_files.project_id
      AND (
        user_id = auth.jwt() ->> 'sub' OR
        EXISTS (
          SELECT 1 FROM public.project_collaborators 
          WHERE project_id = public.projects.id 
          AND user_id = auth.jwt() ->> 'sub'
        )
      )
    )
  );

-- Users can upload files to projects they can edit
CREATE POLICY "Users can upload files to editable projects" ON public.project_files
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'sub' = uploaded_by AND
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = public.project_files.project_id
      AND (
        user_id = auth.jwt() ->> 'sub' OR
        EXISTS (
          SELECT 1 FROM public.project_collaborators 
          WHERE project_id = public.projects.id 
          AND user_id = auth.jwt() ->> 'sub'
          AND role IN ('owner', 'editor')
        )
      )
    )
  );

-- Users can delete files they uploaded
CREATE POLICY "Users can delete own uploaded files" ON public.project_files
  FOR DELETE USING (auth.jwt() ->> 'sub' = uploaded_by);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_templates_category ON public.templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON public.templates(created_by);
CREATE INDEX IF NOT EXISTS idx_templates_is_public ON public.templates(is_public);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_template_id ON public.projects(template_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON public.project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_created_at ON public.project_versions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_collaborators_project_id ON public.project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_user_id ON public.project_collaborators(user_id);

CREATE INDEX IF NOT EXISTS idx_project_comments_project_id ON public.project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_user_id ON public.project_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_section_id ON public.project_comments(section_id);

CREATE INDEX IF NOT EXISTS idx_ai_generations_user_id ON public.ai_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_project_id ON public.ai_generations(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_generations_created_at ON public.ai_generations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_project_files_uploaded_by ON public.project_files(uploaded_by);

-- Add updated_at triggers
CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_comments_updated_at
  BEFORE UPDATE ON public.project_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create first version when project is created
CREATE OR REPLACE FUNCTION create_initial_project_version()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.project_versions (project_id, version_number, content, settings, change_summary, created_by)
  VALUES (NEW.id, 1, NEW.content, NEW.settings, 'Initial version', NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to create initial version
CREATE TRIGGER create_initial_version_trigger
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION create_initial_project_version();

-- Insert default system templates
INSERT INTO public.templates (name, description, category, structure, default_sections, is_system, is_public) VALUES
(
  'Basic Template',
  'A simple template with basic sections for general use',
  'general',
  '{"sections": ["title", "description", "content"], "customizable": true}',
  '[
    {"id": "title", "name": "Title", "type": "text", "required": true},
    {"id": "description", "name": "Description", "type": "textarea", "required": false},
    {"id": "content", "name": "Content", "type": "richtext", "required": true}
  ]',
  true,
  true
),
(
  'Technical Document',
  'Template for technical documentation with sections for specifications, implementation, and testing',
  'technical',
  '{"sections": ["overview", "requirements", "architecture", "implementation", "testing"], "customizable": true}',
  '[
    {"id": "overview", "name": "Overview", "type": "richtext", "required": true},
    {"id": "requirements", "name": "Requirements", "type": "list", "required": true},
    {"id": "architecture", "name": "Architecture", "type": "richtext", "required": false},
    {"id": "implementation", "name": "Implementation", "type": "richtext", "required": true},
    {"id": "testing", "name": "Testing Strategy", "type": "richtext", "required": false}
  ]',
  true,
  true
),
(
  'Marketing Brief',
  'Template for marketing briefs with target audience, messaging, and campaign details',
  'marketing',
  '{"sections": ["objective", "audience", "messaging", "channels", "timeline", "budget"], "customizable": true}',
  '[
    {"id": "objective", "name": "Campaign Objective", "type": "richtext", "required": true},
    {"id": "audience", "name": "Target Audience", "type": "richtext", "required": true},
    {"id": "messaging", "name": "Key Messaging", "type": "richtext", "required": true},
    {"id": "channels", "name": "Marketing Channels", "type": "list", "required": false},
    {"id": "timeline", "name": "Timeline", "type": "richtext", "required": false},
    {"id": "budget", "name": "Budget Considerations", "type": "richtext", "required": false}
  ]',
  true,
  true
);