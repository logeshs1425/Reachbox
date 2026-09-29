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

  const testAccount = await nodemailer.createTestAccount();
  await prisma.senderProfile.create({
    data: {
      userId,
      email: fromEmail,
      smtpUser: testAccount.user,
      smtpPass: testAccount.pass,
      smtpHost: testAccount.smtp.host,
      smtpPort: testAccount.smtp.port,
    },
  });

  return {
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    user: testAccount.user,
    pass: testAccount.pass,
  };
}

export async function sendEmail(params: {
  smtp: SmtpConfig;
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<{ messageId: string; previewUrl?: string }> {
  const transporter = nodemailer.createTransport({
    host: params.smtp.host,
    port: params.smtp.port,
    secure: false,
    auth: { user: params.smtp.user, pass: params.smtp.pass },
  });

  const info = await transporter.sendMail({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  });

  const preview = nodemailer.getTestMessageUrl(info);
  const previewUrl = typeof preview === "string" ? preview : undefined;
  return { messageId: info.messageId, previewUrl };
}
