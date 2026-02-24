import { Router } from "express";
import db from "../db";
import { requireAuth, requireAdmin, AuthRequest } from "../auth";

const router = Router();

router.get("/guidelines", requireAuth, (_req, res) => {
  let row = db.prepare("SELECT * FROM brand_guidelines LIMIT 1").get() as Record<string, unknown> | undefined;
  if (!row) {
    db.prepare("INSERT INTO brand_guidelines (content) VALUES ('')").run();
    row = db.prepare("SELECT * FROM brand_guidelines LIMIT 1").get() as Record<string, unknown>;
  }
  res.json(row);
});

router.put("/guidelines", requireAdmin, (req: AuthRequest, res) => {
  const { content } = req.body;
  const existing = db.prepare("SELECT id FROM brand_guidelines LIMIT 1").get();
  if (existing) {
    db.prepare("UPDATE brand_guidelines SET content = ?, updated_at = datetime('now'), updated_by = ?").run(content, req.user!.id);
  } else {
    db.prepare("INSERT INTO brand_guidelines (content, updated_by) VALUES (?, ?)").run(content, req.user!.id);
  }
  res.json(db.prepare("SELECT * FROM brand_guidelines LIMIT 1").get());
});

export default router;
