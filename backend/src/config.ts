import dotenv from "dotenv";
dotenv.config();

function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num("PORT", 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  sessionSecret: process.env.SESSION_SECRET ?? "dev-session-secret",
  jwtSecret: process.env.JWT_SECRET ?? "dev-jwt-secret",
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  elasticsearchUrl: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",
  workerConcurrency: num("WORKER_CONCURRENCY", 5),
  minDelayBetweenSendsMs: num("MIN_DELAY_BETWEEN_SENDS_MS", 2000),
  maxEmailsPerHour: num("MAX_EMAILS_PER_HOUR", 200),
  maxEmailsPerHourPerSender: num("MAX_EMAILS_PER_HOUR_PER_SENDER", 50),
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ??
      "http://localhost:4000/api/auth/google/callback",
  },
  slack: {
    clientId: process.env.SLACK_CLIENT_ID ?? "",
    clientSecret: process.env.SLACK_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.SLACK_REDIRECT_URI ??
      "http://localhost:4000/api/slack/callback",
  },
};

export const EMAIL_QUEUE_NAME = "email-send";
