import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { requireAuth } from "../auth/middleware.js";
import { prisma } from "../db.js";
import { indexEmail } from "../elasticsearch.js";
import { scheduleEmailJob } from "../queue.js";
import { v4 as uuidv4 } from "uuid";

export const emailsRouter = Router();

emailsRouter.use(requireAuth);

// ── multer: store in memory (max 10 MB total, 5 MB per file, up to 10 files) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
});

export type StoredAttachment = {
  filename: string;
  contentType: string;
  size: number;
  base64: string;
};

const createSchema = z.object({
  fromEmail: z.string().email(),
  toEmail: z.string().email().optional(),
  toName: z.string().optional(),
  leads: z.string().optional(), // JSON string of {email, name}[]
  subject: z.string().min(1),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
  scheduledAt: z.string().min(1),
  delaySeconds: z.coerce.number().optional(),
  hourlyLimit: z.coerce.number().optional(),
}).refine(data => data.toEmail || data.leads, {
  message: "Either toEmail or leads must be provided",
});

emailsRouter.post(
  "/",
  upload.array("attachments", 10),
  async (req, res) => {
    // multer populates req.body from the multipart form fields
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

    // Convert uploaded files to storable JSON (base64)
    const files = (req.files as Express.Multer.File[]) ?? [];
    const attachmentsJson: StoredAttachment[] = files.map((f) => ({
      filename: f.originalname,
      contentType: f.mimetype,
      size: f.size,
      base64: f.buffer.toString("base64"),
    }));

    let leads: { email: string; name?: string }[] = [];
    if (parsed.data.leads) {
      try {
        leads = JSON.parse(parsed.data.leads);
      } catch (e) {
        res.status(400).json({ error: "Invalid leads JSON format" });
        return;
      }
    } else if (parsed.data.toEmail) {
      leads = [{ email: parsed.data.toEmail, name: parsed.data.toName }];
    }

    if (leads.length === 0) {
      res.status(400).json({ error: "No leads provided" });
      return;
    }

    const delayMs = (parsed.data.delaySeconds || 0) * 1000;
    const hourlyLimit = parsed.data.hourlyLimit || 0;
    const createdJobs = [];

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      let sendTime = scheduledAt.getTime();
      
      if (hourlyLimit > 0) {
        // Space them out exactly to respect the hourly limit (e.g. 10 per hour = 1 every 6 mins)
        const spaceMs = (3600 * 1000) / hourlyLimit;
        sendTime += i * spaceMs;
      } else if (delayMs > 0) {
        sendTime += i * delayMs;
      }

      const idempotencyKey = uuidv4();
      const emailJob = await prisma.emailJob.create({
        data: {
          userId: req.user!.id,
          fromEmail: parsed.data.fromEmail,
          toEmail: lead.email,
          toName: lead.name,
          subject: parsed.data.subject,
          bodyHtml: parsed.data.bodyHtml,
          bodyText: parsed.data.bodyText,
          attachmentsJson: attachmentsJson.length ? attachmentsJson : undefined,
          scheduledAt: new Date(sendTime),
          status: "SCHEDULED",
          idempotencyKey,
        },
      });

      let bullJobId: string | undefined;
      try {
        bullJobId = await scheduleEmailJob({
          emailJobId: emailJob.id,
          userId: req.user!.id,
          senderEmail: parsed.data.fromEmail,
          scheduledAt: new Date(sendTime),
        });
        
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
        
        createdJobs.push({ ...emailJob, status: "QUEUED", bullJobId });
      } catch (error) {
        // If queue fails, it stays SCHEDULED and is picked up on restart
        createdJobs.push(emailJob);
      }
    }

    res.status(201).json({ 
      message: `Scheduled ${createdJobs.length} email(s)`, 
      email: createdJobs[0], // Return first one for backward compatibility in UI
      createdCount: createdJobs.length 
    });
  }
);

emailsRouter.get("/", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  const status = req.query.status as string | undefined;
  const where: Record<string, unknown> = { userId: req.user!.id };

  if (status === "scheduled") {
    where.status = { in: ["SCHEDULED", "QUEUED", "SENDING", "FAILED"] };
  } else if (status === "sent") {
    where.status = "SENT";
  } else if (status === "all") {
    // no filter
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
