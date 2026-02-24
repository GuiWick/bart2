import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config";

const SYSTEM_TEMPLATE = `You are a senior marketing communications expert and brand compliance specialist.

{GUIDELINES}

Evaluate content on three dimensions:
1. **Brand Voice** — Does it match tone, language, and identity?
2. **Compliance** — Legal risks, unsubstantiated claims, missing disclosures?
3. **Sentiment & Effectiveness** — Compelling, clear, emotionally resonant?

Return ONLY valid JSON (no markdown fences) matching this exact schema:
{
  "brand_score": <integer 0-100>,
  "brand_feedback": "<2-3 sentences on brand alignment>",
  "compliance_flags": [
    {
      "text": "<exact quoted phrase>",
      "issue": "<description of problem>",
      "severity": "high|medium|low",
      "suggestion": "<specific fix>"
    }
  ],
  "risk_score": <integer 0-100, overall legal/compliance risk: 0=no risk, 100=extreme risk. Consider number and severity of flags, jurisdiction, content type, and regulatory exposure>,
  "sentiment": "positive|neutral|negative",
  "sentiment_score": <float 0.0-1.0>,
  "sentiment_feedback": "<1-2 sentences on tone>",
  "suggested_rewrite": "<full improved version>",
  "overall_rating": "A|B|C|D|F",
  "summary": "<2-3 sentence overall assessment>"
}`;

const CONTENT_LABELS: Record<string, string> = {
  social_media: "Social Media Post",
  blog: "Blog / Website Copy",
  email: "Email Campaign",
  ad_copy: "Ad Copy",
  crypto_marketing: "Crypto / Web3 Marketing",
  financial_product: "Financial Product Marketing",
};

const JURISDICTION_GUIDANCE: Record<string, string> = {
  US: `## Jurisdiction: United States
Apply these US regulatory frameworks in your compliance review:
- **SEC**: Assess whether content implies an unregistered securities offering (Howey test for crypto tokens). Flag any guaranteed return claims or unregistered investment product promotions.
- **CFTC**: Check for compliant treatment of crypto derivatives and spot commodity references.
- **FTC**: Evaluate against deceptive advertising rules — no unsubstantiated performance claims, false scarcity, or undisclosed paid endorsements.
- **FinCEN**: Note any AML/KYC obligation implications for services described.
Flag: missing "not financial advice" disclaimers, unsubstantiated yield/APY claims, absence of risk disclosures, potential unregistered securities language.`,

  UK: `## Jurisdiction: United Kingdom
Apply these UK regulatory frameworks in your compliance review:
- **FCA Financial Promotions Regime**: All crypto asset promotions must be approved by an FCA-authorised person; must be fair, clear and not misleading.
- **FCA Crypto Promotions Rules (Oct 2023)**: Mandatory risk warning "Don't invest unless you're prepared to lose all the money you invest. This is a high-risk investment and you are unlikely to be protected if something goes wrong." must accompany crypto promotions.
- **Consumer Duty**: Assess whether the content delivers good outcomes for retail customers and avoids foreseeable harm.
Flag: missing mandatory FCA risk warnings, unapproved financial promotions, misleading performance claims, missing "capital at risk" statements, cooling-off period omissions.`,

  CH: `## Jurisdiction: Switzerland
Apply these Swiss regulatory frameworks in your compliance review:
- **FINMA Guidelines**: Review against FINMA's ICO/crypto guidance. Token offerings may require a prospectus or regulatory approval.
- **FinSA (Financial Services Act)**: Financial service promotions must meet suitability requirements and include appropriate risk disclosures.
- **DLT Act**: Consider Swiss DLT/blockchain-specific regulations for tokenised assets.
- **UWG (Unfair Competition Act)**: No misleading, aggressive, or deceptive advertising claims.
Flag: unregistered token/security offerings, missing FinSA risk disclosures, misleading investment return claims, missing FINMA warnings for regulated products.`,

  EU: `## Jurisdiction: European Union
Apply these EU regulatory frameworks in your compliance review:
- **MiCA (Markets in Crypto-Assets Regulation)**: Marketing communications for crypto-assets must be fair, clear, and not misleading. White paper disclosure requirements apply to token issuers. Flag any statements that could constitute non-compliant marketing under MiCA.
- **MiFID II**: For financial instrument promotions, assess against MiFID II marketing communication standards including fair presentation of risks.
- **ESMA Guidelines**: Check against ESMA guidelines on social media and influencer marketing for financial products.
- **GDPR**: Note any data collection or privacy implications mentioned in the content.
Flag: missing MiCA-required risk disclosures, misleading crypto-asset claims, non-compliant financial promotions, absent mandatory risk warnings per MiFID II.`,
};

export async function analyzeContent(
  content: string,
  contentType: string,
  brandGuidelines: string,
  jurisdiction = "general"
): Promise<Record<string, unknown>> {
  const client = new Anthropic({ apiKey: config.anthropicApiKey || undefined });

  const guidelinesSection = brandGuidelines?.trim()
    ? `## Brand Guidelines\n\n${brandGuidelines.trim()}\n\nUse these as the primary reference for brand voice scoring.`
    : "No specific brand guidelines configured. Apply general best practices for professional marketing communications.";

  const jurisdictionSection = JURISDICTION_GUIDANCE[jurisdiction] || "";
  const fullGuidelines = [guidelinesSection, jurisdictionSection].filter(Boolean).join("\n\n");
  const systemPrompt = SYSTEM_TEMPLATE.replace("{GUIDELINES}", fullGuidelines);
  const label = CONTENT_LABELS[contentType] || contentType;

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    // @ts-ignore — adaptive thinking is supported but not yet in SDK type defs
    thinking: { type: "adaptive" },
    system: [
      {
        type: "text",
        text: systemPrompt,
        // @ts-ignore — cache_control is valid but may not be in older type defs
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Content Type: ${label}\n\nContent to Review:\n\n${content}`,
      },
    ],
  });

  const final = await stream.finalMessage();

  let responseText = "";
  for (const block of final.content) {
    if (block.type === "text") {
      responseText = block.text;
      break;
    }
  }

  // Strip markdown fences if present
  let text = responseText.trim();
  if (text.startsWith("```")) {
    const lines = text.split("\n");
    text = lines.slice(1, lines[lines.length - 1].trim() === "```" ? -1 : undefined).join("\n");
  }

  const result = JSON.parse(text) as Record<string, unknown>;
  result.brand_score ??= 50;
  result.brand_feedback ??= "";
  result.compliance_flags ??= [];
  result.risk_score ??= 0;
  result.sentiment ??= "neutral";
  result.sentiment_score ??= 0.5;
  result.sentiment_feedback ??= "";
  result.suggested_rewrite ??= "";
  result.overall_rating ??= "C";
  result.summary ??= "";
  return result;
}
