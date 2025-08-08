-- Project Outline Generation System Database Schema
-- Creates tables for projects, templates, outlines, and collaboration features

-- Templates table for storing reusable outline templates
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general', -- basic, technical, marketing, business, academic
  sections JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of section objects with title, description, required fields
  is_public BOOLEAN DEFAULT true,
  created_by TEXT, -- Clerk user ID (null for system templates)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Projects table for storing user projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  template_id UUID REFERENCES public.templates(id),
  owner_id TEXT NOT NULL, -- Clerk user ID
  collaborators TEXT[] DEFAULT '{}', -- Array of Clerk user IDs
  outline_data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Generated outline content
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'archived')),
  settings JSONB DEFAULT '{}'::jsonb, -- Project-specific settings
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project versions for version control
CREATE TABLE IF NOT EXISTS public.project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  outline_data JSONB NOT NULL,
  changes_summary TEXT,
  created_by TEXT NOT NULL, -- Clerk user ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments for collaboration
CREATE TABLE IF NOT EXISTS public.project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.project_comments(id) ON DELETE CASCADE,
  section_path TEXT, -- JSON path to the section being commented on
  content TEXT NOT NULL,
  author_id TEXT NOT NULL, -- Clerk user ID
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Export history
CREATE TABLE IF NOT EXISTS public.export_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  export_format TEXT NOT NULL CHECK (export_format IN ('pdf', 'docx', 'markdown')),
  file_url TEXT, -- S3 URL or local path
  file_size BIGINT,
  exported_by TEXT NOT NULL, -- Clerk user ID
  export_settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI generation logs for debugging and analytics
CREATE TABLE IF NOT EXISTS public.ai_generation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_used INTEGER,
  response_time_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  generated_content JSONB,
  created_by TEXT NOT NULL, -- Clerk user ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for templates
-- Anyone can read public templates
CREATE POLICY "Anyone can read public templates" ON public.templates
  FOR SELECT USING (is_public = true);

-- Users can read their own templates
CREATE POLICY "Users can read own templates" ON public.templates
  FOR SELECT USING (auth.jwt() ->> 'sub' = created_by);

-- Users can create templates
CREATE POLICY "Users can create templates" ON public.templates
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = created_by);

-- Users can update their own templates
CREATE POLICY "Users can update own templates" ON public.templates
  FOR UPDATE USING (auth.jwt() ->> 'sub' = created_by);

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates" ON public.templates
  FOR DELETE USING (auth.jwt() ->> 'sub' = created_by);

-- RLS Policies for projects
-- Project owners and collaborators can read projects
CREATE POLICY "Owners and collaborators can read projects" ON public.projects
  FOR SELECT USING (
    auth.jwt() ->> 'sub' = owner_id OR 
    auth.jwt() ->> 'sub' = ANY(collaborators)
  );

-- Only project owners can create projects
CREATE POLICY "Owners can create projects" ON public.projects
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = owner_id);

-- Owners and collaborators can update projects
CREATE POLICY "Owners and collaborators can update projects" ON public.projects
  FOR UPDATE USING (
    auth.jwt() ->> 'sub' = owner_id OR 
    auth.jwt() ->> 'sub' = ANY(collaborators)
  );

-- Only owners can delete projects
CREATE POLICY "Owners can delete projects" ON public.projects
  FOR DELETE USING (auth.jwt() ->> 'sub' = owner_id);

-- RLS Policies for project versions
-- Project owners and collaborators can read versions
CREATE POLICY "Project members can read versions" ON public.project_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_id 
      AND (p.owner_id = auth.jwt() ->> 'sub' OR auth.jwt() ->> 'sub' = ANY(p.collaborators))
    )
  );

-- Project members can create versions
CREATE POLICY "Project members can create versions" ON public.project_versions
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'sub' = created_by AND
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_id 
      AND (p.owner_id = auth.jwt() ->> 'sub' OR auth.jwt() ->> 'sub' = ANY(p.collaborators))
    )
  );

-- RLS Policies for comments
-- Project members can read comments
CREATE POLICY "Project members can read comments" ON public.project_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_id 
      AND (p.owner_id = auth.jwt() ->> 'sub' OR auth.jwt() ->> 'sub' = ANY(p.collaborators))
    )
  );

-- Project members can create comments
CREATE POLICY "Project members can create comments" ON public.project_comments
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'sub' = author_id AND
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_id 
      AND (p.owner_id = auth.jwt() ->> 'sub' OR auth.jwt() ->> 'sub' = ANY(p.collaborators))
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments" ON public.project_comments
  FOR UPDATE USING (auth.jwt() ->> 'sub' = author_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON public.project_comments
  FOR DELETE USING (auth.jwt() ->> 'sub' = author_id);

-- RLS Policies for export history
-- Project members can read export history
CREATE POLICY "Project members can read exports" ON public.export_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_id 
      AND (p.owner_id = auth.jwt() ->> 'sub' OR auth.jwt() ->> 'sub' = ANY(p.collaborators))
    )
  );

