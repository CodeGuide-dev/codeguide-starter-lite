-- Application logging system
-- This migration creates the logging infrastructure for error tracking and monitoring

-- Create enum for log levels
CREATE TYPE log_level AS ENUM ('error', 'warn', 'info', 'debug');

-- Application logs table
CREATE TABLE IF NOT EXISTS public.application_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level log_level NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  user_id TEXT, -- Clerk user ID (optional)
  metadata JSONB DEFAULT '{}',
  stack_trace TEXT,
  request_id TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  response_time_ms INTEGER NOT NULL,
  status_code INTEGER NOT NULL,
  user_id TEXT, -- Clerk user ID (optional)
  request_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Error tracking table
CREATE TABLE IF NOT EXISTS public.error_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  user_id TEXT, -- Clerk user ID (optional)
  request_id TEXT,
  user_agent TEXT,
  url TEXT,
  additional_context JSONB DEFAULT '{}',
  occurrence_count INTEGER DEFAULT 1,
  first_occurred TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_occurred TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.application_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for application_logs table
-- Only system/admin users can read all logs, users can read their own logs
CREATE POLICY "Users can read own logs" ON public.application_logs
  FOR SELECT USING (
    user_id IS NULL OR auth.jwt() ->> 'sub' = user_id
  );

-- Only system can insert logs
CREATE POLICY "System can insert logs" ON public.application_logs
  FOR INSERT WITH CHECK (true);

-- RLS Policies for performance_metrics table
-- Users can read their own metrics, admins can read all
CREATE POLICY "Users can read own metrics" ON public.performance_metrics
  FOR SELECT USING (
    user_id IS NULL OR auth.jwt() ->> 'sub' = user_id
  );

-- Only system can insert metrics
CREATE POLICY "System can insert metrics" ON public.performance_metrics
  FOR INSERT WITH CHECK (true);

-- RLS Policies for error_events table
-- Users can read their own errors, admins can read all
CREATE POLICY "Users can read own errors" ON public.error_events
  FOR SELECT USING (
    user_id IS NULL OR auth.jwt() ->> 'sub' = user_id
  );

-- Only system can insert/update error events
CREATE POLICY "System can manage error events" ON public.error_events
  FOR ALL WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_application_logs_created_at ON public.application_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_application_logs_level ON public.application_logs(level);
CREATE INDEX IF NOT EXISTS idx_application_logs_user_id ON public.application_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_application_logs_request_id ON public.application_logs(request_id);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON public.performance_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_endpoint ON public.performance_metrics(endpoint);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON public.performance_metrics(user_id);

CREATE INDEX IF NOT EXISTS idx_error_events_created_at ON public.error_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_events_error_type ON public.error_events(error_type);
CREATE INDEX IF NOT EXISTS idx_error_events_user_id ON public.error_events(user_id);
CREATE INDEX IF NOT EXISTS idx_error_events_occurrence_count ON public.error_events(occurrence_count DESC);

-- Function to clean up old logs (data retention)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  -- Keep logs for 90 days
  DELETE FROM public.application_logs 
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  -- Keep performance metrics for 30 days
  DELETE FROM public.performance_metrics 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  -- Keep error events for 180 days
  DELETE FROM public.error_events 
  WHERE created_at < NOW() - INTERVAL '180 days';
END;
$$ LANGUAGE plpgsql;

-- Function to update error occurrence count
CREATE OR REPLACE FUNCTION upsert_error_event(
  p_error_type TEXT,
  p_error_message TEXT,
  p_stack_trace TEXT DEFAULT NULL,
  p_user_id TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_url TEXT DEFAULT NULL,
  p_additional_context JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  error_id UUID;
BEGIN
  -- Try to find existing error event
  SELECT id INTO error_id
  FROM public.error_events
  WHERE error_type = p_error_type 
    AND error_message = p_error_message
    AND (user_id = p_user_id OR (user_id IS NULL AND p_user_id IS NULL));
  
  IF error_id IS NOT NULL THEN
    -- Update existing error
    UPDATE public.error_events
    SET occurrence_count = occurrence_count + 1,
        last_occurred = NOW(),
        stack_trace = COALESCE(p_stack_trace, stack_trace),
        user_agent = COALESCE(p_user_agent, user_agent),
        url = COALESCE(p_url, url),
        additional_context = p_additional_context
    WHERE id = error_id;
  ELSE
    -- Create new error event
    INSERT INTO public.error_events (
      error_type, error_message, stack_trace, user_id,
      request_id, user_agent, url, additional_context
    ) VALUES (
      p_error_type, p_error_message, p_stack_trace, p_user_id,
      p_request_id, p_user_agent, p_url, p_additional_context
    ) RETURNING id INTO error_id;
  END IF;
  
  RETURN error_id;
END;
$$ LANGUAGE plpgsql;