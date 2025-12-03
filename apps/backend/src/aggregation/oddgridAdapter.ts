import { PrismaClient } from "@prisma/client";
import type { VenueAdapter } from "./venueAdapter";
import type { NormalizedMarket, NormalizedOutcome } from "./types";

export class OddgridAdapter implements VenueAdapter {
  public venue = "oddgrid" as const;

  constructor(private prisma: PrismaClient) {}

  async listMarkets(): Promise<NormalizedMarket[]> {
    const markets = await this.prisma.market.findMany({
      include: { venue: true },
      take: 200,
    });

    const now = new Date().toISOString();

    return markets.map<NormalizedMarket>((m) => {
      const outcomes: NormalizedOutcome[] =
        m.type === "YES_NO"
          ? [
              {
                id: "YES",
                name: "YES",
                probability: null, // we don't model odds yet in DB
              },
              {
                id: "NO",
                name: "NO",
                probability: null,
              },
            ]
          : [];

      return {
        id: `oddgrid:${m.id}`,
        venue: "oddgrid",
        externalId: m.id,
        title: m.title,
        description: m.description,
        type: m.type === "YES_NO" ? "YES_NO" : "MULTI_OUTCOME",
        status: m.status as any,
        outcomes,
        resolutionRule: m.resolutionRule,
        volume24h: null,
        openInterest: null,
        lastUpdated: now,
      };
    });
  }
}
