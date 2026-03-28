import type { EventProvider } from "@/sources/types";
import type { EventCard, PriceType } from "@/types";
import { inferFormat, extractTopicsFromText } from "@/helpers";

// Tickadoo MCP server — stateless, no auth required.
// Covers theatre, shows, tours, attractions, and experiences across 680+ cities.
// Docs: https://github.com/tickadoo/tickadoo-mcp
const MCP_ENDPOINT = "https://mcp.tickadoo.com/mcp";

async function callTool(name: string, args: Record<string, unknown>): Promise<any> {
  const res = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // MCP Streamable HTTP requires both types in Accept even when JSON responses are enabled
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.includes("text/event-stream")) {
    // Parse SSE: find the first data line that contains a result
    const text = await res.text();
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      const json = JSON.parse(payload);
      if (json.result) return json.result;
      if (json.error) throw new Error(json.error.message ?? "MCP error");
    }
    throw new Error("No result in SSE response");
  }

  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "MCP error");
  return json.result;
}

const tickadooProvider: EventProvider = {
  name: "tickadoo",
  // No API key required — always enabled.
  enabled: true,
  async search(query, location) {
    // city is required by the Tickadoo tool; skip if no location is given.
    if (!location) return [];

    try {
      const result = await callTool("search_experiences", {
        city: location,
        query,
        format: "json",
        max_results: 20,
        language: "en",
      });

      // Prefer structuredContent.experiences (camelCase fields).
      // Fall back to parsing the text JSON (snake_case fields).
      let items: any[] = result?.structuredContent?.experiences ?? [];
      if (items.length === 0) {
        try {
          const parsed = JSON.parse(result?.content?.[0]?.text ?? "{}");
          items = parsed.results ?? [];
        } catch {
          // ignore parse errors
        }
      }

      return items.map((e: any) => {
        // Support both camelCase (structuredContent) and snake_case (text JSON)
        const slug: string = e.slug ?? "";
        const title: string = e.title ?? "Untitled";
        const bookingUrl: string = e.bookingUrl ?? e.booking_url ?? "";
        const priceAmount: number | null = e.priceAmount ?? e.price_amount ?? null;
        const currency: string | undefined = e.priceCurrency ?? e.price_currency ?? undefined;
        const tags: string[] = e.tags ?? [];

        const price: PriceType = priceAmount == null || priceAmount === 0 ? "free" : "paid";

        return {
          id: `tickadoo-${slug}`,
          title,
          // Date is not included in search results — only available via get_experience_details.
          date: "Check site",
          location,
          format: inferFormat([...tags, title].join(" ")),
          price,
          priceAmount: priceAmount ?? undefined,
          currency,
          topics: extractTopicsFromText([...tags, title].join(" ")),
          attendeeProfile: "Tourists and experience seekers",
          source: "tickadoo" as const,
          url: bookingUrl || undefined,
        } satisfies Partial<EventCard>;
      });
    } catch (err) {
      console.error("[tickadoo] Failed:", err instanceof Error ? err.message : err);
      return [];
    }
  },
};

export default tickadooProvider;
