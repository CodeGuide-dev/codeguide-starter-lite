-- Project and Template System Tables for CodeGuide
-- This migration creates the core tables for project management and template system

-- Create enum types for project status and template categories
CREATE TYPE project_status AS ENUM ('draft', 'in_progress', 'completed', 'archived');
CREATE TYPE template_category AS ENUM ('business', 'technical', 'academic', 'personal', 'custom');

-- Projects table for storing user projects
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content JSONB DEFAULT '{}', -- Stores the generated outline and content
  template_id UUID, -- References templates table
  status project_status DEFAULT 'draft',
  user_id TEXT NOT NULL, -- Clerk user ID
  is_public BOOLEAN DEFAULT false,
  collaborators TEXT[] DEFAULT '{}', -- Array of Clerk user IDs
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Templates table for storing outline templates
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category template_category DEFAULT 'custom',
  schema JSONB NOT NULL, -- JSON schema defining the template structure
  sections JSONB DEFAULT '{}', -- Template sections and their configuration
  is_public BOOLEAN DEFAULT false,
  user_id TEXT NOT NULL, -- Clerk user ID of template creator
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Project versions table for version history tracking
CREATE TABLE IF NOT EXISTS public.project_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL, -- Snapshot of project content at this version
  changes_summary TEXT,
  user_id TEXT NOT NULL, -- Clerk user ID who created this version
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments table for section-level commenting
CREATE TABLE IF NOT EXISTS public.project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  section_id TEXT NOT NULL, -- Identifies which section this comment is for
  content TEXT NOT NULL,
  parent_comment_id UUID REFERENCES public.project_comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Clerk user ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API usage tracking for rate limiting and analytics
CREATE TABLE IF NOT EXISTS public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, -- Clerk user ID
  endpoint TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  request_count INTEGER DEFAULT 1,
  cost DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies for projects table
-- Users can read public projects or projects they own/collaborate on
CREATE POLICY "Users can read accessible projects" ON public.projects
  FOR SELECT USING (
    is_public = true OR 
    auth.jwt() ->> 'sub' = user_id OR 
    auth.jwt() ->> 'sub' = ANY(collaborators)
  );

-- Users can insert their own projects
CREATE POLICY "Users can insert own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);

-- Users can update projects they own or collaborate on
CREATE POLICY "Users can update accessible projects" ON public.projects
  FOR UPDATE USING (
    auth.jwt() ->> 'sub' = user_id OR 
    auth.jwt() ->> 'sub' = ANY(collaborators)
  );

-- Only owners can delete projects
CREATE POLICY "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.jwt() ->> 'sub' = user_id);

-- RLS Policies for templates table
-- Users can read public templates or their own templates
CREATE POLICY "Users can read accessible templates" ON public.templates
  FOR SELECT USING (
    is_public = true OR auth.jwt() ->> 'sub' = user_id
  );

-- Users can insert their own templates
CREATE POLICY "Users can insert own templates" ON public.templates
  FOR INSERT WITH CHECK (auth.jwt() ->> 'sub' = user_id);

-- Users can update their own templates
CREATE POLICY "Users can update own templates" ON public.templates
  FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id);

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates" ON public.templates
  FOR DELETE USING (auth.jwt() ->> 'sub' = user_id);

-- RLS Policies for project_versions table
-- Users can read versions of projects they have access to
CREATE POLICY "Users can read accessible project versions" ON public.project_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_id AND (
        p.is_public = true OR 
        auth.jwt() ->> 'sub' = p.user_id OR 
        auth.jwt() ->> 'sub' = ANY(p.collaborators)
      )
    )
  );

-- Users can insert versions for projects they have access to
CREATE POLICY "Users can insert accessible project versions" ON public.project_versions
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'sub' = user_id AND
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_id AND (
        auth.jwt() ->> 'sub' = p.user_id OR 
        auth.jwt() ->> 'sub' = ANY(p.collaborators)
      )
    )
  );

