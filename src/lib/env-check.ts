export function checkEnvironmentVariables() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const requiredEnvVars = {
    clerk: {
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      secretKey: process.env.CLERK_SECRET_KEY,
    },
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    ai: {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
    },
    redis: {
      url: process.env.REDIS_URL,
    },
    storage: isDevelopment ? {
      minioEndpoint: process.env.MINIO_ENDPOINT,
      minioAccessKey: process.env.MINIO_ACCESS_KEY,
      minioSecretKey: process.env.MINIO_SECRET_KEY,
    } : {
      awsAccessKey: process.env.AWS_ACCESS_KEY_ID,
      awsSecretKey: process.env.AWS_SECRET_ACCESS_KEY,
      awsRegion: process.env.AWS_REGION,
      awsBucket: process.env.AWS_S3_BUCKET_NAME,
    },
    email: isDevelopment ? {
      smtpHost: process.env.LOCAL_SMTP_HOST,
      smtpPort: process.env.LOCAL_SMTP_PORT,
    } : {
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT,
      smtpUser: process.env.SMTP_USER,
      smtpPassword: process.env.SMTP_PASSWORD,
      smtpFrom: process.env.SMTP_FROM,
    },
    security: {
      jwtSecret: process.env.JWT_SECRET,
      encryptionKey: process.env.ENCRYPTION_KEY,
    },
  };

  const status = {
    clerk: !!(
      requiredEnvVars.clerk.publishableKey && requiredEnvVars.clerk.secretKey
    ),
    supabase: !!(
      requiredEnvVars.supabase.url && 
      requiredEnvVars.supabase.anonKey &&
      requiredEnvVars.supabase.serviceKey
    ),
    ai: !!(requiredEnvVars.ai.openai || requiredEnvVars.ai.anthropic),
    redis: !!requiredEnvVars.redis.url,
    storage: isDevelopment ? !!(
      requiredEnvVars.storage.minioEndpoint &&
      requiredEnvVars.storage.minioAccessKey &&
      requiredEnvVars.storage.minioSecretKey
    ) : !!(
      requiredEnvVars.storage.awsAccessKey &&
      requiredEnvVars.storage.awsSecretKey &&
      requiredEnvVars.storage.awsRegion &&
      requiredEnvVars.storage.awsBucket
    ),
    email: isDevelopment ? !!(
      requiredEnvVars.email.smtpHost &&
      requiredEnvVars.email.smtpPort
    ) : !!(
      requiredEnvVars.email.smtpHost &&
      requiredEnvVars.email.smtpPort &&
      requiredEnvVars.email.smtpUser &&
      requiredEnvVars.email.smtpPassword &&
      requiredEnvVars.email.smtpFrom
    ),
    security: !!(
      requiredEnvVars.security.jwtSecret &&
      requiredEnvVars.security.encryptionKey
    ),
    allConfigured: false,
  };

  status.allConfigured = status.clerk && status.supabase && status.ai;

  return status;
}

export function getSetupInstructions() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const commonInstructions = [
    {
      service: "Clerk",
      description: "Authentication service for user management",
      steps: [
        "Go to https://dashboard.clerk.com/",
        "Create a new application",
        "Copy NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to .env.local",
        "Configure OAuth providers (Google, GitHub) if needed",
      ],
      envVars: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
    },
    {
      service: "Supabase",
      description: "Database and real-time subscriptions",
      steps: [
        "Go to https://supabase.com/dashboard",
        "Create a new project",
        "Copy NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY to .env.local",
        "Configure third-party auth integration with Clerk",
        "Run database migrations: npm run db:migrate",
      ],
      envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"],
    },
    {
      service: "AI APIs",
      description: "AI language models for outline generation",
      steps: [
        "OpenAI: Go to https://platform.openai.com/ and create an API key",
        "Anthropic: Go to https://console.anthropic.com/ and create an API key",
        "You need at least one of these services",
      ],
      envVars: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
    },
  ];

  const developmentInstructions = [
    {
      service: "Development Environment",
      description: "Local development setup with Docker",
      steps: [
        "Start local services: npm run docker:up",
        "This starts PostgreSQL, Redis, MinIO, and MailHog",
        "Services will be available on default ports",
        "Use npm run setup to initialize everything at once",
      ],
      envVars: ["REDIS_URL", "DATABASE_URL"],
    },
    {
      service: "MinIO (Local S3)",
      description: "Local file storage for development",
      steps: [
        "MinIO starts automatically with Docker Compose",
        "Access MinIO console at http://localhost:9001",
        "Use codeguide/codeguide123 credentials",
        "Create bucket: codeguide-local",
      ],
      envVars: ["MINIO_ENDPOINT", "MINIO_ACCESS_KEY", "MINIO_SECRET_KEY", "MINIO_BUCKET_NAME"],
    },
    {
      service: "MailHog (Local Email)",
      description: "Email testing in development",
      steps: [
        "MailHog starts automatically with Docker Compose",
        "View emails at http://localhost:8025",
        "SMTP server runs on localhost:1025",
      ],
      envVars: ["LOCAL_SMTP_HOST", "LOCAL_SMTP_PORT"],
    },
  ];

  const productionInstructions = [
    {
      service: "AWS S3",
      description: "File storage for production",
      steps: [
        "Create AWS S3 bucket",
        "Create IAM user with S3 access",
        "Copy access keys to environment variables",
        "Configure CORS and public access policies",
      ],
      envVars: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_S3_BUCKET_NAME"],
    },
    {
      service: "Email Service",
      description: "Production email sending",
      steps: [
        "Set up SMTP service (SendGrid, AWS SES, etc.)",
        "Configure SMTP credentials",
        "Set sender email address",
      ],
      envVars: ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM"],
    },
    {
      service: "Redis",
      description: "Caching and rate limiting",
      steps: [
        "Set up Redis instance (Redis Cloud, AWS ElastiCache, etc.)",
        "Copy connection URL to environment variables",
      ],
      envVars: ["REDIS_URL"],
    },
    {
      service: "Security",
      description: "Security configuration",
      steps: [
        "Generate JWT secret: openssl rand -base64 32",
        "Generate encryption key: openssl rand -base64 32",
        "Store securely in environment variables",
      ],
      envVars: ["JWT_SECRET", "ENCRYPTION_KEY"],
    },
  ];

  return [
    ...commonInstructions,
    ...(isDevelopment ? developmentInstructions : productionInstructions),
  ];
}
