import { prisma } from "./db.js";
import { config } from "./config.js";

const SLACK_API = "https://slack.com/api";

export function getSlackAuthorizeUrl(userId: string): string {
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64url");
  const scopes = ["chat:write", "im:write", "users:read"].join(",");

  const params = new URLSearchParams({
    client_id: config.slack.clientId,
    scope: scopes,
    redirect_uri: config.slack.redirectUri,
    state,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCode(code: string): Promise<{
  accessToken: string;
  teamId?: string;
  teamName?: string;
  botUserId?: string;
  authedUserId?: string;
}> {
  const body = new URLSearchParams({
    client_id: config.slack.clientId,
    client_secret: config.slack.clientSecret,
    code,
    redirect_uri: config.slack.redirectUri,
  });

  const res = await fetch(`${SLACK_API}/oauth.v2.access`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json()) as {
    ok: boolean;
    access_token?: string;
    team?: { id: string; name: string };
    bot_user_id?: string;
    authed_user?: { id: string };
    error?: string;
  };

  if (!data.ok || !data.access_token) {
    throw new Error(data.error ?? "Slack OAuth failed");
  }

  return {
    accessToken: data.access_token,
    teamId: data.team?.id,
    teamName: data.team?.name,
    botUserId: data.bot_user_id,
    authedUserId: data.authed_user?.id,
  };
}

async function slackApi<T>(
  token: string,
  method: string,
  payload: Record<string, unknown>
): Promise<T & { ok: boolean; error?: string }> {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(payload),
  });
  return (await res.json()) as T & { ok: boolean; error?: string };
}

async function resolveDmChannel(
  token: string,
  authedUserId: string
): Promise<string | null> {
  const open = await slackApi<{ channel?: { id: string } }>(
    token,
    "conversations.open",
    { users: authedUserId }
  );
  if (open.ok && open.channel?.id) return open.channel.id;
  return null;
}

export async function notifySlackRateLimit(params: {
  userId: string;
  senderEmail: string;
  reason: "global" | "sender";
  limit: number;
}): Promise<void> {
  const conn = await prisma.slackConnection.findUnique({
    where: { userId: params.userId },
  });
  if (!conn?.accessToken) return;

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  const text = [
    `:warning: *Hourly email rate limit reached*`,
    `Account: ${user?.email ?? params.userId}`,
    `Sender: \`${params.senderEmail}\``,
    `Type: ${params.reason === "global" ? "Global" : "Per-sender"}`,
    `Limit: ${params.limit}/hour`,
    `Pending jobs are delayed to the next UTC hour window.`,
  ].join("\n");

  let channelId = conn.channelId;
  if (!channelId && conn.authedUserId) {
    channelId = await resolveDmChannel(conn.accessToken, conn.authedUserId);
    if (channelId) {
      await prisma.slackConnection.update({
        where: { userId: params.userId },
        data: { channelId },
      });
    }
  }

  if (!channelId) return;

  await slackApi(conn.accessToken, "chat.postMessage", {
    channel: channelId,
    text,
  });
}

export async function disconnectSlack(userId: string): Promise<void> {
  await prisma.slackConnection.deleteMany({ where: { userId } });
}
