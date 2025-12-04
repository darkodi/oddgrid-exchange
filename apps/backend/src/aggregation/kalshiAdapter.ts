import type { VenueAdapter } from "./venueAdapter";
import type {
  NormalizedMarket,
  NormalizedOutcome,
} from "./types";

/**
 * Read-only adapter for Kalshi markets using the public get-markets endpoint.
 *
 * Docs example:
 *   curl --request GET \
 *     --url 'https://api.elections.kalshi.com/trade-api/v2/markets?limit=100'
 *
 * Notes:
 * - We hit the elections API host and v2 trade-api path.
 * - No auth is used for now; if they start requiring it, this will just return [].
 */
export class KalshiAdapter implements VenueAdapter {
  public venue = "kalshi" as const;

  // Base is the part BEFORE /markets
  // Default: public elections API host from docs
  private baseUrl =
    process.env.KALSHI_API_URL ||
    "https://api.elections.kalshi.com/trade-api/v2";

  async listMarkets(): Promise<NormalizedMarket[]> {
    const url = `${this.baseUrl}/markets?limit=50`;

    let raw: any;
    try {
      const res = await fetch(url);

      if (!res.ok) {
        console.error("[KalshiAdapter] non-200 response", res.status);
        return [];
      }

      raw = await res.json();
    } catch (e) {
      console.error("[KalshiAdapter] fetch error", e);
      return [];
    }

    // Docs show { markets: [...] }
    const marketsArray = Array.isArray(raw)
      ? raw
      : Array.isArray(raw.markets)
      ? raw.markets
      : [];

    const now = new Date().toISOString();

    const markets: NormalizedMarket[] = marketsArray.map(
      (m: any): NormalizedMarket => {
        const id = String(m.id ?? m.ticker ?? m.slug ?? "");

        const title =
          m.title ??
          m.name ??
          m.ticker ??
          "Untitled Kalshi market";

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

        const status: "OPEN" | "RESOLVED" | "SUSPENDED" =
          m.status === "resolved" || m.is_closed === true
            ? "RESOLVED"
            : "OPEN";

        return {
          id: `kalshi:${id}`,
          venue: "kalshi",
          externalId: id,
          title,
          description: m.description ?? null,
          type: "YES_NO",
          status,
          outcomes,
          resolutionRule: m.rules ?? null,
          volume24h: null,
          openInterest: null,
          lastUpdated: m.updated_at ?? now,
        };
      }
    );

    return markets;
  }
}
