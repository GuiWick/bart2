import { Router } from "express";
import db from "../db";
import { requireAuth, requireAdmin, AuthRequest } from "../auth";
import { listChannels, getChannelMessages } from "../services/slack";
import { listDatabases, getDatabasePages } from "../services/notion";
import { runAnalysis } from "./reviews";

const router = Router();

function getConfig(platform: string) {
  const row = db.prepare("SELECT * FROM integration_configs WHERE platform = ? AND is_active = 1").get(platform) as Record<string, unknown> | undefined;
  if (!row) return null;
  return JSON.parse(row.config as string) as Record<string, unknown>;
}

// ── Slack ─────────────────────────────────────────────────────────────────────

router.post("/slack/config", requireAdmin, (req, res) => {
  const { bot_token, channel_ids = [] } = req.body;
  const existing = db.prepare("SELECT id FROM integration_configs WHERE platform = 'slack'").get();
  if (existing) {
    db.prepare("UPDATE integration_configs SET config = ?, is_active = 1, updated_at = datetime('now') WHERE platform = 'slack'")
      .run(JSON.stringify({ bot_token, channel_ids }));
  } else {
    db.prepare("INSERT INTO integration_configs (platform, config) VALUES ('slack', ?)").run(JSON.stringify({ bot_token, channel_ids }));
  }
  res.json({ status: "saved" });
});

router.get("/slack/channels", requireAuth, async (_req, res) => {
  const cfg = getConfig("slack");
  if (!cfg) { res.status(404).json({ detail: "Slack not configured" }); return; }
  try {
    res.json(await listChannels(cfg.bot_token as string));
  } catch (e) {
    res.status(400).json({ detail: String(e) });
  }
});

router.post("/slack/fetch", requireAuth, async (req: AuthRequest, res) => {
  const { channel_id, limit = 20 } = req.query;
  const cfg = getConfig("slack");
  if (!cfg) { res.status(404).json({ detail: "Slack not configured" }); return; }
  try {
    const messages = await getChannelMessages(cfg.bot_token as string, channel_id as string, Number(limit));
    const ids: number[] = [];
    for (const msg of messages) {
      const result = db.prepare(
        "INSERT INTO reviews (user_id, content_type, original_content, source, source_reference) VALUES (?, 'social_media', ?, 'slack', ?)"
      ).run(req.user!.id, msg.text, `${msg.channel_name}/${msg.ts}`);
      ids.push(result.lastInsertRowid as number);
    }
    // Analyse in background
    Promise.all(ids.map(id => runAnalysis(id))).catch(console.error);
    res.json({ queued: ids.length, review_ids: ids });
  } catch (e) {
    res.status(400).json({ detail: String(e) });
  }
});

// ── Notion ────────────────────────────────────────────────────────────────────

router.post("/notion/config", requireAdmin, (req, res) => {
  const { api_key, database_ids = [] } = req.body;
  const existing = db.prepare("SELECT id FROM integration_configs WHERE platform = 'notion'").get();
  if (existing) {
    db.prepare("UPDATE integration_configs SET config = ?, is_active = 1, updated_at = datetime('now') WHERE platform = 'notion'")
      .run(JSON.stringify({ api_key, database_ids }));
  } else {
    db.prepare("INSERT INTO integration_configs (platform, config) VALUES ('notion', ?)").run(JSON.stringify({ api_key, database_ids }));
  }
  res.json({ status: "saved" });
});

router.get("/notion/databases", requireAuth, async (_req, res) => {
  const cfg = getConfig("notion");
  if (!cfg) { res.status(404).json({ detail: "Notion not configured" }); return; }
  try {
    res.json(await listDatabases(cfg.api_key as string));
  } catch (e) {
    res.status(400).json({ detail: String(e) });
  }
});

router.post("/notion/fetch", requireAuth, async (req: AuthRequest, res) => {
  const { database_id, content_type = "blog", limit = 20 } = req.query;
  const cfg = getConfig("notion");
  if (!cfg) { res.status(404).json({ detail: "Notion not configured" }); return; }
  try {
    const pages = await getDatabasePages(cfg.api_key as string, database_id as string, Number(limit));
    const ids: number[] = [];
    for (const page of pages) {
      if (!page.content.trim()) continue;
      const result = db.prepare(
        "INSERT INTO reviews (user_id, content_type, original_content, source, source_reference) VALUES (?, ?, ?, 'notion', ?)"
      ).run(req.user!.id, content_type, page.content, page.id);
      ids.push(result.lastInsertRowid as number);
    }
    Promise.all(ids.map(id => runAnalysis(id))).catch(console.error);
    res.json({ queued: ids.length, review_ids: ids });
  } catch (e) {
    res.status(400).json({ detail: String(e) });
  }
});

router.get("/status", requireAuth, (_req, res) => {
  const configs = db.prepare("SELECT platform FROM integration_configs WHERE is_active = 1").all() as { platform: string }[];
  const status: Record<string, boolean> = { slack: false, notion: false };
  configs.forEach(c => { if (c.platform in status) status[c.platform] = true; });
  res.json(status);
});

export default router;
