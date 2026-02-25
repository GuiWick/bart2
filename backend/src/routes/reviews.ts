import { Router } from "express";
import multer from "multer";
import db, { rowToReview } from "../db";
import { requireAuth, AuthRequest } from "../auth";
import { analyzeContent } from "../services/claude";
import { formatReportForSlack, postToResponseUrl, postReviewToChannel } from "../services/slack";
import { createReviewPage } from "../services/notion";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

function getIntegrationConfig(platform: string): Record<string, unknown> | null {
  const row = db.prepare("SELECT * FROM integration_configs WHERE platform = ? AND is_active = 1").get(platform) as Record<string, unknown> | undefined;
  if (!row) return null;
  return JSON.parse(row.config as string) as Record<string, unknown>;
}

async function extractText(buffer: Buffer, mimetype: string, originalname: string): Promise<string> {
  const ext = originalname.split(".").pop()?.toLowerCase();
  if (ext === "txt" || mimetype === "text/plain") {
    return buffer.toString("utf-8");
  }
  if (ext === "pdf" || mimetype === "application/pdf") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (b: Buffer) => Promise<{ text: string }>;
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (ext === "docx" || mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error(`Unsupported file type: .${ext}. Please upload PDF, DOCX, or TXT.`);
}

export async function runAnalysis(reviewId: number) {
  try {
    const row = db.prepare("SELECT * FROM reviews WHERE id = ?").get(reviewId) as Record<string, unknown>;
    if (!row) return;
    const gl = db.prepare("SELECT content FROM brand_guidelines LIMIT 1").get() as { content: string } | undefined;
    const result = await analyzeContent(
      row.original_content as string,
      row.content_type as string,
      gl?.content || "",
      (row.jurisdiction as string) || "general"
    );
    db.prepare(`
      UPDATE reviews SET
        brand_score = ?, brand_feedback = ?, compliance_flags = ?,
        risk_score = ?, sentiment = ?, sentiment_score = ?, sentiment_feedback = ?,
        suggested_rewrite = ?, overall_rating = ?, summary = ?, status = 'completed'
      WHERE id = ?
    `).run(
      result.brand_score as number,
      result.brand_feedback as string,
      JSON.stringify(result.compliance_flags),
      result.risk_score as number,
      result.sentiment as string,
      result.sentiment_score as number,
      result.sentiment_feedback as string,
      result.suggested_rewrite as string,
      result.overall_rating as string,
      result.summary as string,
      reviewId
    );

    // Post-analysis hooks
    const updatedRow = db.prepare("SELECT * FROM reviews WHERE id = ?").get(reviewId) as Record<string, unknown>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedReview = rowToReview(updatedRow) as any;

    // Slack slash command: post formatted report back to response_url
    if (updatedRow.source === "slack_command" && updatedRow.source_reference) {
      try {
        const ref = JSON.parse(updatedRow.source_reference as string) as { response_url?: string };
        if (ref.response_url) {
          const blocks = formatReportForSlack(updatedReview);
          postToResponseUrl(ref.response_url, blocks).catch(console.error);
        }
      } catch {}
    }

    // Slack notification channel for web/non-command reviews
    try {
      const slackCfg = getIntegrationConfig("slack");
      if (slackCfg?.notification_channel_id && updatedRow.source !== "slack_command") {
        postReviewToChannel(
          slackCfg.bot_token as string,
          slackCfg.notification_channel_id as string,
          updatedReview
        ).catch(console.error);
      }
    } catch {}

    // Notion backup
    try {
      const notionCfg = getIntegrationConfig("notion");
      if (notionCfg?.backup_database_id) {
        createReviewPage(
          notionCfg.api_key as string,
          notionCfg.backup_database_id as string,
          updatedReview
        ).catch(console.error);
      }
    } catch {}
  } catch (err) {
    db.prepare("UPDATE reviews SET status = 'error', error_message = ? WHERE id = ?")
      .run(String(err), reviewId);
  }
}

router.post("/", requireAuth, (req: AuthRequest, res) => {
  const { content_type, original_content, source = "manual", source_reference = null, jurisdiction = "general" } = req.body;
  if (!content_type || !original_content) {
    res.status(400).json({ detail: "content_type and original_content required" });
    return;
  }
  const result = db.prepare(
    "INSERT INTO reviews (user_id, content_type, original_content, source, source_reference, jurisdiction) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(req.user!.id, content_type, original_content, source, source_reference, jurisdiction);

  const review = rowToReview(db.prepare("SELECT * FROM reviews WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>);
  runAnalysis(review.id as number).catch(console.error);
  res.status(202).json(review);
});

router.post("/upload", requireAuth, upload.single("file"), async (req: AuthRequest, res) => {
  const { content_type = "blog", jurisdiction = "general" } = req.body;
  if (!req.file) {
    res.status(400).json({ detail: "No file uploaded" });
    return;
  }
  try {
    const text = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);
    if (!text.trim()) {
      res.status(400).json({ detail: "Could not extract text from the uploaded file." });
      return;
    }
    const result = db.prepare(
      "INSERT INTO reviews (user_id, content_type, original_content, source, source_reference, jurisdiction, source_filename) VALUES (?, ?, ?, 'upload', null, ?, ?)"
    ).run(req.user!.id, content_type, text.trim(), jurisdiction, req.file.originalname);

    const review = rowToReview(db.prepare("SELECT * FROM reviews WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>);
    runAnalysis(review.id as number).catch(console.error);
    res.status(202).json(review);
  } catch (err) {
    res.status(400).json({ detail: String(err) });
  }
});

router.get("/", requireAuth, (req: AuthRequest, res) => {
  const skip = parseInt(req.query.skip as string || "0");
  const limit = Math.min(parseInt(req.query.limit as string || "50"), 200);
  let rows: Record<string, unknown>[];
  if (req.user!.is_admin) {
    rows = db.prepare("SELECT r.*, u.email, u.full_name FROM reviews r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT ? OFFSET ?").all(limit, skip) as Record<string, unknown>[];
  } else {
    rows = db.prepare("SELECT r.*, u.email, u.full_name FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT ? OFFSET ?").all(req.user!.id, limit, skip) as Record<string, unknown>[];
  }
  res.json(rows.map(r => ({
    ...rowToReview(r),
    user: { id: r.user_id, email: r.email, full_name: r.full_name }
  })));
});

router.get("/:id", requireAuth, (req: AuthRequest, res) => {
  const row = db.prepare("SELECT r.*, u.email, u.full_name FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.id = ?").get(parseInt(req.params.id)) as Record<string, unknown> | undefined;
  if (!row) { res.status(404).json({ detail: "Review not found" }); return; }
  if (!req.user!.is_admin && row.user_id !== req.user!.id) { res.status(403).json({ detail: "Access denied" }); return; }
  res.json({ ...rowToReview(row), user: { id: row.user_id, email: row.email, full_name: row.full_name } });
});

router.delete("/:id", requireAuth, (req: AuthRequest, res) => {
  const row = db.prepare("SELECT * FROM reviews WHERE id = ?").get(parseInt(req.params.id)) as Record<string, unknown> | undefined;
  if (!row) { res.status(404).json({ detail: "Review not found" }); return; }
  if (!req.user!.is_admin && row.user_id !== req.user!.id) { res.status(403).json({ detail: "Access denied" }); return; }
  db.prepare("DELETE FROM reviews WHERE id = ?").run(parseInt(req.params.id));
  res.status(204).send();
});

export default router;
