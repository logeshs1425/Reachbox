import { Worker, Job, DelayedError } from "bullmq";
import { config, EMAIL_QUEUE_NAME } from "./config.js";
import { prisma } from "./db.js";
import { indexEmail } from "./elasticsearch.js";
import { getOrCreateEtherealSender, sendEmail } from "./mail.js";
import { EmailJobPayload } from "./queue.js";
import {
  redis,
  shouldNotifyRateLimit,
  tryAcquireSendSlot,
} from "./redis.js";
import { notifySlackRateLimit } from "./slack.js";

async function processEmailJob(job: Job<EmailJobPayload>): Promise<void> {
  const { emailJobId, userId, senderEmail } = job.data;

  const emailJob = await prisma.emailJob.findUnique({
    where: { id: emailJobId },
  });

  if (!emailJob || emailJob.userId !== userId) {
    return;
  }

  if (emailJob.status === "SENT" || emailJob.status === "CANCELLED") {
    return;
  }

  const claimed = await prisma.emailJob.updateMany({
    where: { id: emailJobId, status: { in: ["SCHEDULED", "QUEUED"] } },
    data: { status: "SENDING" },
  });
  if (claimed.count === 0) return;

  let slot: Awaited<ReturnType<typeof tryAcquireSendSlot>>;
  try {
    slot = await tryAcquireSendSlot({
      senderEmail,
      globalLimit: config.maxEmailsPerHour,
      senderLimit: config.maxEmailsPerHourPerSender,
    });
  } catch (error) {
    await prisma.emailJob.update({ where: { id: emailJobId }, data: { status: "QUEUED" } });
    throw error;
  }

  if (!slot.ok) {
    const notify = await shouldNotifyRateLimit(
      userId,
      senderEmail,
      slot.reason
    );
    if (notify) {
      try {
        await notifySlackRateLimit({
          userId,
          senderEmail,
          reason: slot.reason,
          limit: slot.reason === "global" ? config.maxEmailsPerHour : config.maxEmailsPerHourPerSender,
        });
      } catch (error) {
        console.error("Slack rate-limit notification failed:", error);
      }
    }

    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: { status: "QUEUED" },
    });

    await job.moveToDelayed(Date.now() + slot.retryAfterMs);
    throw new DelayedError(
      `Rate limit (${slot.reason}); delayed ${slot.retryAfterMs}ms`
    );
  }

  try {
    const smtp = await getOrCreateEtherealSender(userId, emailJob.fromEmail);
    const result = await sendEmail({
      smtp,
      from: emailJob.fromEmail,
      to: emailJob.toEmail,
      subject: emailJob.subject,
      html: emailJob.bodyHtml,
      text: emailJob.bodyText ?? undefined,
    });

    const sentAt = new Date();
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: "SENT",
        sentAt,
        etherealPreview: result.previewUrl,
      },
    });

    await indexEmail({
      id: emailJob.id,
      userId: emailJob.userId,
      fromEmail: emailJob.fromEmail,
      toEmail: emailJob.toEmail,
      toName: emailJob.toName,
      subject: emailJob.subject,
      bodyText: emailJob.bodyText,
      status: "SENT",
      scheduledAt: emailJob.scheduledAt.toISOString(),
      sentAt: sentAt.toISOString(),
      createdAt: emailJob.createdAt.toISOString(),
    });
  } catch (err) {
    await prisma.emailJob.update({
      where: { id: emailJobId },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : "Email send failed",
      },
    }).catch(() => undefined);
    throw err;
  }
}

export function startEmailWorker(): Worker<EmailJobPayload> {
  const worker = new Worker<EmailJobPayload>(
    EMAIL_QUEUE_NAME,
    processEmailJob,
    {
      connection: redis.duplicate(),
      concurrency: config.workerConcurrency,
      limiter: {
        max: 1,
        duration: config.minDelayBetweenSendsMs,
      },
    }
  );

  worker.on("failed", (job, err) => {
    if (err.message.includes("Rate limit")) {
      return;
    }
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
