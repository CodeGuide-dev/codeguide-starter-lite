-- Template System Schema Migration
-- This creates the database schema for templates, projects, and version history

-- Create template categories enum
CREATE TYPE template_category AS ENUM (
  'basic',
  'technical',
  'marketing',
  'business',
  'custom'
);

-- Create project status enum
CREATE TYPE project_status AS ENUM (
  'draft',
  'active',
  'completed',
  'archived'
);

-- Create templates table
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category template_category NOT NULL DEFAULT 'basic',
  is_public BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT false, -- System templates created by admins
  created_by TEXT, -- Clerk user ID, null for system templates
  template_data JSONB NOT NULL, -- JSON structure of the template
  preview_image TEXT, -- URL to preview image
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  user_id TEXT NOT NULL, -- Clerk user ID
  template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL,
  status project_status DEFAULT 'draft',
  content JSONB NOT NULL DEFAULT '{}', -- Current project content
  metadata JSONB DEFAULT '{}', -- Additional project metadata
  is_public BOOLEAN DEFAULT false,
  shared_with TEXT[] DEFAULT '{}', -- Array of user IDs who have access
  tags TEXT[] DEFAULT '{}',
  last_edited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project versions table for version history
CREATE TABLE IF NOT EXISTS public.project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  change_summary TEXT,
  created_by TEXT NOT NULL, -- Clerk user ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project collaborators table
CREATE TABLE IF NOT EXISTS public.project_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Clerk user ID
  role VARCHAR(50) DEFAULT 'collaborator', -- owner, collaborator, viewer
  permissions JSONB DEFAULT '{"read": true, "write": false, "admin": false}',
  invited_by TEXT NOT NULL, -- Clerk user ID
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) DEFAULT 'pending' -- pending, accepted, declined
);

-- Create template sections table for customizable sections
CREATE TABLE IF NOT EXISTS public.template_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  section_type VARCHAR(100) NOT NULL, -- text, list, table, image, etc.
  is_required BOOLEAN DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  default_content JSONB DEFAULT '{}',
  validation_rules JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project comments table
CREATE TABLE IF NOT EXISTS public.project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Clerk user ID
  content TEXT NOT NULL,
  section_id VARCHAR(255), -- Reference to specific section in project
  position JSONB, -- Position within section if applicable
  parent_id UUID REFERENCES public.project_comments(id) ON DELETE CASCADE, -- For threaded comments
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for templates
-- Anyone can read public templates and system templates
CREATE POLICY "Anyone can read public templates" ON public.templates
  FOR SELECT USING (is_public = true OR is_system = true);

-- Users can read their own private templates
CREATE POLICY "Users can read own templates" ON public.templates
  FOR SELECT USING (auth.jwt() ->> 'sub' = created_by);

-- Users can create templates (but not system templates)
CREATE POLICY "Users can create templates" ON public.templates
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'sub' = created_by AND 
    is_system = false
  );

-- Users can update their own templates
CREATE POLICY "Users can update own templates" ON public.templates
  FOR UPDATE USING (auth.jwt() ->> 'sub' = created_by);

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates" ON public.templates
  FOR DELETE USING (auth.jwt() ->> 'sub' = created_by);

-- RLS Policies for projects
-- Users can read their own projects
CREATE POLICY "Users can read own projects" ON public.projects
  FOR SELECT USING (auth.jwt() ->> 'sub' = user_id);

-- Users can read projects shared with them
CREATE POLICY "Users can read shared projects" ON public.projects
  FOR SELECT USING (auth.jwt() ->> 'sub' = ANY(shared_with));

-- Users can read public projects
CREATE POLICY "Anyone can read public projects" ON public.projects
  FOR SELECT USING (is_public = true);

-- Users can create their own projects
CREATE POLICY "Users can create own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);

-- Users can update their own projects
CREATE POLICY "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id);

-- Collaborators can update projects they have write access to
CREATE POLICY "Collaborators can update projects" ON public.projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = projects.id
        AND pc.user_id = auth.jwt() ->> 'sub'
        AND pc.status = 'accepted'
        AND (pc.permissions ->> 'write')::boolean = true
    )
  );

-- Users can delete their own projects
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.jwt() ->> 'sub' = user_id);

