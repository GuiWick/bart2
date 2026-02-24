from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from collections import Counter
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user
from datetime import datetime, timedelta, timezone

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=schemas.DashboardStats)
def get_stats(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Review)
    if not current_user.is_admin:
        query = query.filter(models.Review.user_id == current_user.id)

    all_reviews = query.filter(models.Review.status == "completed").all()
    total_reviews = query.count()

    # Average brand score
    avg_score = None
    if all_reviews:
        scores = [r.brand_score for r in all_reviews if r.brand_score is not None]
        avg_score = round(sum(scores) / len(scores), 1) if scores else None

    # Reviews this week
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    reviews_this_week = query.filter(models.Review.created_at >= week_ago).count()

    # Top compliance issues
    all_flags = []
    for review in all_reviews:
        if review.compliance_flags:
            for flag in review.compliance_flags:
                all_flags.append(flag.get("issue", "")[:80])
    top_issues = [issue for issue, _ in Counter(all_flags).most_common(5)] if all_flags else []

    # Rating distribution
    rating_dist = {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
    for r in all_reviews:
        if r.overall_rating in rating_dist:
            rating_dist[r.overall_rating] += 1

    # Sentiment distribution
    sentiment_dist = {"positive": 0, "neutral": 0, "negative": 0}
    for r in all_reviews:
        if r.sentiment in sentiment_dist:
            sentiment_dist[r.sentiment] += 1

    # Content type distribution
    content_type_dist: dict = {}
    for r in all_reviews:
        content_type_dist[r.content_type] = content_type_dist.get(r.content_type, 0) + 1

    # Recent reviews (5 most recent, any status)
    recent = (
        query.order_by(models.Review.created_at.desc()).limit(5).all()
    )

    return {
        "total_reviews": total_reviews,
        "avg_brand_score": avg_score,
        "reviews_this_week": reviews_this_week,
        "top_issues": top_issues,
        "rating_distribution": rating_dist,
        "sentiment_distribution": sentiment_dist,
        "content_type_distribution": content_type_dist,
        "recent_reviews": recent,
    }
