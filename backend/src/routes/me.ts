import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { config } from "../config.js";

export const meRouter = Router();

meRouter.get("/", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

meRouter.get("/limits", requireAuth, (_req, res) => {
  res.json({
    workerConcurrency: config.workerConcurrency,
    minDelayBetweenSendsMs: config.minDelayBetweenSendsMs,
    maxEmailsPerHour: config.maxEmailsPerHour,
    maxEmailsPerHourPerSender: config.maxEmailsPerHourPerSender,
  });
});
