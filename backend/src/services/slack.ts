import { WebClient } from "@slack/web-api";

interface ReviewSummary {
  id: number;
  content_type: string;
  overall_rating?: unknown;
  brand_score?: unknown;
  risk_score?: unknown;
  sentiment?: unknown;
  summary?: unknown;
  compliance_flags?: { text: string; issue: string; severity: string }[];
}

export function formatReportForSlack(review: ReviewSummary, webAppUrl = ""): object[] {
  const flags = (review.compliance_flags || []) as { text: string; issue: string; severity: string }[];
  const topFlags = flags.slice(0, 3);
  const riskScore = (review.risk_score as number) ?? 0;
  const brandScore = review.brand_score as number | null;

  const blocks: object[] = [
    {
      type: "header",
      text: { type: "plain_text", text: `Content Review — ${review.overall_rating ?? "?"} Rating`, emoji: false },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Brand Score:* ${brandScore != null ? brandScore + "/100" : "–"}` },
        { type: "mrkdwn", text: `*Risk Score:* ${riskScore}%${riskScore > 70 ? " :warning:" : ""}` },
        { type: "mrkdwn", text: `*Sentiment:* ${review.sentiment ?? "–"}` },
        { type: "mrkdwn", text: `*Content Type:* ${review.content_type}` },
      ],
    },
  ];

  if (review.summary) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Summary:*\n${review.summary}` } });
  }

  if (topFlags.length > 0) {
    const flagText = topFlags.map((f) => `• [${f.severity.toUpperCase()}] ${f.issue}`).join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Compliance Flags (${flags.length} total):*\n${flagText}` },
    });
  }

  if (riskScore > 70) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `:rotating_light: *Legal Review Required* — Risk score ${riskScore}%. Forward to legal before publishing.` },
    });
  }

  if (webAppUrl && review.id) {
    blocks.push({
      type: "actions",
      elements: [{ type: "button", text: { type: "plain_text", text: "View Full Report", emoji: false }, url: `${webAppUrl}/review/${review.id}` }],
    });
  }

  return blocks;
}

export async function postToResponseUrl(responseUrl: string, blocks: object[]): Promise<void> {
  await fetch(responseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks, response_type: "in_channel" }),
  });
}

export async function postReviewToChannel(botToken: string, channelId: string, review: ReviewSummary, webAppUrl = ""): Promise<void> {
  const client = new WebClient(botToken);
  const blocks = formatReportForSlack(review, webAppUrl);
  await client.chat.postMessage({
    channel: channelId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    blocks: blocks as any,
    text: `Content Review Complete — Rating: ${review.overall_rating ?? "?"}`,
  });
}

export async function listChannels(botToken: string) {
  const client = new WebClient(botToken);
  const channels: { id: string | undefined; name: string | undefined; is_private: boolean | undefined }[] = [];
  let cursor: string | undefined;
  do {
    const result = await client.conversations.list({
      types: "public_channel,private_channel",
      limit: 200,
      cursor,
    });
    for (const ch of result.channels || []) {
      channels.push({ id: ch.id, name: ch.name, is_private: ch.is_private });
    }
    cursor = result.response_metadata?.next_cursor || undefined;
  } while (cursor);
  return channels;
}

export async function getChannelMessages(botToken: string, channelId: string, limit = 20) {
  const client = new WebClient(botToken);
  const info = await client.conversations.info({ channel: channelId });
  const channelName = (info.channel as { name?: string })?.name || channelId;

  const result = await client.conversations.history({ channel: channelId, limit });
  return (result.messages || [])
    .filter((m) => !m.subtype && m.text)
    .map((m) => ({
      ts: m.ts,
      text: m.text!,
      user: m.user || "unknown",
      channel: channelId,
      channel_name: channelName,
    }));
}
