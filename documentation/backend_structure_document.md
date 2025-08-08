# Backend Structure Document

This document outlines the design and setup of the backend system for our intelligent outline and summary generation tool. It covers architecture, databases, APIs, hosting, infrastructure, security, and maintenance. The goal is to give a clear, step-by-step view of how the backend works and how it’s hosted, without assuming deep technical knowledge.

## 1. Backend Architecture

Overview:
- We use a service-oriented approach, breaking the backend into focused components (services) that handle specific tasks.
- A central API Gateway routes requests from the frontend or other services to the right place.

Key Components:
- **API Gateway (Node.js + Express)**: Receives all incoming calls, handles authentication, and sends requests to the appropriate microservice.
- **NLP Service (Python + Flask)**: Processes text inputs, runs natural language analysis, and returns summaries or outlines.
- **Template Service (Node.js)**: Manages outline templates, applying user settings to generate custom outputs.
- **Collaboration Service (Node.js)**: Tracks edits, comments, and versions for each project.
- **Export Service (Node.js)**: Converts final documents into PDF, DOCX, or Markdown.
- **Authentication Service**: Manages user accounts, tokens, and permissions.

How It Supports:  
- **Scalability**: Each service can be scaled independently. If the NLP processor needs more power, we add more instances without touching other services.  
- **Maintainability**: Clear boundaries mean teams can work on one service without affecting others.  
- **Performance**: Services communicate over fast internal networks; heavy tasks (like NLP) run in optimized environments.

## 2. Database Management

We use a combination of relational and non-relational databases to store different kinds of data:

- **PostgreSQL (SQL)**
  - User accounts, project metadata, version histories, and access controls.
- **MongoDB (NoSQL)**
  - Flexible storage of raw input texts, generated outlines, logs, and audit trails.
- **Redis (In-Memory Cache)**
  - Caches frequent lookups (user sessions, template data) to speed up responses.

Data Practices:
- Regular backups of PostgreSQL and MongoDB with automated snapshots.
- Read-replicas for PostgreSQL to handle high read loads.
- Data retention policies to archive or purge old logs.

## 3. Database Schema

### PostgreSQL Schema (Human-Readable)
- **Users**: Stores user profiles and credentials.  
  - ID, Email, PasswordHash, Name, CreatedAt
- **Projects**: Holds information about each outline project.  
  - ID, UserID, Title, Description, CreatedAt, UpdatedAt
- **Templates**: Defines the structure and settings for outlines.  
  - ID, UserID, Name, JSONDefinition, CreatedAt
- **Versions**: Tracks changes to each project’s outline.  
  - ID, ProjectID, TemplateID, VersionNumber, ChangeNotes, CreatedAt
- **Comments**: Collaboration notes on specific sections.  
  - ID, ProjectID, UserID, SectionReference, Text, CreatedAt

### PostgreSQL Schema (SQL)
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE templates (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  json_definition JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE versions (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  template_id INTEGER REFERENCES templates(id),
  version_number INTEGER NOT NULL,
  change_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE comments (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id),
  user_id INTEGER REFERENCES users(id),
  section_reference VARCHAR(255),
  text TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### MongoDB Schema (NoSQL)
- **Outlines Collection**:
  - _id, projectId, rawInput, generatedOutline (array of sections), createdAt
- **Logs Collection**:
  - _id, serviceName, level, message, timestamp

## 4. API Design and Endpoints

We follow a RESTful style so that each endpoint represents a resource and uses standard HTTP methods.

Key Endpoints:

- **Authentication**  
  - `POST /auth/register` – Create a new user account  
  - `POST /auth/login` – Authenticate and return a token
- **Projects**  
  - `GET /projects` – List all projects for the user  
  - `POST /projects` – Create a new project  
  - `GET /projects/{id}` – Retrieve project details  
  - `PUT /projects/{id}` – Update project metadata  
  - `DELETE /projects/{id}` – Remove a project
- **Outlines**  
  - `POST /projects/{id}/outline` – Generate an outline from user input  
  - `GET /projects/{id}/outline` – Fetch the latest outline
- **Templates**  
  - `GET /templates` – List user’s templates  
  - `POST /templates` – Create a template  
  - `PUT /templates/{id}` – Update a template
- **Collaboration**  
  - `GET /projects/{id}/comments` – List comments  
  - `POST /projects/{id}/comments` – Add a comment
- **Exports**  
  - `POST /projects/{id}/export?format=pdf|docx|md` – Generate a downloadable file

Authentication tokens are sent in the `Authorization` header as a Bearer token.

## 5. Hosting Solutions

We host in the cloud for reliability and easy scaling:
- **Provider**: Amazon Web Services (AWS)
- **Compute**: Containers managed by Elastic Container Service (ECS) or Elastic Kubernetes Service (EKS)
- **Databases**:
  - PostgreSQL on Amazon RDS with multi-AZ deployment  
  - MongoDB Atlas for managed NoSQL hosting
  - Redis on Amazon ElastiCache
- **File Storage**: Amazon S3 for exported documents and backups
- **Benefits**:
  - High uptime with multi-zone failover
  - Pay-as-you-go keeps costs aligned with usage
  - Built-in monitoring and security tools

## 6. Infrastructure Components

- **Load Balancer**: AWS Application Load Balancer distributes incoming traffic across service instances.
- **Caching**: Redis stores session data and template lookups for sub-millisecond response times.
- **CDN**: Amazon CloudFront serves static assets (front-end bundle, exports) from edge locations.
- **Containerization**: Docker images for each service, ensuring consistent environments.
- **Orchestration**: ECS/EKS auto-scales containers based on CPU and memory usage.
- **Service Discovery**: Internal DNS for services to find and communicate with each other securely.

## 7. Security Measures

- **Encryption**:
  - TLS everywhere for in-transit data protection  
  - AES-256 encryption at rest for databases and S3 buckets
- **Authentication & Authorization**:
  - JWT-based tokens with short lifetimes and refresh tokens  
  - Role-based access control (RBAC) ensures users only see their own projects
- **Network Security**:
  - Private subnets for databases and internal services  
  - Public subnets only for load balancers
- **Data Validation**:
  - Input sanitization to prevent injection attacks
- **Compliance**:
  - Regular security audits and vulnerability scanning

## 8. Monitoring and Maintenance

- **Monitoring Tools**:
  - AWS CloudWatch for metrics and logs
  - ELK (Elasticsearch, Logstash, Kibana) stack for centralized log analysis
  - Prometheus + Grafana for service health dashboards
- **Alerts**:
  - Automated alerts on CPU/memory spikes, error rates, or high latency
- **Backups & Updates**:
  - Daily automated database snapshots, weekly full backups  
  - Rolling updates to containers with zero downtime deployments  
  - Dependency updates tracked by a CI/CD pipeline (GitHub Actions)

## 9. Conclusion and Overall Backend Summary

Our backend is a collection of specialized services working together through a simple API gateway. It uses reliable, managed databases and cloud infrastructure to ensure the system can grow as demand increases. Strong security and monitoring practices protect user data and guarantee high availability. These choices align with our goals of providing a fast, scalable, and dependable outline-generation tool that users can trust.