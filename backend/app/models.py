from sqlalchemy import (
    Column, Integer, String, Text, Float, Boolean,
    DateTime, JSON, ForeignKey
)
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.database import Base


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, default="")
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

    reviews = relationship("Review", back_populates="user")


class BrandGuidelines(Base):
    __tablename__ = "brand_guidelines"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, default="")
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)


class Review(Base):
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Content metadata
    content_type = Column(String, nullable=False)  # social_media, blog, email, ad_copy
    original_content = Column(Text, nullable=False)
    source = Column(String, default="manual")  # manual, slack, notion
    source_reference = Column(String, nullable=True)  # e.g. Slack message ID

    # Analysis results
    brand_score = Column(Float, nullable=True)
    brand_feedback = Column(Text, nullable=True)
    compliance_flags = Column(JSON, default=list)  # [{text, issue, severity, suggestion}]
    sentiment = Column(String, nullable=True)  # positive, neutral, negative
    sentiment_score = Column(Float, nullable=True)
    sentiment_feedback = Column(Text, nullable=True)
    suggested_rewrite = Column(Text, nullable=True)
    overall_rating = Column(String, nullable=True)  # A, B, C, D, F
    summary = Column(Text, nullable=True)

    # Status
    status = Column(String, default="pending")  # pending, completed, error
    error_message = Column(Text, nullable=True)

    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="reviews")


class IntegrationConfig(Base):
    __tablename__ = "integration_configs"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String, nullable=False)  # slack, notion
    config = Column(JSON, default=dict)
    is_active = Column(Boolean, default=True)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
