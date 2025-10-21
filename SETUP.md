# CodeGuide Project Setup and Infrastructure

## Overview

This project implements a comprehensive development environment for a CodeGuide application with the following core components:

### ✅ Completed: Task 1 - Project Setup and Core Infrastructure

## Architecture

The project uses a modern Next.js 15 stack with:

- **Frontend**: Next.js 15 with TypeScript and Tailwind CSS
- **Authentication**: Clerk with JWT-based auth
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS) 
- **Caching & Rate Limiting**: Redis with ioredis client
- **AI Integration**: OpenAI GPT-4 API for outline generation
- **Real-time**: Socket.io for collaboration features
- **Containerization**: Docker with docker-compose for local development
- **CI/CD**: GitHub Actions with automated testing and deployment
- **Testing**: Jest with React Testing Library

## Database Schema

### Core Tables Created

1. **Projects** - User projects with template integration
2. **Templates** - Customizable outline templates with JSON schema
3. **Project Versions** - Version history with diff tracking
4. **Project Comments** - Section-level commenting system
5. **API Usage** - Rate limiting and usage analytics
6. **Application Logs** - Centralized logging system
7. **Error Events** - Error tracking and monitoring

### Security Features

- Row Level Security (RLS) policies for all tables
- JWT-based authentication with Clerk integration
- User-based data isolation
- Public/private content controls
- Collaboration permissions

## Infrastructure Components

### 1. Redis Integration (`src/lib/redis.ts`)
- **Rate Limiting**: Configurable per-user rate limits
- **Session Caching**: User session management
- **API Request Queue**: Background job processing for AI requests
- **Connection Pooling**: Optimized Redis connections

### 2. OpenAI Integration (`src/lib/openai.ts`)
- **Outline Generation**: GPT-4 powered content generation
- **Template Integration**: Context-aware generation using templates
- **Cost Tracking**: Token usage and cost monitoring
- **Error Handling**: Robust error handling with fallbacks
- **Rate Limiting**: API-specific rate limiting

### 3. Logging System (`src/lib/logger.ts`)
- **Structured Logging**: JSON-based log entries
- **Database Persistence**: Logs stored in Supabase
- **Error Tracking**: Comprehensive error monitoring
- **Performance Metrics**: Request timing and analytics
- **Request Tracing**: Unique request ID tracking

### 4. API Endpoints
- **`/api/projects`** - Project CRUD operations
- **`/api/templates`** - Template management
- **`/api/outlines/generate`** - AI-powered outline generation

## Development Setup

### Prerequisites
```bash
Node.js 18+
Redis server
PostgreSQL (or Supabase account)
OpenAI API key
Clerk authentication setup
```

### Environment Variables
Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

### Installation
```bash
npm install
```

### Database Migrations
```bash
npm run db:migrate
```

### Development Server
```bash
# With Docker (includes Redis & PostgreSQL)
npm run docker:up
npm run dev

# Or locally (requires Redis & PostgreSQL running)
npm run dev
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Docker Support

Complete Docker setup for local development:

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

Services included:
- Next.js application (port 3000)
- Redis (port 6379)
- PostgreSQL (port 5432)
- pgAdmin (port 8080)

## CI/CD Pipeline

GitHub Actions workflow includes:
- **Lint & Type Check**: ESLint and TypeScript validation
- **Testing**: Jest test suite with PostgreSQL/Redis services
- **Build**: Production build verification
- **Security Scan**: Trivy vulnerability scanning
- **Deployment**: Automatic deployment to Vercel on main branch

## Rate Limiting

Configurable rate limits per user:
- **Per Minute**: 10 requests
- **Per Hour**: 100 requests  
- **Per Day**: 1000 requests

## Error Handling

- **Structured Errors**: Consistent error responses
- **Error Tracking**: Database-persisted error events
- **Request Tracing**: Unique request IDs for debugging
- **Graceful Degradation**: Fallback mechanisms for external services

## Security Measures

- **JWT Authentication**: Clerk-based user authentication
- **RLS Policies**: Database-level security
- **Rate Limiting**: API abuse prevention
- **Input Validation**: Zod schema validation
- **Error Sanitization**: Sensitive data protection

## Performance Optimizations

- **Redis Caching**: Session and rate limit caching
- **Connection Pooling**: Optimized database connections
- **Background Processing**: Queue-based AI request handling
- **Request Deduplication**: Efficient API usage

## Monitoring & Logging

- **Application Logs**: Structured logging with levels
- **Performance Metrics**: Request timing and throughput
- **Error Events**: Aggregated error tracking
- **API Usage**: Token consumption and cost tracking

## Next Steps

This completes Task 1: Project Setup and Core Infrastructure. The following tasks are ready for implementation:

1. **Task 2**: Template System and Outline Generation Engine
2. **Task 3**: User Interface and Real-Time Preview System  
3. **Task 4**: Collaboration and Version Control Features
4. **Task 5**: Export System and Production Deployment

The foundation is now in place with:
✅ Complete development environment
✅ Database schema and migrations
✅ Authentication and authorization
✅ API infrastructure
✅ Testing framework
✅ Docker containerization
✅ CI/CD pipeline
✅ Logging and monitoring
✅ Error handling and security measures