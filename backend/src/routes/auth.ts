import { Router } from "express";
import db, { rowToUser } from "../db";
import { hashPassword, verifyPassword, createToken, requireAuth, requireAdmin, AuthRequest } from "../auth";

const router = Router();

const ALLOWED_DOMAINS = ["near.foundation", "nearsp.com"];

router.post("/register", (req, res) => {
  const { email, password, full_name = "" } = req.body;
  if (!email || !password) {
    res.status(400).json({ detail: "Email and password required" });
    return;
  }
  const isFirst = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c === 0;
  if (!isFirst && !ALLOWED_DOMAINS.some(d => email.endsWith(`@${d}`))) {
    res.status(403).json({ detail: `Self-registration is limited to @near.foundation and @nearsp.com addresses. Contact your admin for access.` });
    return;
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    res.status(400).json({ detail: "Email already registered" });
    return;
  }
  const result = db
    .prepare("INSERT INTO users (email, hashed_password, full_name, is_admin) VALUES (?, ?, ?, ?)")
    .run(email, hashPassword(password), full_name, isFirst ? 1 : 0);
  const user = rowToUser(db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>);
  res.json({ access_token: createToken(user.id as number), token_type: "bearer", user });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as Record<string, unknown> | undefined;
  if (!row || !verifyPassword(password, row.hashed_password as string)) {
    res.status(401).json({ detail: "Invalid email or password" });
    return;
  }
  if (!row.is_active) {
    res.status(403).json({ detail: "Account is disabled" });
    return;
  }
  const user = rowToUser(row);
  res.json({ access_token: createToken(user.id as number), token_type: "bearer", user });
});

router.get("/me", requireAuth, (req: AuthRequest, res) => {
  res.json(req.user);
});

router.put("/me", requireAuth, (req: AuthRequest, res) => {
  const { full_name, password } = req.body;
  const id = req.user!.id;
  if (full_name !== undefined) db.prepare("UPDATE users SET full_name = ? WHERE id = ?").run(full_name, id);
  if (password) db.prepare("UPDATE users SET hashed_password = ? WHERE id = ?").run(hashPassword(password), id);
  res.json(rowToUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown>));
});

// Admin routes
router.get("/users", requireAdmin, (_req, res) => {
  const rows = db.prepare("SELECT * FROM users ORDER BY created_at").all() as Record<string, unknown>[];
  res.json(rows.map(rowToUser));
});

router.post("/users", requireAdmin, (req, res) => {
  const { email, password, full_name = "" } = req.body;
  if (!email || !password) { res.status(400).json({ detail: "Email and password required" }); return; }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    res.status(400).json({ detail: "Email already registered" }); return;
  }
  const result = db
    .prepare("INSERT INTO users (email, hashed_password, full_name, is_admin) VALUES (?, ?, ?, 0)")
    .run(email, hashPassword(password), full_name);
  res.status(201).json(rowToUser(db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid) as Record<string, unknown>));
});

router.put("/users/:id", requireAdmin, (req, res) => {
  const { full_name, password } = req.body;
  const id = parseInt(req.params.id);
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) { res.status(404).json({ detail: "User not found" }); return; }
  if (full_name !== undefined) db.prepare("UPDATE users SET full_name = ? WHERE id = ?").run(full_name, id);
  if (password) db.prepare("UPDATE users SET hashed_password = ? WHERE id = ?").run(hashPassword(password), id);
  res.json(rowToUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown>));
});

router.delete("/users/:id", requireAdmin, (req: AuthRequest, res) => {
  const id = parseInt(req.params.id);
  if (id === req.user!.id) { res.status(400).json({ detail: "Cannot deactivate yourself" }); return; }
  const row = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
  if (!row) { res.status(404).json({ detail: "User not found" }); return; }
  db.prepare("UPDATE users SET is_active = 0 WHERE id = ?").run(id);
  res.status(204).send();
});

export default router;
