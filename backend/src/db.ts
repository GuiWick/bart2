// @ts-ignore — node:sqlite types available in @types/node ≥22.5
import { DatabaseSync } from "node:sqlite";
import { config } from "./config";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = new DatabaseSync(config.databasePath);

db.exec(`PRAGMA journal_mode=WAL;`);

// Migrations — safe to run on existing databases
try { db.exec("ALTER TABLE reviews ADD COLUMN jurisdiction TEXT DEFAULT 'general'"); } catch {}
try { db.exec("ALTER TABLE reviews ADD COLUMN source_filename TEXT"); } catch {}
try { db.exec("ALTER TABLE reviews ADD COLUMN risk_score REAL"); } catch {}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    email           TEXT UNIQUE NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name       TEXT DEFAULT '',
    is_admin        INTEGER DEFAULT 0,
    is_active       INTEGER DEFAULT 1,
    created_at      TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS brand_guidelines (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    content    TEXT DEFAULT '',
    updated_at TEXT DEFAULT (datetime('now')),
    updated_by INTEGER
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL,
    content_type      TEXT NOT NULL,
    original_content  TEXT NOT NULL,
    source            TEXT DEFAULT 'manual',
    source_reference  TEXT,
    brand_score       REAL,
    brand_feedback    TEXT,
    compliance_flags  TEXT DEFAULT '[]',
    sentiment         TEXT,
    sentiment_score   REAL,
    sentiment_feedback TEXT,
    suggested_rewrite TEXT,
    overall_rating    TEXT,
    summary           TEXT,
    status            TEXT DEFAULT 'pending',
    error_message     TEXT,
    created_at        TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS integration_configs (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    platform   TEXT NOT NULL,
    config     TEXT DEFAULT '{}',
    is_active  INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
  );
`);

export default db;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function rowToUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    is_admin: Boolean(row.is_admin),
    is_active: Boolean(row.is_active),
    created_at: row.created_at,
  };
}

export function rowToReview(row: Record<string, unknown>) {
  return {
    id: row.id,
    user_id: row.user_id,
    content_type: row.content_type,
    original_content: row.original_content,
    source: row.source,
    source_reference: row.source_reference,
    brand_score: row.brand_score,
    brand_feedback: row.brand_feedback,
    compliance_flags: row.compliance_flags
      ? JSON.parse(row.compliance_flags as string)
      : [],
    risk_score: row.risk_score,
    sentiment: row.sentiment,
    sentiment_score: row.sentiment_score,
    sentiment_feedback: row.sentiment_feedback,
    suggested_rewrite: row.suggested_rewrite,
    overall_rating: row.overall_rating,
    summary: row.summary,
    status: row.status,
    error_message: row.error_message,
    jurisdiction: row.jurisdiction || "general",
    source_filename: row.source_filename,
    created_at: row.created_at,
  };
}
