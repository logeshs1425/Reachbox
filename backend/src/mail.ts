import nodemailer from "nodemailer";
import { prisma } from "./db.js";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
};

export async function getOrCreateEtherealSender(
  userId: string,
  fromEmail: string
): Promise<SmtpConfig> {
  const existing = await prisma.senderProfile.findUnique({
    where: { userId_email: { userId, email: fromEmail } },
  });
  if (existing) {
    return {
      host: existing.smtpHost,
      port: existing.smtpPort,
      user: existing.smtpUser,
      pass: existing.smtpPass,
    };
  }

  let testAccount;
  let attempts = 0;
  while (attempts < 3) {
    try {
      testAccount = await nodemailer.createTestAccount();
      break;
    } catch (e) {
      attempts++;
      if (attempts >= 3) throw e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  await prisma.senderProfile.create({
    data: {
      userId,
      email: fromEmail,
      smtpUser: testAccount!.user,
      smtpPass: testAccount!.pass,
      smtpHost: testAccount!.smtp.host,
      smtpPort: testAccount!.smtp.port,
    },
  });

  return {
    host: testAccount!.smtp.host,
    port: testAccount!.smtp.port,
    user: testAccount!.user,
    pass: testAccount!.pass,
  };
}

export type MailAttachment = {
  filename: string;
  contentType: string;
  base64: string;
};

export async function sendEmail(params: {
  smtp: SmtpConfig;
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
}): Promise<{ messageId: string; previewUrl?: string }> {
  const transporter = nodemailer.createTransport({
    host: params.smtp.host,
    port: params.smtp.port,
    secure: false,
    auth: { user: params.smtp.user, pass: params.smtp.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  const info = await transporter.sendMail({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
    attachments: params.attachments?.map((a) => ({
      filename: a.filename,
      content: Buffer.from(a.base64, "base64"),
      contentType: a.contentType,
    })),
  });

  const preview = nodemailer.getTestMessageUrl(info);
  const previewUrl = typeof preview === "string" ? preview : undefined;
  return { messageId: info.messageId, previewUrl };
}
