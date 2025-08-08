-- Initialize the database for CodeGuide application
-- This runs automatically when the PostgreSQL container starts for the first time

-- Create extensions we'll need
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create additional databases if needed
-- CREATE DATABASE codeguide_test;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE codeguide TO codeguide;