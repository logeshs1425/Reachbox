const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type User = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

export type EmailJob = {
  id: string;
  fromEmail: string;
  toEmail: string;
  toName: string | null;
  subject: string;
  bodyHtml: string;
  bodyText: string | null;
  scheduledAt: string;
  status: string;
  sentAt: string | null;
  etherealPreview: string | null;
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
  const data = (await res.json()) as { results: EmailJob[] };
  return data.results;
}

export async function createEmail(
  token: string,
  body: {
    fromEmail: string;
    toEmail: string;
    toName?: string;
    subject: string;
    bodyHtml: string;
    bodyText?: string;
    scheduledAt: string;
  }
): Promise<EmailJob> {
  const res = await fetch(`${API_URL}/api/emails`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
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
