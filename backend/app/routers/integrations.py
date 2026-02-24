import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.auth import get_current_user, require_admin
from app.services import slack_service, notion_service
from app.services import claude_service

router = APIRouter(prefix="/api/integrations", tags=["integrations"])


def _get_brand_guidelines(db: Session) -> str:
    guidelines = db.query(models.BrandGuidelines).first()
    return guidelines.content if guidelines else ""


# ── Slack ─────────────────────────────────────────────────────────────────────

@router.post("/slack/config")
def save_slack_config(
    payload: schemas.SlackConfig,
    admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    config = db.query(models.IntegrationConfig).filter(
        models.IntegrationConfig.platform == "slack"
    ).first()
    if config:
        config.config = {"bot_token": payload.bot_token, "channel_ids": payload.channel_ids}
        config.is_active = True
    else:
        config = models.IntegrationConfig(
            platform="slack",
            config={"bot_token": payload.bot_token, "channel_ids": payload.channel_ids},
        )
        db.add(config)
    db.commit()
    return {"status": "saved"}


@router.get("/slack/channels")
def list_slack_channels(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = db.query(models.IntegrationConfig).filter(
        models.IntegrationConfig.platform == "slack",
        models.IntegrationConfig.is_active == True,
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Slack not configured")
    bot_token = config.config.get("bot_token", "")
    try:
        return slack_service.list_channels(bot_token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/slack/fetch")
async def fetch_slack_messages(
    channel_id: str,
    limit: int = 20,
    background_tasks: BackgroundTasks = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = db.query(models.IntegrationConfig).filter(
        models.IntegrationConfig.platform == "slack",
        models.IntegrationConfig.is_active == True,
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Slack not configured")

    bot_token = config.config.get("bot_token", "")
    try:
        messages = slack_service.get_channel_messages(bot_token, channel_id, limit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Create pending reviews for each message and queue analysis
    review_ids = []
    for msg in messages:
        review = models.Review(
            user_id=current_user.id,
            content_type="social_media",
            original_content=msg["text"],
            source="slack",
            source_reference=f"{msg['channel_name']}/{msg['ts']}",
            status="pending",
        )
        db.add(review)
        db.commit()
        db.refresh(review)
        review_ids.append(review.id)

    async def _analyze_all():
        from app.routers.reviews import _run_analysis
        for rid in review_ids:
            await _run_analysis(rid)

    if background_tasks:
        background_tasks.add_task(asyncio.run, _analyze_all())

    return {"queued": len(review_ids), "review_ids": review_ids}


# ── Notion ────────────────────────────────────────────────────────────────────

@router.post("/notion/config")
def save_notion_config(
    payload: schemas.NotionConfig,
    admin: models.User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    config = db.query(models.IntegrationConfig).filter(
        models.IntegrationConfig.platform == "notion"
    ).first()
    if config:
        config.config = {"api_key": payload.api_key, "database_ids": payload.database_ids}
        config.is_active = True
    else:
        config = models.IntegrationConfig(
            platform="notion",
            config={"api_key": payload.api_key, "database_ids": payload.database_ids},
        )
        db.add(config)
    db.commit()
    return {"status": "saved"}


@router.get("/notion/databases")
def list_notion_databases(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = db.query(models.IntegrationConfig).filter(
        models.IntegrationConfig.platform == "notion",
        models.IntegrationConfig.is_active == True,
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Notion not configured")
    api_key = config.config.get("api_key", "")
    try:
        return notion_service.list_databases(api_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/notion/fetch")
async def fetch_notion_pages(
    database_id: str,
    content_type: str = "blog",
    limit: int = 20,
    background_tasks: BackgroundTasks = None,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    config = db.query(models.IntegrationConfig).filter(
        models.IntegrationConfig.platform == "notion",
        models.IntegrationConfig.is_active == True,
    ).first()
    if not config:
        raise HTTPException(status_code=404, detail="Notion not configured")

    api_key = config.config.get("api_key", "")
    try:
        pages = notion_service.get_database_pages(api_key, database_id, limit)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    review_ids = []
    for page in pages:
        if not page["content"].strip():
            continue
        review = models.Review(
            user_id=current_user.id,
            content_type=content_type,
            original_content=page["content"],
            source="notion",
            source_reference=page["id"],
            status="pending",
        )
        db.add(review)
        db.commit()
        db.refresh(review)
        review_ids.append(review.id)

    async def _analyze_all():
        from app.routers.reviews import _run_analysis
        for rid in review_ids:
            await _run_analysis(rid)

    if background_tasks:
        background_tasks.add_task(asyncio.run, _analyze_all())

    return {"queued": len(review_ids), "review_ids": review_ids}


@router.get("/status")
def get_integration_status(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    configs = db.query(models.IntegrationConfig).filter(
        models.IntegrationConfig.is_active == True
    ).all()
    status = {"slack": False, "notion": False}
    for c in configs:
        if c.platform in status:
            status[c.platform] = True
    return status