-- RLS Policies for project versions
-- Users can read versions of projects they have access to
CREATE POLICY "Users can read project versions" ON public.project_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_versions.project_id
        AND (
          p.user_id = auth.jwt() ->> 'sub' OR
          auth.jwt() ->> 'sub' = ANY(p.shared_with) OR
          p.is_public = true OR
          EXISTS (
            SELECT 1 FROM public.project_collaborators pc
            WHERE pc.project_id = p.id
              AND pc.user_id = auth.jwt() ->> 'sub'
              AND pc.status = 'accepted'
          )
        )
    )
  );

-- Users can create versions for projects they have write access to
CREATE POLICY "Users can create project versions" ON public.project_versions
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'sub' = created_by AND
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_versions.project_id
        AND (
          p.user_id = auth.jwt() ->> 'sub' OR
          EXISTS (
            SELECT 1 FROM public.project_collaborators pc
            WHERE pc.project_id = p.id
              AND pc.user_id = auth.jwt() ->> 'sub'
              AND pc.status = 'accepted'
              AND (pc.permissions ->> 'write')::boolean = true
          )
        )
    )
  );

-- RLS Policies for project collaborators
-- Project owners and collaborators can read collaborator info
CREATE POLICY "Project members can read collaborators" ON public.project_collaborators
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_collaborators.project_id
        AND (
          p.user_id = auth.jwt() ->> 'sub' OR
          EXISTS (
            SELECT 1 FROM public.project_collaborators pc
            WHERE pc.project_id = p.id
              AND pc.user_id = auth.jwt() ->> 'sub'
              AND pc.status = 'accepted'
          )
        )
    )
  );

-- Project owners can manage collaborators
CREATE POLICY "Project owners can manage collaborators" ON public.project_collaborators
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_collaborators.project_id
        AND p.user_id = auth.jwt() ->> 'sub'
    )
  );

-- Users can update their own collaboration status
CREATE POLICY "Users can update own collaboration status" ON public.project_collaborators
  FOR UPDATE USING (user_id = auth.jwt() ->> 'sub');

-- RLS Policies for template sections
-- Users can read sections of templates they have access to
CREATE POLICY "Users can read template sections" ON public.template_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.id = template_sections.template_id
        AND (
          t.is_public = true OR
          t.is_system = true OR
          t.created_by = auth.jwt() ->> 'sub'
        )
    )
  );

-- Users can manage sections of their own templates
CREATE POLICY "Users can manage own template sections" ON public.template_sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.templates t
      WHERE t.id = template_sections.template_id
        AND t.created_by = auth.jwt() ->> 'sub'
    )
  );

-- RLS Policies for project comments
-- Users can read comments on projects they have access to
CREATE POLICY "Users can read project comments" ON public.project_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_comments.project_id
        AND (
          p.user_id = auth.jwt() ->> 'sub' OR
          auth.jwt() ->> 'sub' = ANY(p.shared_with) OR
          p.is_public = true OR
          EXISTS (
            SELECT 1 FROM public.project_collaborators pc
            WHERE pc.project_id = p.id
              AND pc.user_id = auth.jwt() ->> 'sub'
              AND pc.status = 'accepted'
          )
        )
    )
  );

-- Users can create comments on projects they have access to
CREATE POLICY "Users can create project comments" ON public.project_comments
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'sub' = user_id AND
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_comments.project_id
        AND (
          p.user_id = auth.jwt() ->> 'sub' OR
          auth.jwt() ->> 'sub' = ANY(p.shared_with) OR
          EXISTS (
            SELECT 1 FROM public.project_collaborators pc
            WHERE pc.project_id = p.id
              AND pc.user_id = auth.jwt() ->> 'sub'
              AND pc.status = 'accepted'
          )
        )
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments" ON public.project_comments
  FOR UPDATE USING (user_id = auth.jwt() ->> 'sub');

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON public.project_comments
  FOR DELETE USING (user_id = auth.jwt() ->> 'sub');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_templates_category ON public.templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_is_public ON public.templates(is_public);