-- Users can create exports for projects they have access to
CREATE POLICY "Project members can create exports" ON public.export_history
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'sub' = exported_by AND
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_id 
      AND (p.owner_id = auth.jwt() ->> 'sub' OR auth.jwt() ->> 'sub' = ANY(p.collaborators))
    )
  );

-- RLS Policies for AI generation logs
-- Project members can read AI logs
CREATE POLICY "Project members can read ai logs" ON public.ai_generation_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_id 
      AND (p.owner_id = auth.jwt() ->> 'sub' OR auth.jwt() ->> 'sub' = ANY(p.collaborators))
    )
  );

-- Users can create AI logs for projects they have access to
CREATE POLICY "Project members can create ai logs" ON public.ai_generation_logs
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'sub' = created_by AND
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_id 
      AND (p.owner_id = auth.jwt() ->> 'sub' OR auth.jwt() ->> 'sub' = ANY(p.collaborators))
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_templates_category ON public.templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_public ON public.templates(is_public);
CREATE INDEX IF NOT EXISTS idx_templates_created_by ON public.templates(created_by);

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_collaborators ON public.projects USING GIN(collaborators);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON public.project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_created_at ON public.project_versions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_comments_project_id ON public.project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_parent ON public.project_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_author ON public.project_comments(author_id);

CREATE INDEX IF NOT EXISTS idx_export_history_project_id ON public.export_history(project_id);
CREATE INDEX IF NOT EXISTS idx_export_history_created_at ON public.export_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_project_id ON public.ai_generation_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_created_at ON public.ai_generation_logs(created_at DESC);

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

-- Insert default templates
INSERT INTO public.templates (name, description, category, sections, is_public, created_by) VALUES
(
  'Basic Project Outline',
  'A simple template for general project planning and documentation',
  'basic',
  '[
    {"title": "Executive Summary", "description": "High-level overview of the project", "required": true},
    {"title": "Project Goals", "description": "Clear objectives and success criteria", "required": true},
    {"title": "Timeline", "description": "Key milestones and deadlines", "required": true},
    {"title": "Resources", "description": "Required resources and team members", "required": false},
    {"title": "Risk Assessment", "description": "Potential challenges and mitigation strategies", "required": false},
    {"title": "Next Steps", "description": "Immediate action items", "required": true}
  ]'::jsonb,
  true,
  NULL
),
(
  'Technical Documentation',
  'Template for technical projects and software development',
  'technical',
  '[
    {"title": "Overview", "description": "Project description and technical summary", "required": true},
    {"title": "Architecture", "description": "System architecture and design patterns", "required": true},
    {"title": "Requirements", "description": "Functional and non-functional requirements", "required": true},
    {"title": "API Documentation", "description": "Endpoint specifications and examples", "required": false},
    {"title": "Database Schema", "description": "Data models and relationships", "required": false},
    {"title": "Testing Strategy", "description": "Unit, integration, and performance testing", "required": true},
    {"title": "Deployment", "description": "Environment setup and deployment process", "required": true}
  ]'::jsonb,
  true,
  NULL
),
(
  'Marketing Campaign',
  'Template for marketing campaign planning and execution',
  'marketing',
  '[
    {"title": "Campaign Overview", "description": "Campaign goals and target audience", "required": true},
    {"title": "Market Research", "description": "Audience analysis and competitive landscape", "required": true},
    {"title": "Strategy", "description": "Marketing channels and tactics", "required": true},
    {"title": "Content Plan", "description": "Content calendar and creative assets", "required": true},
    {"title": "Budget", "description": "Budget allocation and cost estimates", "required": true},
    {"title": "Metrics", "description": "KPIs and success measurements", "required": true},
    {"title": "Timeline", "description": "Campaign schedule and key dates", "required": true}
  ]'::jsonb,
  true,
  NULL
),
(
  'Business Plan',
  'Comprehensive business plan template',
  'business',
  '[
    {"title": "Executive Summary", "description": "Business overview and key points", "required": true},
    {"title": "Company Description", "description": "Mission, vision, and company background", "required": true},
    {"title": "Market Analysis", "description": "Industry and target market research", "required": true},
    {"title": "Organization & Management", "description": "Team structure and key personnel", "required": true},
    {"title": "Products/Services", "description": "Offerings and value proposition", "required": true},
    {"title": "Marketing & Sales", "description": "Customer acquisition and retention strategy", "required": true},
    {"title": "Financial Projections", "description": "Revenue forecasts and funding requirements", "required": true}
  ]'::jsonb,
  true,
  NULL
),
(
  'Research Paper',
  'Academic research and analysis template',
  'academic',
  '[
    {"title": "Abstract", "description": "Research summary and key findings", "required": true},
    {"title": "Introduction", "description": "Problem statement and research questions", "required": true},
    {"title": "Literature Review", "description": "Existing research and theoretical framework", "required": true},
    {"title": "Methodology", "description": "Research methods and data collection", "required": true},
    {"title": "Results", "description": "Findings and data analysis", "required": true},
    {"title": "Discussion", "description": "Interpretation and implications", "required": true},
    {"title": "Conclusion", "description": "Summary and future research directions", "required": true},
    {"title": "References", "description": "Bibliography and citations", "required": true}
  ]'::jsonb,
  true,
  NULL
);