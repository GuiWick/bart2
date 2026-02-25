import express, { Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import db from "../db";
import { requireAuth, requireAdmin, AuthRequest } from "../auth";
import { listChannels, getChannelMessages, formatReportForSlack, postToResponseUrl } from "../services/slack";
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
  const { bot_token, channel_ids = [], signing_secret, notification_channel_id, legal_channel_id } = req.body;
  const existingRow = db.prepare("SELECT config FROM integration_configs WHERE platform = 'slack'").get() as { config: string } | undefined;
  const existingCfg: Record<string, unknown> = existingRow ? JSON.parse(existingRow.config) : {};
  const cfg: Record<string, unknown> = {
    ...existingCfg,
    bot_token: bot_token !== undefined ? bot_token : existingCfg.bot_token,
    channel_ids,
  };
  if (signing_secret !== undefined) cfg.signing_secret = signing_secret;
  if (notification_channel_id !== undefined) cfg.notification_channel_id = notification_channel_id;
  if (legal_channel_id !== undefined) cfg.legal_channel_id = legal_channel_id;

  const existingId = db.prepare("SELECT id FROM integration_configs WHERE platform = 'slack'").get();
  if (existingId) {
    db.prepare("UPDATE integration_configs SET config = ?, is_active = 1, updated_at = datetime('now') WHERE platform = 'slack'")
      .run(JSON.stringify(cfg));
  } else {
    db.prepare("INSERT INTO integration_configs (platform, config) VALUES ('slack', ?)").run(JSON.stringify(cfg));
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

// Slack slash command — no auth, called directly by Slack
router.post("/slack/command",
  express.raw({ type: "*/*" }),
  async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf-8") : String(req.body);
    const params = new URLSearchParams(rawBody);

    const cfg = getConfig("slack");
    if (!cfg) {
      res.status(200).json({ text: "Slack integration is not configured." });
      return;
    }

    // Verify Slack signing secret if configured
    const signingSecret = cfg.signing_secret as string | undefined;
    if (signingSecret) {
      const timestamp = req.headers["x-slack-request-timestamp"] as string;
      const slackSig = req.headers["x-slack-signature"] as string;
      const age = Math.abs(Date.now() / 1000 - parseInt(timestamp || "0", 10));
      if (!timestamp || !slackSig || age > 300) {
        res.status(400).json({ text: "Request verification failed." });
        return;
      }
      const hmac = `v0=${createHmac("sha256", signingSecret).update(`v0:${timestamp}:${rawBody}`).digest("hex")}`;
      try {
        if (slackSig.length !== hmac.length || !timingSafeEqual(Buffer.from(slackSig), Buffer.from(hmac))) {
          res.status(403).json({ text: "Invalid signature." });
          return;
        }
      } catch {
        res.status(403).json({ text: "Invalid signature." });
        return;
      }
    }

    const commandText = params.get("text") || "";
    const responseUrl = params.get("response_url") || "";
    const channelId = params.get("channel_id") || "";
    const slackUserId = params.get("user_id") || "";

    // Parse optional flags --type and --jur
    let contentType = "social_media";
    let jurisdiction = "general";
    let content = commandText;
    const typeMatch = content.match(/--type\s+(\S+)/);
    const jurMatch = content.match(/--jur\s+(\S+)/);
    if (typeMatch) { contentType = typeMatch[1]; content = content.replace(typeMatch[0], "").trim(); }
    if (jurMatch) { jurisdiction = jurMatch[1]; content = content.replace(jurMatch[0], "").trim(); }
    content = content.trim();

    if (!content) {
      res.status(200).json({ text: "Usage: `/bart [content] [--type social_media|blog|email|ad_copy|crypto_marketing|financial_product] [--jur US|UK|CH|EU|general]`" });
      return;
    }

    // Respond immediately — Slack requires a response within 3 seconds
    res.status(200).json({ text: ":mag: Analyzing content… I'll post the report here when done." });

    // Insert review under first admin user
    const adminRow = db.prepare("SELECT id FROM users WHERE is_admin = 1 LIMIT 1").get() as { id: number } | undefined;
    const userId = adminRow?.id ?? 1;
    const sourceRef = JSON.stringify({ response_url: responseUrl, channel_id: channelId, user_id: slackUserId });
    const insertResult = db.prepare(
      "INSERT INTO reviews (user_id, content_type, original_content, source, source_reference, jurisdiction) VALUES (?, ?, ?, 'slack_command', ?, ?)"
    ).run(userId, contentType, content, sourceRef, jurisdiction);

    runAnalysis(insertResult.lastInsertRowid as number).catch(console.error);
  }
);

// ── Notion ────────────────────────────────────────────────────────────────────

router.post("/notion/config", requireAdmin, (req, res) => {
  const { api_key, database_ids = [], backup_database_id } = req.body;
  const existingRow = db.prepare("SELECT config FROM integration_configs WHERE platform = 'notion'").get() as { config: string } | undefined;
  const existingCfg: Record<string, unknown> = existingRow ? JSON.parse(existingRow.config) : {};
  const cfg: Record<string, unknown> = {
    ...existingCfg,
    api_key: api_key !== undefined ? api_key : existingCfg.api_key,
    database_ids,
  };
  if (backup_database_id !== undefined) cfg.backup_database_id = backup_database_id;

  const existingId = db.prepare("SELECT id FROM integration_configs WHERE platform = 'notion'").get();
  if (existingId) {
    db.prepare("UPDATE integration_configs SET config = ?, is_active = 1, updated_at = datetime('now') WHERE platform = 'notion'")
      .run(JSON.stringify(cfg));
  } else {
    db.prepare("INSERT INTO integration_configs (platform, config) VALUES ('notion', ?)").run(JSON.stringify(cfg));
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

export { getConfig };
export default router;
