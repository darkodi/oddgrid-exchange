import type { VenueAdapter } from "./venueAdapter";
import type {
  NormalizedMarket,
  NormalizedOutcome,
} from "./types";

/**
 * Very thin read-only adapter over Polymarket's Gamma /markets endpoint.
 *
 * Docs: https://gamma-api.polymarket.com (GET /markets)
 *
 * Phase 1 notes:
 * - We only need enough fields to show a list of markets.
 * - We assume binary (YES/NO) for now.
 * - Probabilities are left null; pricing will come later.
 */
export class PolymarketAdapter implements VenueAdapter {
  public venue = "polymarket" as const;

  private baseUrl =
    process.env.POLYMARKET_GAMMA_API ?? "https://gamma-api.polymarket.com";

  async listMarkets(): Promise<NormalizedMarket[]> {
    const url = `${this.baseUrl}/markets?limit=50`; // you can add &closed=false later if desired

    let raw: any;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error("[PolymarketAdapter] non-200 response", res.status);
        return [];
      }
      raw = await res.json();
    } catch (e) {
      console.error("[PolymarketAdapter] fetch error", e);
      return [];
    }

    if (!Array.isArray(raw)) {
      console.error("[PolymarketAdapter] unexpected response shape");
      return [];
    }

    const now = new Date().toISOString();

    const markets: NormalizedMarket[] = raw.map((m: any): NormalizedMarket => {
      const id = String(m.id ?? m.conditionId ?? m.slug ?? "");
      const title =
        m.question ??
        m.slug ??
        "Untitled Polymarket market";

      const outcomes: NormalizedOutcome[] = [
        {
          id: "YES",
          name: "YES",
          probability: null,
        },
        {
          id: "NO",
          name: "NO",
          probability: null,
        },
      ];

      // Very rough status mapping; you can refine once you explore the response shape
      const status: "OPEN" | "RESOLVED" | "SUSPENDED" =
        m.closed === true ? "RESOLVED" : "OPEN";

      return {
        id: `polymarket:${id}`,
        venue: "polymarket",
        externalId: id,
        title,
        description: m.description ?? null,
        type: "YES_NO",
        status,
        outcomes,
        resolutionRule: m.resolutionSource ?? null,
        volume24h: m.liquidity ? Number(m.liquidity) : null,
        openInterest: null,
        lastUpdated: m.updatedAt ?? now,
      };
    });

    return markets;
  }
}
