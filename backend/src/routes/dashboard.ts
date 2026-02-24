import { Router } from "express";
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

export default router;
