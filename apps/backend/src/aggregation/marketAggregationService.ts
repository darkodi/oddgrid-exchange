import type { VenueAdapter } from "./venueAdapter";
import type { NormalizedMarket } from "./types";

export class MarketAggregationService {
  constructor(private adapters: VenueAdapter[]) {}

  async listAllMarkets(): Promise<NormalizedMarket[]> {
    const results = await Promise.all(
      this.adapters.map((adapter) => adapter.listMarkets())
    );
    return results.flat();
  }
}
