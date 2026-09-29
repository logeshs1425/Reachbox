import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { config } from "./config.js";
import { ensureEmailIndex } from "./elasticsearch.js";
import { emailQueue } from "./queue.js";
import { startEmailWorker } from "./worker.js";
import { authRouter } from "./routes/auth.js";
import { emailsRouter } from "./routes/emails.js";
import { searchRouter } from "./routes/search.js";
import { slackRouter } from "./routes/slack.js";
import { meRouter } from "./routes/me.js";
import { recoverPendingJobs } from "./recovery.js";

export async function createApp(): Promise<express.Application> {
  await ensureEmailIndex();

  const app = express();
  app.use(
    cors({
      origin: config.frontendUrl,
      credentials: true,
    })
  );
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());
  app.use(passport.initialize());

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });
  app.use("/admin/queues", serverAdapter.getRouter());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/me", meRouter);
  app.use("/api/emails", emailsRouter);
  app.use("/api/search", searchRouter);
  app.use("/api/slack", slackRouter);

  return app;
}

export async function bootstrap(): Promise<void> {
  const recovered = await recoverPendingJobs();
  if (recovered > 0) {
    console.log(`Recovered ${recovered} pending email job(s) from database`);
  }

  const worker = startEmailWorker();
  worker.on("ready", () => {
    console.log(
      `Email worker ready (concurrency=${config.workerConcurrency}, min delay=${config.minDelayBetweenSendsMs}ms)`
    );
  });

  const app = await createApp();
  app.listen(config.port, () => {
    console.log(`API listening on http://localhost:${config.port}`);
    console.log(`Bull Board: http://localhost:${config.port}/admin/queues`);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
