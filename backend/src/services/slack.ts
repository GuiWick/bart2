import { WebClient } from "@slack/web-api";

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
