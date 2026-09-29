import { prisma } from "./db.js";
import { emailQueue, scheduleEmailJob } from "./queue.js";

/** Re-enqueue DB jobs missing from BullMQ (e.g. after Redis flush). */
export async function recoverPendingJobs(): Promise<number> {
  const pending = await prisma.emailJob.findMany({
    where: {
      status: { in: ["SCHEDULED", "QUEUED", "SENDING"] },
      scheduledAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  });

  let count = 0;
  for (const job of pending) {
    const existing = await emailQueue.getJob(job.id);
    if (existing) continue;

    await scheduleEmailJob({
      emailJobId: job.id,
      userId: job.userId,
      senderEmail: job.fromEmail,
      scheduledAt: job.scheduledAt,
    });
    await prisma.emailJob.update({
      where: { id: job.id },
      data: { status: "QUEUED" },
    });
    count++;
  }
  return count;
}
