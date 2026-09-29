import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { prisma } from "../db.js";
import { indexEmail } from "../elasticsearch.js";
import { scheduleEmailJob } from "../queue.js";
import { v4 as uuidv4 } from "uuid";

export const emailsRouter = Router();

emailsRouter.use(requireAuth);

const createSchema = z.object({
  fromEmail: z.string().email(),
  toEmail: z.string().email(),
  toName: z.string().optional(),
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
  scheduledAt: z.string().min(1),
});

emailsRouter.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (!Number.isFinite(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now()) {
    res.status(400).json({ error: "scheduledAt must be in the future" });
    return;
  }

  const idempotencyKey = uuidv4();
  const emailJob = await prisma.emailJob.create({
    data: {
      userId: req.user!.id,
      fromEmail: parsed.data.fromEmail,
      toEmail: parsed.data.toEmail,
      toName: parsed.data.toName,
      subject: parsed.data.subject,
      bodyHtml: parsed.data.bodyHtml,
      bodyText: parsed.data.bodyText,
      scheduledAt,
      status: "SCHEDULED",
      idempotencyKey,
    },
  });

  let bullJobId: string;
  try {
    bullJobId = await scheduleEmailJob({
      emailJobId: emailJob.id,
      userId: req.user!.id,
      senderEmail: parsed.data.fromEmail,
      scheduledAt,
    });
  } catch (error) {
    // Keep the durable DB row for startup recovery; report queue unavailability.
    res.status(503).json({ error: "Scheduler is temporarily unavailable", id: emailJob.id });
    return;
  }

  await prisma.emailJob.update({
    where: { id: emailJob.id },
    data: { bullJobId, status: "QUEUED" },
  });

  await indexEmail({
    id: emailJob.id,
    userId: emailJob.userId,
    fromEmail: emailJob.fromEmail,
    toEmail: emailJob.toEmail,
    toName: emailJob.toName,
    subject: emailJob.subject,
    bodyText: emailJob.bodyText,
    status: "QUEUED",
    scheduledAt: emailJob.scheduledAt.toISOString(),
    sentAt: null,
    createdAt: emailJob.createdAt.toISOString(),
  });

  res.status(201).json({ email: { ...emailJob, status: "QUEUED", bullJobId }, bullJobId });
});

emailsRouter.get("/", async (req, res) => {
  const status = req.query.status as string | undefined;
  const where: Record<string, unknown> = { userId: req.user!.id };

  if (status === "scheduled") {
    where.status = { in: ["SCHEDULED", "QUEUED", "SENDING"] };
  } else if (status === "sent") {
    where.status = "SENT";
  }

  const emails = await prisma.emailJob.findMany({
    where,
    orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  res.json({ emails });
});

emailsRouter.get("/:id", async (req, res) => {
  const email = await prisma.emailJob.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  });
  if (!email) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ email });
});