CREATE INDEX IF NOT EXISTS idx_templates_is_system ON public.templates(is_system);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON public.templates(created_by);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON public.templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_templates_created_at ON public.templates(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_template_id ON public.projects(template_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_is_public ON public.projects(is_public);
CREATE INDEX IF NOT EXISTS idx_projects_shared_with ON public.projects USING GIN(shared_with);
CREATE INDEX IF NOT EXISTS idx_projects_tags ON public.projects USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON public.projects(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON public.project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_created_at ON public.project_versions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_collaborators_project_id ON public.project_collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_user_id ON public.project_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_project_collaborators_status ON public.project_collaborators(status);

CREATE INDEX IF NOT EXISTS idx_template_sections_template_id ON public.template_sections(template_id);
CREATE INDEX IF NOT EXISTS idx_template_sections_order ON public.template_sections(order_index);

CREATE INDEX IF NOT EXISTS idx_project_comments_project_id ON public.project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_user_id ON public.project_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_parent_id ON public.project_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_created_at ON public.project_comments(created_at DESC);

-- Create updated_at triggers
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

-- Function to automatically create version on project update
CREATE OR REPLACE FUNCTION create_project_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create version if content actually changed
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO public.project_versions (project_id, version_number, content, created_by)
    VALUES (
      NEW.id,
      COALESCE((
        SELECT MAX(version_number) + 1
        FROM public.project_versions
        WHERE project_id = NEW.id
      ), 1),
      NEW.content,
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic versioning
CREATE TRIGGER project_versioning_trigger
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION create_project_version();

-- Insert some default system templates
INSERT INTO public.templates (name, description, category, is_public, is_system, template_data) VALUES
(
  'Basic Project Outline',
  'A simple project outline template for general use',
  'basic',
  true,
  true,
  '{
    "sections": [
      {
        "id": "overview",
        "name": "Project Overview",
        "type": "text",
        "required": true,
        "placeholder": "Describe your project goals and objectives..."
      },
      {
        "id": "scope",
        "name": "Project Scope",
        "type": "list",
        "required": true,
        "placeholder": "List the key deliverables and features..."
      },
      {
        "id": "timeline",
        "name": "Timeline & Milestones",
        "type": "table",
        "required": false,
        "columns": ["Milestone", "Due Date", "Status"]
      },
      {
        "id": "resources",
        "name": "Resources & Requirements",
        "type": "text",
        "required": false,
        "placeholder": "List required resources, team members, tools..."
      }
    ]
  }'
),
(
  'Technical Specification',
  'Template for technical project documentation',
  'technical',
  true,
  true,
  '{
    "sections": [
      {
        "id": "architecture",
        "name": "System Architecture",
        "type": "text",
        "required": true,
        "placeholder": "Describe the overall system architecture..."
      },
      {
        "id": "tech_stack",
        "name": "Technology Stack",
        "type": "list",
        "required": true,
        "placeholder": "List technologies, frameworks, and tools..."
      },
      {
        "id": "api_design",
        "name": "API Design",
        "type": "text",
        "required": false,
        "placeholder": "Document API endpoints and data structures..."
      },
      {
        "id": "database",
        "name": "Database Design",
        "type": "text",
        "required": false,
        "placeholder": "Describe database schema and relationships..."
      },
      {
        "id": "deployment",
        "name": "Deployment Strategy",
        "type": "text",
        "required": false,
        "placeholder": "Outline deployment process and infrastructure..."
      }
    ]
  }'
),
(
  'Marketing Campaign',
  'Template for marketing campaign planning',
  'marketing',
  true,
  true,
  '{
    "sections": [
      {
        "id": "objectives",
        "name": "Campaign Objectives",
        "type": "list",
        "required": true,
        "placeholder": "List specific, measurable campaign goals..."
      },
      {
        "id": "target_audience",
        "name": "Target Audience",
        "type": "text",
        "required": true,
        "placeholder": "Define your target demographic and personas..."
      },
      {
        "id": "strategy",
        "name": "Marketing Strategy",
        "type": "text",
        "required": true,
        "placeholder": "Outline your overall marketing approach..."
      },
      {
        "id": "channels",
        "name": "Marketing Channels",
        "type": "list",
        "required": true,
        "placeholder": "List channels: social media, email, advertising..."
      },
      {
        "id": "budget",
        "name": "Budget Allocation",
        "type": "table",
        "required": false,
        "columns": ["Channel", "Budget", "Expected ROI"]
      },
      {
        "id": "timeline",
        "name": "Campaign Timeline",
        "type": "table",
        "required": true,
        "columns": ["Activity", "Start Date", "End Date", "Owner"]
      }
    ]
  }'
);