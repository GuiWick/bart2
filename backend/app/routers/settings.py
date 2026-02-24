from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_admin

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/guidelines", response_model=schemas.BrandGuidelinesOut)
def get_guidelines(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    guidelines = db.query(models.BrandGuidelines).first()
    if not guidelines:
        guidelines = models.BrandGuidelines(content="", updated_at=datetime.now(timezone.utc))
        db.add(guidelines)
        db.commit()
        db.refresh(guidelines)
    return guidelines


@router.put("/guidelines", response_model=schemas.BrandGuidelinesOut)
def update_guidelines(
    payload: schemas.BrandGuidelinesUpdate,
    admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    guidelines = db.query(models.BrandGuidelines).first()
    if not guidelines:
        guidelines = models.BrandGuidelines(
            content=payload.content,
            updated_by=admin.id,
        )
        db.add(guidelines)
    else:
        guidelines.content = payload.content
        guidelines.updated_by = admin.id
        guidelines.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(guidelines)
    return guidelines
