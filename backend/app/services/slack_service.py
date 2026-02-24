from typing import List
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError


def get_channel_messages(bot_token: str, channel_id: str, limit: int = 20) -> List[dict]:
    client = WebClient(token=bot_token)
    try:
        # Get channel info
        channel_info = client.conversations_info(channel=channel_id)
        channel_name = channel_info["channel"]["name"]

        # Get messages
        result = client.conversations_history(channel=channel_id, limit=limit)
        messages = []
        for msg in result["messages"]:
            # Skip bot messages and system messages
            if msg.get("subtype") or not msg.get("text"):
                continue
            messages.append({
                "ts": msg["ts"],
                "text": msg["text"],
                "user": msg.get("user", "unknown"),
                "channel": channel_id,
                "channel_name": channel_name,
            })
        return messages
    except SlackApiError as e:
        raise ValueError(f"Slack API error: {e.response['error']}")


def list_channels(bot_token: str) -> List[dict]:
    client = WebClient(token=bot_token)
    try:
        result = client.conversations_list(types="public_channel,private_channel", limit=200)
        return [
            {"id": ch["id"], "name": ch["name"], "is_private": ch.get("is_private", False)}
            for ch in result["channels"]
        ]
    except SlackApiError as e:
        raise ValueError(f"Slack API error: {e.response['error']}")
