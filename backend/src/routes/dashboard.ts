import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import db, { rowToReview } from "../db";
import { requireAuth, AuthRequest } from "../auth";

const router = Router();

router.get("/stats", requireAuth, (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.is_admin;

  const where = isAdmin ? "" : "WHERE user_id = ?";
  const params = isAdmin ? [] : [userId];

  const total = (db.prepare(`SELECT COUNT(*) as c FROM reviews ${where}`).get(...params) as { c: number }).c;
  const completed = db.prepare(`SELECT * FROM reviews ${where ? where + " AND status = 'completed'" : "WHERE status = 'completed'"}`).all(...params) as Record<string, unknown>[];

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thisWeekWhere = isAdmin ? "WHERE created_at >= ?" : "WHERE user_id = ? AND created_at >= ?";
  const thisWeekParams = isAdmin ? [weekAgo] : [userId, weekAgo];
  const thisWeek = (db.prepare(`SELECT COUNT(*) as c FROM reviews ${thisWeekWhere}`).get(...thisWeekParams) as { c: number }).c;

  // Averages and distributions
  const scores = completed.map(r => r.brand_score as number).filter(s => s != null);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10 : null;

  const ratingDist: Record<string, number> = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  const sentimentDist: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
  const contentTypeDist: Record<string, number> = {};
  const allIssues: string[] = [];

  for (const r of completed) {
    const rating = r.overall_rating as string;
    const sentiment = r.sentiment as string;
    if (rating && rating in ratingDist) ratingDist[rating]++;
    if (sentiment && sentiment in sentimentDist) sentimentDist[sentiment]++;
    const ct = r.content_type as string;
    contentTypeDist[ct] = (contentTypeDist[ct] || 0) + 1;
    try {
      const flags = JSON.parse(r.compliance_flags as string || "[]") as { issue?: string }[];
      flags.forEach(f => f.issue && allIssues.push(f.issue.slice(0, 80)));
    } catch {}
  }

  // Top issues by frequency
  const issueCounts = allIssues.reduce((acc, i) => { acc[i] = (acc[i] || 0) + 1; return acc; }, {} as Record<string, number>);
  const topIssues = Object.entries(issueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([i]) => i);

  // Recent 5 reviews
  const recentRows = (isAdmin
    ? db.prepare("SELECT r.*, u.email, u.full_name FROM reviews r JOIN users u ON r.user_id = u.id ORDER BY r.created_at DESC LIMIT 5").all()
    : db.prepare("SELECT r.*, u.email, u.full_name FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.user_id = ? ORDER BY r.created_at DESC LIMIT 5").all(userId)
  ) as Record<string, unknown>[];

  const recent = recentRows.map(r => ({
    ...rowToReview(r),
    user: { id: r.user_id, email: r.email, full_name: r.full_name }
  }));

  res.json({
    total_reviews: total,
    avg_brand_score: avgScore,
    reviews_this_week: thisWeek,
    top_issues: topIssues,
    rating_distribution: ratingDist,
    sentiment_distribution: sentimentDist,
    content_type_distribution: contentTypeDist,
    recent_reviews: recent,
  });
});

router.post("/analyze-patterns", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const isAdmin = req.user!.is_admin;

  const where = isAdmin
    ? "WHERE status = 'completed'"
    : "WHERE user_id = ? AND status = 'completed'";
  const params = isAdmin ? [] : [userId];

  const rows = db.prepare(
    `SELECT content_type, jurisdiction, overall_rating, brand_score, risk_score, sentiment, compliance_flags FROM reviews ${where} ORDER BY created_at DESC LIMIT 50`
  ).all(...params) as Record<string, unknown>[];

  if (rows.length < 3) {
    res.status(400).json({ detail: "At least 3 completed reviews are needed for pattern analysis." });
    return;
  }

  const summary = rows.map(r => ({
    content_type: r.content_type,
    jurisdiction: r.jurisdiction || "general",
    rating: r.overall_rating,
    brand_score: r.brand_score,
    risk_score: r.risk_score,
    sentiment: r.sentiment,
    top_flags: (() => {
      try {
        const flags = JSON.parse(r.compliance_flags as string || "[]") as { issue?: string }[];
        return flags.slice(0, 3).map(f => f.issue || "").filter(Boolean);
      } catch { return []; }
    })(),
  }));

  const gl = db.prepare("SELECT content FROM brand_guidelines LIMIT 1").get() as { content: string } | undefined;
  const guidelinesText = gl?.content?.trim() || "(none configured)";

  const prompt = `You are a senior brand strategist and compliance advisor at NEAR Foundation.

Below is a summary of ${summary.length} recent content reviews and the current brand guidelines.

## Review History Summary
${JSON.stringify(summary, null, 2)}

## Current Brand Guidelines
${guidelinesText.slice(0, 3000)}

Analyze the review history to identify recurring patterns, sentiment trends, jurisdiction-specific issues, and areas where the brand guidelines could be improved or expanded.

Return ONLY valid JSON (no markdown fences) matching this exact schema:
{
  "patterns": ["<pattern observed across reviews>"],
  "sentiment_insights": "<overall observation about sentiment trends>",
  "jurisdiction_notes": { "<jurisdiction>": "<specific observations for that jurisdiction>" },
  "guideline_suggestions": [
    {
      "suggestion": "<specific guideline text to add or modify>",
      "rationale": "<why this would help based on observed patterns>"
    }
  ]
}`;

  try {
    const client = new Anthropic();
    const stream = client.messages.stream({
      model: "claude-opus-4-6",
      max_tokens: 8000,
      // @ts-ignore — adaptive thinking supported but not in SDK types
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    });

    const final = await stream.finalMessage();
    let text = "";
    for (const block of final.content) {
      if (block.type === "text") { text = block.text.trim(); break; }
    }
    if (text.startsWith("```")) {
      const lines = text.split("\n");
      text = lines.slice(1, lines[lines.length - 1].trim() === "```" ? -1 : undefined).join("\n");
    }
    res.json(JSON.parse(text));
  } catch (err) {
    res.status(500).json({ detail: String(err) });
  }
});

export default router;
