from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str = ""


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    password: Optional[str] = None


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    is_admin: bool
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserOut


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ── Brand Guidelines ─────────────────────────────────────────────────────────

class BrandGuidelinesUpdate(BaseModel):
    content: str


class BrandGuidelinesOut(BaseModel):
    id: int
    content: str
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Reviews ───────────────────────────────────────────────────────────────────

class ComplianceFlag(BaseModel):
    text: str
    issue: str
    severity: str  # high, medium, low
    suggestion: str


class ReviewCreate(BaseModel):
    content_type: str  # social_media, blog, email, ad_copy
    original_content: str
    source: str = "manual"
    source_reference: Optional[str] = None


class ReviewOut(BaseModel):
    id: int
    user_id: int
    content_type: str
    original_content: str
    source: str
    source_reference: Optional[str]
    brand_score: Optional[float]
    brand_feedback: Optional[str]
    compliance_flags: Optional[List[Any]]
    sentiment: Optional[str]
    sentiment_score: Optional[float]
    sentiment_feedback: Optional[str]
    suggested_rewrite: Optional[str]
    overall_rating: Optional[str]
    summary: Optional[str]
    status: str
    error_message: Optional[str]
    created_at: datetime
    user: Optional[UserOut] = None

    class Config:
        from_attributes = True


class ReviewListItem(BaseModel):
    id: int
    content_type: str
    original_content: str
    source: str
    brand_score: Optional[float]
    overall_rating: Optional[str]
    sentiment: Optional[str]
    status: str
    created_at: datetime
    user: Optional[UserOut] = None

    class Config:
        from_attributes = True


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_reviews: int
    avg_brand_score: Optional[float]
    reviews_this_week: int
    top_issues: List[str]
    rating_distribution: dict
    sentiment_distribution: dict
    content_type_distribution: dict
    recent_reviews: List[ReviewListItem]


# ── Integrations ──────────────────────────────────────────────────────────────

class SlackConfig(BaseModel):
    bot_token: str
    channel_ids: List[str] = []


class NotionConfig(BaseModel):
    api_key: str
    database_ids: List[str] = []


class IntegrationConfigOut(BaseModel):
    id: int
    platform: str
    config: dict
    is_active: bool
    updated_at: datetime

    class Config:
        from_attributes = True


class SlackMessage(BaseModel):
    ts: str
    text: str
    user: str
    channel: str
    channel_name: str


class NotionPage(BaseModel):
    id: str
    title: str
    url: str
    content: str


class BulkReviewRequest(BaseModel):
    items: List[dict]  # [{content, source_reference, content_type}]
    content_type: str = "social_media"
