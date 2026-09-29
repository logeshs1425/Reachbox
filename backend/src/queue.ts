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
    removeOnComplete: 1000,
    removeOnFail: 5000,
    attempts: 10,
    backoff: { type: "fixed", delay: 5000 },
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
