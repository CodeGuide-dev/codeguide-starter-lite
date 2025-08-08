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
    redis: {
      url: process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.REDIS_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
    },
    ai: {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
    },
  };

  const status = {
    clerk: !!(
      requiredEnvVars.clerk.publishableKey && requiredEnvVars.clerk.secretKey
    ),
    supabase: !!(
      requiredEnvVars.supabase.url && requiredEnvVars.supabase.anonKey
    ),
    redis: !!(
      requiredEnvVars.redis.url && requiredEnvVars.redis.token
    ),
    ai: !!(requiredEnvVars.ai.openai || requiredEnvVars.ai.anthropic),
    allConfigured: false,
  };

  status.allConfigured = status.clerk && status.supabase && status.redis && status.ai;

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
        "Run database migrations: supabase db push",
      ],
      envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    },
    {
      service: "Redis (Upstash)",
      description: "Caching and rate limiting",
      steps: [
        "Go to https://console.upstash.com/",
        "Create a new Redis database",
        "Copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to .env.local",
        "Alternative: Use local Redis with REDIS_URL=redis://localhost:6379",
      ],
      envVars: ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
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
  ];
}
