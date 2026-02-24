import Anthropic from "@anthropic-ai/sdk";

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

**SEC (Securities and Exchange Commission)**
- Apply the Howey test: flag any language that could characterise a token or digital asset as an investment contract (expectation of profit from efforts of others).
- Flag: promises or implications of returns, profit, appreciation, or passive income; language describing tokens as "investments"; absence of disclaimers clarifying the token is not a security.
- Flag: offers or sales of tokens that may constitute an unregistered securities offering under the Securities Act of 1933.
- Flag: statements that could be deemed a general solicitation for an unregistered offering.
- Require: "This is not an offer or solicitation to buy or sell securities" where appropriate; "Not financial advice" disclaimers.

**CFTC (Commodity Futures Trading Commission)**
- Flag references to crypto derivatives, leveraged trading, or futures without appropriate regulatory context.
- Flag unsubstantiated claims about commodity price performance.

**FTC (Federal Trade Commission)**
- Flag unsubstantiated performance claims, superlatives ("best", "guaranteed"), false scarcity, and undisclosed material connections or paid endorsements.
- Require clear and conspicuous disclosures for any sponsored or incentivised content.

**FinCEN**
- Flag descriptions of services that may trigger AML/KYC obligations without acknowledging compliance requirements.

Always flag: missing "not financial advice" disclaimers, unsubstantiated yield/APY/return claims, absence of risk disclosures, potential unregistered securities language, missing "past performance is not indicative of future results" where performance data is cited.`,

  UK: `## Jurisdiction: United Kingdom
Apply these UK regulatory frameworks in your compliance review:

**FCA Financial Promotions Regime (s.21 FSMA 2000)**
- Any communication that is a financial promotion must be communicated or approved by an FCA-authorised person. Flag content that promotes a financial product or service without evidence of FCA authorisation or approval.
- Financial promotions must be fair, clear, and not misleading. Flag any imbalanced presentation of benefits without risks, omission of material information, or use of jargon that obscures meaning.
- Flag: testimonials or past performance presented without "past performance is not a reliable indicator of future results" caveat; projections without basis; prominence of benefits over risks.

**FCA Crypto Asset Financial Promotions Rules (PS23/6, effective October 2023)**
- All qualifying crypto asset promotions targeting UK consumers must be approved by an FCA-authorised person or issued by a registered crypto firm.
- Mandatory prescribed risk warning must appear prominently: "Don't invest unless you're prepared to lose all the money you invest. This is a high-risk investment and you are unlikely to be protected if something goes wrong. Take 2 minutes to learn more."
- Cooling-off period: first-time investors must be given a 24-hour cooling-off period. Flag content that creates undue urgency or pressure to act immediately.
- Flag: absence of mandatory risk warning; FOMO language ("don't miss out", "last chance", limited time offers); celebrity endorsements without proper disclosures; incentivised referrals without disclosure.

**FCA Consumer Duty (PS22/9)**
- Content must deliver good outcomes for retail customers. Flag anything that could exploit behavioural biases, create a false sense of urgency, or cause foreseeable harm to retail consumers.

Always flag: missing mandatory FCA risk warnings, unapproved financial promotions, misleading performance claims, missing "capital at risk" statements, pressure-selling tactics, cooling-off period omissions.`,

  CH: `## Jurisdiction: Switzerland
Apply these Swiss regulatory frameworks in your compliance review:
- **FINMA Guidelines**: Review against FINMA's ICO/crypto guidance. Token offerings may require a prospectus or regulatory approval.
- **FinSA (Financial Services Act)**: Financial service promotions must meet suitability requirements and include appropriate risk disclosures.
- **DLT Act**: Consider Swiss DLT/blockchain-specific regulations for tokenised assets.
- **UWG (Unfair Competition Act)**: No misleading, aggressive, or deceptive advertising claims.
Flag: unregistered token/security offerings, missing FinSA risk disclosures, misleading investment return claims, missing FINMA warnings for regulated products.`,

  EU: `## Jurisdiction: European Union
Apply these EU regulatory frameworks in your compliance review:

**MiCAR (Markets in Crypto-Assets Regulation — EU 2023/1114, fully applicable from December 2024)**
- Marketing communications for crypto-assets must be fair, clear, and not misleading, and must be consistent with the crypto-asset white paper where one is required.
- Required disclosures in marketing communications: (a) a statement that a white paper has been published and where to find it; (b) the statement "This crypto-asset is not covered by any investor protection scheme. There is no guarantee that the crypto-asset will retain its value."
- Flag: marketing communications that are inconsistent with the white paper; promotional language not clearly identified as a marketing communication; omission of required risk statements; statements implying guaranteed returns or price appreciation.
- Flag: promotions for asset-referenced tokens (ARTs) or e-money tokens (EMTs) that do not comply with the additional MiCAR requirements applicable to those categories.
- Issuers and offerors must ensure marketing communications are clearly identifiable as such. Flag any content that blurs the line between editorial/informational content and promotional material.

**MiFID II**
- For financial instrument promotions, content must fairly present risks and benefits; past performance disclaimers required where performance data is used.

**ESMA Guidelines on Social Media and Influencer Marketing**
- Flag undisclosed paid promotions, influencer content without adequate risk warnings, and content that may constitute investment advice.

**GDPR**
- Note any data collection, tracking, or privacy implications mentioned in the content.

Always flag: missing MiCAR-required risk disclosures, marketing communications not identified as such, misleading crypto-asset claims, absent mandatory risk warnings, content inconsistent with published white paper.`,
};

export async function analyzeContent(
  content: string,
  contentType: string,
  brandGuidelines: string,
  jurisdiction = "general"
): Promise<Record<string, unknown>> {
  const client = new Anthropic();

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