-- RLS Policies for project_comments table
-- Users can read comments on projects they have access to
CREATE POLICY "Users can read accessible project comments" ON public.project_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_id AND (
        p.is_public = true OR 
        auth.jwt() ->> 'sub' = p.user_id OR 
        auth.jwt() ->> 'sub' = ANY(p.collaborators)
      )
    )
  );

-- Users can insert comments on projects they have access to
CREATE POLICY "Users can insert accessible project comments" ON public.project_comments
  FOR INSERT WITH CHECK (
    auth.jwt() ->> 'sub' = user_id AND
    EXISTS (
      SELECT 1 FROM public.projects p 
      WHERE p.id = project_id AND (
        auth.jwt() ->> 'sub' = p.user_id OR 
        auth.jwt() ->> 'sub' = ANY(p.collaborators)
      )
    )
  );

-- Users can update their own comments
CREATE POLICY "Users can update own comments" ON public.project_comments
  FOR UPDATE USING (auth.jwt() ->> 'sub' = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments" ON public.project_comments
  FOR DELETE USING (auth.jwt() ->> 'sub' = user_id);

-- RLS Policies for api_usage table
-- Users can only see their own API usage
CREATE POLICY "Users can access own api usage" ON public.api_usage
  FOR ALL USING (auth.jwt() ->> 'sub' = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON public.projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_collaborators ON public.projects USING GIN(collaborators);
CREATE INDEX IF NOT EXISTS idx_templates_category ON public.templates(category);
CREATE INDEX IF NOT EXISTS idx_templates_user_id ON public.templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_usage ON public.templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_project_versions_project_id ON public.project_versions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_versions_created_at ON public.project_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_comments_project_id ON public.project_comments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_comments_section_id ON public.project_comments(section_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON public.api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON public.api_usage(created_at DESC);

-- Add updated_at triggers for tables that need them
CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_comments_updated_at
  BEFORE UPDATE ON public.project_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to increment template usage count
CREATE OR REPLACE FUNCTION increment_template_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.templates 
  SET usage_count = usage_count + 1 
  WHERE id = NEW.template_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to increment template usage when a project is created with a template
CREATE TRIGGER increment_template_usage_trigger
  AFTER INSERT ON public.projects
  FOR EACH ROW
  WHEN (NEW.template_id IS NOT NULL)
  EXECUTE FUNCTION increment_template_usage();

-- Insert some default templates
INSERT INTO public.templates (name, description, category, schema, sections, is_public, user_id) VALUES
('Business Plan', 'Comprehensive business plan template', 'business', 
 '{"type": "object", "properties": {"executive_summary": {"type": "string"}, "market_analysis": {"type": "string"}, "financial_projections": {"type": "string"}}}',
 '{"sections": [{"id": "executive_summary", "title": "Executive Summary", "order": 1}, {"id": "market_analysis", "title": "Market Analysis", "order": 2}, {"id": "financial_projections", "title": "Financial Projections", "order": 3}]}',
 true, 'system'),
 
('Technical Documentation', 'Template for technical project documentation', 'technical',
 '{"type": "object", "properties": {"overview": {"type": "string"}, "architecture": {"type": "string"}, "api_reference": {"type": "string"}}}',
 '{"sections": [{"id": "overview", "title": "Project Overview", "order": 1}, {"id": "architecture", "title": "System Architecture", "order": 2}, {"id": "api_reference", "title": "API Reference", "order": 3}]}',
 true, 'system'),
 
('Research Paper', 'Academic research paper template', 'academic',
 '{"type": "object", "properties": {"abstract": {"type": "string"}, "introduction": {"type": "string"}, "methodology": {"type": "string"}, "results": {"type": "string"}, "conclusion": {"type": "string"}}}',
 '{"sections": [{"id": "abstract", "title": "Abstract", "order": 1}, {"id": "introduction", "title": "Introduction", "order": 2}, {"id": "methodology", "title": "Methodology", "order": 3}, {"id": "results", "title": "Results", "order": 4}, {"id": "conclusion", "title": "Conclusion", "order": 5}]}',
 true, 'system');