import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { searchEmails } from "../elasticsearch.js";

export const searchRouter = Router();

searchRouter.use(requireAuth);

searchRouter.get("/", async (req, res) => {
  const q = String(req.query.q ?? "");
  const results = await searchEmails({
    userId: req.user!.id,
    query: q,
  });
  res.json({ results });
});
