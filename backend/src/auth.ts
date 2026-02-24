import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { Request, Response, NextFunction } from "express";
import { config } from "./config";
import db, { rowToUser } from "./db";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(plain: string, hashed: string): boolean {
  return bcrypt.compareSync(plain, hashed);
}

export function createToken(userId: number): string {
  return jwt.sign({ sub: String(userId) }, config.secretKey, {
    expiresIn: `${config.accessTokenExpireHours}h`,
  });
}

export interface AuthRequest extends Request {
  user?: ReturnType<typeof rowToUser>;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ detail: "Missing token" });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.secretKey) as { sub: string };
    const row = db
      .prepare("SELECT * FROM users WHERE id = ? AND is_active = 1")
      .get(Number(payload.sub)) as Record<string, unknown> | undefined;
    if (!row) {
      res.status(401).json({ detail: "User not found" });
      return;
    }
    req.user = rowToUser(row);
    next();
  } catch {
    res.status(401).json({ detail: "Invalid or expired token" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (!req.user?.is_admin) {
      res.status(403).json({ detail: "Admin access required" });
      return;
    }
    next();
  });
}
