import type { NormalizedMarket, VenueSlug } from "./types";

export interface VenueAdapter {
  venue: VenueSlug;
  listMarkets(): Promise<NormalizedMarket[]>;
}
