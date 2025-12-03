export type VenueSlug = "oddgrid" | "polymarket" | "kalshi" | "manifold";

export type NormalizedOutcome = {
  id: string;              // "YES", "NO", etc.
  name: string;            // display name
  probability: number | null; // 0–1, null if unknown for now
  bestBid?: number | null;
  bestAsk?: number | null;
};

export type NormalizedMarketStatus = "OPEN" | "RESOLVED" | "SUSPENDED";

export type NormalizedMarketType = "YES_NO" | "MULTI_OUTCOME";

export type NormalizedMarket = {
  id: string;                 // global OddGrid id, e.g. "oddgrid:<marketId>"
  venue: VenueSlug;
  externalId: string;         // underlying market id (DB id for oddgrid, api id for external venues)
  title: string;
  description?: string | null;
  type: NormalizedMarketType;
  status: NormalizedMarketStatus;
  outcomes: NormalizedOutcome[];
  resolutionRule?: string | null;
  volume24h?: number | null;
  openInterest?: number | null;
  lastUpdated: string;        // ISO timestamp
};
