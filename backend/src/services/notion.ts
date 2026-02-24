import { Client } from "@notionhq/client";

function extractRichText(arr: { plain_text?: string }[]): string {
  return arr.map((t) => t.plain_text || "").join("");
}

async function getPageContent(client: Client, pageId: string): Promise<string> {
  try {
    const blocks = await client.blocks.children.list({ block_id: pageId });
    const lines: string[] = [];
    for (const block of blocks.results as { type?: string; [key: string]: unknown }[]) {
      const type = block.type as string;
      const data = block[type] as { rich_text?: { plain_text?: string }[] } | undefined;
      if (data?.rich_text?.length) {
        lines.push(extractRichText(data.rich_text));
      }
    }
    return lines.join("\n");
  } catch {
    return "";
  }
}

export async function listDatabases(apiKey: string) {
  const client = new Client({ auth: apiKey });
  const result = await client.search({
    filter: { value: "database", property: "object" },
    page_size: 50,
  });
  return result.results.map((db) => {
    const d = db as { id: string; title?: { plain_text?: string }[] };
    return {
      id: d.id,
      title: d.title ? extractRichText(d.title) : "Untitled",
    };
  });
}

export async function getDatabasePages(apiKey: string, databaseId: string, limit = 20) {
  const client = new Client({ auth: apiKey });
  const result = await client.databases.query({ database_id: databaseId, page_size: limit });
  const pages = [];
  for (const page of result.results) {
    const p = page as {
      id: string;
      url: string;
      properties: Record<string, { type: string; title?: { plain_text?: string }[] }>;
    };
    let title = "Untitled";
    for (const prop of Object.values(p.properties)) {
      if (prop.type === "title" && prop.title?.length) {
        title = extractRichText(prop.title);
        break;
      }
    }
    const content = await getPageContent(client, p.id);
    pages.push({ id: p.id, title, url: p.url, content });
  }
  return pages;
}
