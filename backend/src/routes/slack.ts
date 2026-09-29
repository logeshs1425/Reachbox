import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { config } from "../config.js";
import { prisma } from "../db.js";
import {
  disconnectSlack,
  exchangeSlackCode,
  getSlackAuthorizeUrl,
} from "../slack.js";

export const slackRouter = Router();

slackRouter.get("/connect", requireAuth, (req, res) => {
  if (!config.slack.clientId) {
    res.status(503).json({ error: "Slack not configured" });
    return;
  }
  const url = getSlackAuthorizeUrl(req.user!.id);
  res.json({ url });
});

slackRouter.get("/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const stateRaw = req.query.state as string | undefined;

  if (!code || !stateRaw) {
    res.redirect(`${config.frontendUrl}/dashboard?slack=error`);
    return;
  }

  try {
    const state = JSON.parse(
      Buffer.from(stateRaw, "base64url").toString("utf8")
    ) as { userId: string };

    const tokens = await exchangeSlackCode(code);

    await prisma.slackConnection.upsert({
      where: { userId: state.userId },
      create: {
        userId: state.userId,
        accessToken: tokens.accessToken,
        teamId: tokens.teamId,
        teamName: tokens.teamName,
        botUserId: tokens.botUserId,
        authedUserId: tokens.authedUserId,
      },
      update: {
        accessToken: tokens.accessToken,
        teamId: tokens.teamId,
        teamName: tokens.teamName,
        botUserId: tokens.botUserId,
        authedUserId: tokens.authedUserId,
      },
    });

    res.redirect(`${config.frontendUrl}/dashboard?slack=connected`);
  } catch {
    res.redirect(`${config.frontendUrl}/dashboard?slack=error`);
  }
});

slackRouter.get("/status", requireAuth, async (req, res) => {
  const conn = await prisma.slackConnection.findUnique({
    where: { userId: req.user!.id },
  });
  res.json({
    connected: !!conn,
    teamName: conn?.teamName ?? null,
  });
});

slackRouter.post("/disconnect", requireAuth, async (req, res) => {
  await disconnectSlack(req.user!.id);
  res.json({ ok: true });
});
