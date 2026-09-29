import dotenv from "dotenv";
dotenv.config();

function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(key: string, fallback = ""): string {
  const v = process.env[key];
  return v !== undefined && v.trim() !== "" ? v.trim() : fallback;
}

export const config = {
  port: num("PORT", 4000),
  nodeEnv: str("NODE_ENV", "development"),
  frontendUrl: str("FRONTEND_URL", "http://localhost:3000"),
  sessionSecret: str("SESSION_SECRET", "dev-session-secret"),
  jwtSecret: str("JWT_SECRET", "dev-jwt-secret"),
  databaseUrl: str("DATABASE_URL", process.env.DATABASE_URL || ""),
  redisUrl: str("REDIS_URL", "redis://localhost:6379"),
  elasticsearchUrl: str("ELASTICSEARCH_URL", "http://localhost:9200"),
  workerConcurrency: num("WORKER_CONCURRENCY", 5),
  minDelayBetweenSendsMs: num("MIN_DELAY_BETWEEN_SENDS_MS", 2000),
  maxEmailsPerHour: num("MAX_EMAILS_PER_HOUR", 200),
  maxEmailsPerHourPerSender: num("MAX_EMAILS_PER_HOUR_PER_SENDER", 50),
  google: {
    clientId: str("GOOGLE_CLIENT_ID", ""),
    clientSecret: str("GOOGLE_CLIENT_SECRET", ""),
    callbackUrl: str(
      "GOOGLE_CALLBACK_URL",
      "http://localhost:4000/api/auth/google/callback"
    ),
  },
  slack: {
    clientId: str("SLACK_CLIENT_ID", ""),
    clientSecret: str("SLACK_CLIENT_SECRET", ""),
    redirectUri: str(
      "SLACK_REDIRECT_URI",
      "http://localhost:4000/api/slack/callback"
    ),
  },
};

export const EMAIL_QUEUE_NAME = "email-send";
