from typing import List
from notion_client import Client


def _extract_rich_text(rich_text_array: list) -> str:
    return "".join(item.get("plain_text", "") for item in rich_text_array)


def _extract_page_content(client: Client, page_id: str) -> str:
    try:
        blocks = client.blocks.children.list(block_id=page_id)
        lines = []
        for block in blocks["results"]:
            block_type = block["type"]
            block_data = block.get(block_type, {})
            rich_text = block_data.get("rich_text", [])
            if rich_text:
                lines.append(_extract_rich_text(rich_text))
        return "\n".join(lines)
    except Exception:
        return ""


def get_database_pages(api_key: str, database_id: str, limit: int = 20) -> List[dict]:
    client = Client(auth=api_key)
    try:
        result = client.databases.query(database_id=database_id, page_size=limit)
        pages = []
        for page in result["results"]:
            # Extract title from properties
            title = "Untitled"
            for prop_name, prop_value in page.get("properties", {}).items():
                if prop_value["type"] == "title":
                    rich_text = prop_value.get("title", [])
                    if rich_text:
                        title = _extract_rich_text(rich_text)
                        break

            content = _extract_page_content(client, page["id"])
            pages.append({
                "id": page["id"],
                "title": title,
                "url": page.get("url", ""),
                "content": content,
            })
        return pages
    except Exception as e:
        raise ValueError(f"Notion API error: {str(e)}")


def list_databases(api_key: str) -> List[dict]:
    client = Client(auth=api_key)
    try:
        result = client.search(filter={"value": "database", "property": "object"}, page_size=50)
        databases = []
        for db in result["results"]:
            title_prop = db.get("title", [])
            title = _extract_rich_text(title_prop) if title_prop else "Untitled"
            databases.append({"id": db["id"], "title": title})
        return databases
    except Exception as e:
        raise ValueError(f"Notion API error: {str(e)}")
