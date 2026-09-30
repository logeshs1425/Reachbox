const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type AttachmentMeta = {
  filename: string;
  contentType: string;
  size: number;
};

export type EmailJob = {
  id: string;
  fromEmail: string;
  toEmail: string;
  toName: string | null;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  attachmentsJson: AttachmentMeta[] | null;
  scheduledAt: string;
  status: string;
  sentAt: string | null;
  etherealPreview: string | null;
  errorMessage: string | null;
  createdAt: string;
};

function authHeaders(token: string | null): HeadersInit {
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function fetchMe(token: string): Promise<User> {
  const res = await fetch(`${API_URL}/api/me`, {
    headers: authHeaders(token),
    credentials: "include",
  });
  if (!res.ok) throw new Error("Unauthorized");
  const data = (await res.json()) as { user: User };
  return data.user;
}

export async function fetchEmails(
  token: string,
  status: "scheduled" | "sent"
): Promise<EmailJob[]> {
  const res = await fetch(`${API_URL}/api/emails?status=${status}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Could not load emails");
  const data = (await res.json()) as { emails: EmailJob[] };
  return data.emails;
}

export async function fetchEmail(
  token: string,
  id: string
): Promise<EmailJob> {
  const res = await fetch(`${API_URL}/api/emails/${id}`, {
    headers: authHeaders(token),
  });
  const data = (await res.json()) as { email: EmailJob };
  return data.email;
}

export async function searchEmails(
  token: string,
  q: string
): Promise<EmailJob[]> {
  const res = await fetch(
    `${API_URL}/api/search?q=${encodeURIComponent(q)}`,
    { headers: authHeaders(token) }
  );
  if (!res.ok) throw new Error("Could not search emails");
  const data = (await res.json()) as { results: Partial<EmailJob>[] };
  return data.results.map((email) => ({
    id: email.id!, fromEmail: email.fromEmail ?? "", toEmail: email.toEmail ?? "",
    toName: email.toName ?? null, subject: email.subject ?? "", bodyHtml: email.bodyHtml ?? email.bodyText ?? "",
    bodyText: email.bodyText ?? null, attachmentsJson: email.attachmentsJson ?? null,
    scheduledAt: email.scheduledAt ?? email.createdAt ?? new Date().toISOString(),
    status: email.status ?? "QUEUED", sentAt: email.sentAt ?? null, etherealPreview: email.etherealPreview ?? null,
    createdAt: email.createdAt ?? new Date().toISOString(),
  }));
}

export async function exchangeLoginCode(code: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/auth/exchange`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
  });
  if (!res.ok) throw new Error("Login code could not be exchanged");
  return ((await res.json()) as { token: string }).token;
}

export async function createEmail(
  token: string,
  body: {
    fromEmail: string;
    toEmail?: string;
    toName?: string;
    leads?: { email: string; name?: string }[];
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    scheduledAt: string;
    delaySeconds?: number;
    hourlyLimit?: number;
    attachments?: File[];
  }
): Promise<EmailJob> {
  const form = new FormData();
  form.append("fromEmail", body.fromEmail);
  if (body.toEmail) form.append("toEmail", body.toEmail);
  if (body.toName) form.append("toName", body.toName);
  if (body.leads && body.leads.length > 0) {
    form.append("leads", JSON.stringify(body.leads));
  }
  form.append("subject", body.subject);
  form.append("bodyHtml", body.bodyHtml);
  if (body.bodyText) form.append("bodyText", body.bodyText);
  form.append("scheduledAt", body.scheduledAt);
  if (body.delaySeconds) form.append("delaySeconds", body.delaySeconds.toString());
  if (body.hourlyLimit) form.append("hourlyLimit", body.hourlyLimit.toString());
  (body.attachments ?? []).forEach((f) => form.append("attachments", f));

  // Do NOT set Content-Type manually — browser sets multipart boundary automatically
  const headers: HeadersInit = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/emails`, {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(JSON.stringify(err));
  }
  const data = (await res.json()) as { email: EmailJob };
  return data.email;
}

export async function getSlackConnectUrl(token: string): Promise<string> {
  const res = await fetch(`${API_URL}/api/slack/connect`, {
    headers: authHeaders(token),
  });
  const data = (await res.json()) as { url: string };
  return data.url;
}

export async function getSlackStatus(
  token: string
): Promise<{ connected: boolean; teamName: string | null }> {
  const res = await fetch(`${API_URL}/api/slack/status`, {
    headers: authHeaders(token),
  });
  return res.json();
}

export async function disconnectSlack(token: string): Promise<void> {
  await fetch(`${API_URL}/api/slack/disconnect`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function logout(token: string): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    headers: authHeaders(token),
    credentials: "include",
  });
}

export function googleLoginUrl(): string {
  return `${API_URL}/api/auth/google`;
}

export { API_URL };
