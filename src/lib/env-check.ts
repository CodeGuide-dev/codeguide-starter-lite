export function checkEnvironmentVariables() {
  const requiredEnvVars = {
    clerk: {
      publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
      secretKey: process.env.CLERK_SECRET_KEY,
    },
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },
    ai: {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
    },
    database: {
      url: process.env.DATABASE_URL,
    },
    redis: {
      url: process.env.REDIS_URL,
    },
    aws: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
      bucketName: process.env.AWS_S3_BUCKET_NAME,
    },
    security: {
      jwtSecret: process.env.JWT_SECRET,
      nextAuthSecret: process.env.NEXTAUTH_SECRET,
    },
  };

  const status = {
    clerk: !!(
      requiredEnvVars.clerk.publishableKey && requiredEnvVars.clerk.secretKey
    ),
    supabase: !!(
      requiredEnvVars.supabase.url && requiredEnvVars.supabase.anonKey
    ),
    ai: !!(requiredEnvVars.ai.openai || requiredEnvVars.ai.anthropic),
    database: !!requiredEnvVars.database.url,
    redis: !!requiredEnvVars.redis.url,
    aws: !!(
      requiredEnvVars.aws.accessKeyId &&
      requiredEnvVars.aws.secretAccessKey &&
      requiredEnvVars.aws.region &&
      requiredEnvVars.aws.bucketName
    ),
    security: !!(
      requiredEnvVars.security.jwtSecret &&
      requiredEnvVars.security.nextAuthSecret
    ),
    allConfigured: false,
  };

  status.allConfigured = 
    status.clerk && 
    status.supabase && 
    status.ai && 
    status.database && 
    status.redis && 
    status.aws && 
    status.security;

  return status;
}

export function getSetupInstructions() {
  return [
    {
      service: "Clerk",
      description: "Authentication service for user management",
      steps: [
        "Go to https://dashboard.clerk.com/",
        "Create a new application",
        "Copy NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to .env.local",
      ],
      envVars: ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "CLERK_SECRET_KEY"],
    },
    {
      service: "Supabase",
      description: "Database and real-time subscriptions",
      steps: [
        "Go to https://supabase.com/dashboard",
        "Create a new project",
        "Copy NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local",
      ],
      envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    },
    {
      service: "PostgreSQL Database",
      description: "Primary database for application data",
      steps: [
        "Set up PostgreSQL database (local or cloud)",
        "Copy DATABASE_URL to .env.local",
        "Run migrations with: npm run db:migrate",
      ],
      envVars: ["DATABASE_URL"],
    },
    {
      service: "Redis",
      description: "Session caching and rate limiting",
      steps: [
        "Set up Redis instance (local or cloud)",
        "Copy REDIS_URL to .env.local",
      ],
      envVars: ["REDIS_URL"],
    },
    {
      service: "AWS S3",
      description: "File storage and exports",
      steps: [
        "Create AWS account and S3 bucket",
        "Create IAM user with S3 permissions",
        "Copy AWS credentials to .env.local",
      ],
      envVars: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_S3_BUCKET_NAME"],
    },
    {
      service: "OpenAI",
      description: "AI language model for outline generation",
      steps: [
        "Go to https://platform.openai.com/",
        "Create an API key",
        "Copy OPENAI_API_KEY to .env.local",
      ],
      envVars: ["OPENAI_API_KEY"],
    },
    {
      service: "Security",
      description: "JWT and authentication secrets",
      steps: [
        "Generate secure random strings for JWT_SECRET and NEXTAUTH_SECRET",
        "Add these to .env.local",
      ],
      envVars: ["JWT_SECRET", "NEXTAUTH_SECRET"],
    },
  ];
}
