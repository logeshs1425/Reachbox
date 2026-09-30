import { Queue } from "bullmq";
import { config, EMAIL_QUEUE_NAME } from "./config.js";
import { redis } from "./redis.js";

export type EmailJobPayload = {
  emailJobId: string;
  userId: string;
  senderEmail: string;
};

export const emailQueue = new Queue<EmailJobPayload>(EMAIL_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: { count: 500, age: 7 * 24 * 60 * 60 }, // keep last 500 completed jobs for 7 days
    removeOnFail: false,      // NEVER auto-delete failed jobs — keeps them visible in Bull Board
    attempts: 3,              // Retry up to 3 times before marking as failed
    backoff: { type: "exponential", delay: 10_000 }, // 10s, 20s, 40s between retries
  },
});

export async function scheduleEmailJob(params: {
  emailJobId: string;
  userId: string;
  senderEmail: string;
  scheduledAt: Date;
}): Promise<string> {
  const delayMs = Math.max(0, params.scheduledAt.getTime() - Date.now());
  const job = await emailQueue.add(
    "send-email",
    {
      emailJobId: params.emailJobId,
      userId: params.userId,
      senderEmail: params.senderEmail,
    },
    {
      jobId: params.emailJobId,
      delay: delayMs,
    }
  );
  return job.id!;
}

export async function rescheduleEmailJob(params: {
  emailJobId: string;
  userId: string;
  senderEmail: string;
  delayMs: number;
}): Promise<void> {
  const existing = await emailQueue.getJob(params.emailJobId);
  if (existing) {
    await existing.remove();
  }
  await emailQueue.add(
    "send-email",
    {
      emailJobId: params.emailJobId,
      userId: params.userId,
      senderEmail: params.senderEmail,
    },
    {
      jobId: params.emailJobId,
      delay: params.delayMs,
    }
  );
}
