import json
import anthropic
from app.config import settings

ANALYSIS_SYSTEM_PROMPT = """You are a senior marketing communications expert and brand compliance specialist.

Your job is to review marketing content and return a thorough analysis as valid JSON.

{guidelines_section}

Evaluate content on three dimensions:
1. **Brand Voice** — Does the content match the brand's tone, language, and identity?
2. **Compliance** — Are there legal risks, unsubstantiated claims, missing disclosures, or prohibited language?
3. **Sentiment & Effectiveness** — Is the messaging compelling, clear, and emotionally resonant?

Return ONLY valid JSON matching this exact schema (no markdown, no explanation):
{{
  "brand_score": <integer 0-100>,
  "brand_feedback": "<2-3 sentences on brand alignment>",
  "compliance_flags": [
    {{
      "text": "<exact quoted phrase from content>",
      "issue": "<clear description of the problem>",
      "severity": "high|medium|low",
      "suggestion": "<specific corrected phrasing>"
    }}
  ],
  "sentiment": "positive|neutral|negative",
  "sentiment_score": <float 0.0-1.0>,
  "sentiment_feedback": "<1-2 sentences on tone and emotional impact>",
  "suggested_rewrite": "<full improved version of the content>",
  "overall_rating": "A|B|C|D|F",
  "summary": "<2-3 sentence overall assessment>"
}}

If there are no compliance flags, return an empty array. Be specific and actionable."""


def build_system_prompt(brand_guidelines: str) -> str:
    if brand_guidelines and brand_guidelines.strip():
        guidelines_section = (
            "## Brand Guidelines\n\n"
            + brand_guidelines.strip()
            + "\n\nUse these guidelines as the primary reference for brand voice scoring."
        )
    else:
        guidelines_section = (
            "No specific brand guidelines have been configured. "
            "Apply general best practices for professional marketing communications."
        )
    return ANALYSIS_SYSTEM_PROMPT.format(guidelines_section=guidelines_section)


async def analyze_content(
    content: str,
    content_type: str,
    brand_guidelines: str,
) -> dict:
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    content_type_labels = {
        "social_media": "Social Media Post",
        "blog": "Blog / Website Copy",
        "email": "Email Campaign",
        "ad_copy": "Ad Copy",
    }
    label = content_type_labels.get(content_type, content_type.replace("_", " ").title())

    system_prompt = build_system_prompt(brand_guidelines)

    user_message = f"Content Type: {label}\n\nContent to Review:\n\n{content}"

    # Use streaming + get_final_message for large outputs with timeout protection
    with client.messages.stream(
        model="claude-opus-4-6",
        max_tokens=4096,
        thinking={"type": "adaptive"},
        system=[
            {
                "type": "text",
                "text": system_prompt,
                "cache_control": {"type": "ephemeral"},  # Cache guidelines across calls
            }
        ],
        messages=[{"role": "user", "content": user_message}],
    ) as stream:
        final_message = stream.get_final_message()

    # Extract text from response (skip thinking blocks)
    response_text = ""
    for block in final_message.content:
        if block.type == "text":
            response_text = block.text
            break

    # Parse JSON from response
    # Strip markdown code fences if present
    text = response_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])

    result = json.loads(text)

    # Ensure required fields with sensible defaults
    result.setdefault("brand_score", 50)
    result.setdefault("brand_feedback", "")
    result.setdefault("compliance_flags", [])
    result.setdefault("sentiment", "neutral")
    result.setdefault("sentiment_score", 0.5)
    result.setdefault("sentiment_feedback", "")
    result.setdefault("suggested_rewrite", "")
    result.setdefault("overall_rating", "C")
    result.setdefault("summary", "")

    return result
