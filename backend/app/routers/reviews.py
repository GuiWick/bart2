import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user
from app.services import claude_service

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


def _get_brand_guidelines(db: Session) -> str:
    guidelines = db.query(models.BrandGuidelines).first()
    return guidelines.content if guidelines else ""


async def _run_analysis(review_id: int):
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        review = db.query(models.Review).filter(models.Review.id == review_id).first()
        if not review:
            return
        brand_guidelines = _get_brand_guidelines(db)
        result = await claude_service.analyze_content(
            content=review.original_content,
            content_type=review.content_type,
            brand_guidelines=brand_guidelines,
        )
        review.brand_score = result["brand_score"]
        review.brand_feedback = result["brand_feedback"]
        review.compliance_flags = result["compliance_flags"]
        review.sentiment = result["sentiment"]
        review.sentiment_score = result["sentiment_score"]
        review.sentiment_feedback = result["sentiment_feedback"]
        review.suggested_rewrite = result["suggested_rewrite"]
        review.overall_rating = result["overall_rating"]
        review.summary = result["summary"]
        review.status = "completed"
        db.commit()
    except Exception as e:
        db = SessionLocal()
        review = db.query(models.Review).filter(models.Review.id == review_id).first()
        if review:
            review.status = "error"
            review.error_message = str(e)
            db.commit()
    finally:
        db.close()


@router.post("/", response_model=schemas.ReviewOut, status_code=202)
async def create_review(
    payload: schemas.ReviewCreate,
    background_tasks: BackgroundTasks,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = models.Review(
        user_id=current_user.id,
        content_type=payload.content_type,
        original_content=payload.original_content,
        source=payload.source,
        source_reference=payload.source_reference,
        status="pending",
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    background_tasks.add_task(asyncio.run, _run_analysis(review.id))
    return review


@router.get("/", response_model=list[schemas.ReviewListItem])
def list_reviews(
    skip: int = 0,
    limit: int = 50,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Review)
    if not current_user.is_admin:
        query = query.filter(models.Review.user_id == current_user.id)
    return (
        query.order_by(models.Review.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{review_id}", response_model=schemas.ReviewOut)
def get_review(
    review_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if not current_user.is_admin and review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return review


@router.delete("/{review_id}", status_code=204)
def delete_review(
    review_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    review = db.query(models.Review).filter(models.Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    if not current_user.is_admin and review.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(review)
    db.commit()
