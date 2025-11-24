import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Upsert venues
  const polymarket = await prisma.venue.upsert({
    where: { slug: "polymarket" },
    update: {},
    create: { name: "Polymarket", slug: "polymarket" },
  });

  const kalshi = await prisma.venue.upsert({
    where: { slug: "kalshi" },
    update: {},
    create: { name: "Kalshi", slug: "kalshi" },
  });

  const oddgrid = await prisma.venue.upsert({
    where: { slug: "oddgrid" },
    update: {},
    create: { name: "OddGrid Native", slug: "oddgrid" },
  });

  // sample YES/NO markets (Phase 1 placeholders)
  await prisma.market.createMany({
    data: [
      {
        venueId: polymarket.id,
        externalId: "poly-fed-rate-2025",
        title: "Will the Fed raise interest rates in 2025?",
        description: "Yes/No market mirrored from Polymarket (simulation only).",
        resolutionRule: "Resolves using Fed policy decision by Dec 31 2025.",
        status: "OPEN",
        type: "YES_NO",
      },
      {
        venueId: kalshi.id,
        externalId: "kalshi-us-unemployment-gt-5",
        title: "Will US unemployment be above 5% in 2025?",
        description:
          "Simulated mirror of a macroeconomic Kalshi market (no real trading).",
        resolutionRule: "Resolves using BLS unemployment data for 2025.",
        status: "OPEN",
        type: "YES_NO",
      },
      {
        venueId: oddgrid.id,
        externalId: "oddgrid-demo-nba-final",
        title: "Will Team A win the NBA Finals?",
        description: "Example in-house OddGrid market (Phase 1 demo).",
        resolutionRule: "Resolves using official NBA results.",
        status: "OPEN",
        type: "YES_NO",
      },
    ],
    skipDuplicates: true,
  });

  console.log("Seeded venues and markets");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
