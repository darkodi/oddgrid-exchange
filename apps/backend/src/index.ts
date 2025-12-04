import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

import { OddgridAdapter } from "./aggregation/oddgridAdapter";
import { MarketAggregationService } from "./aggregation/marketAggregationService";
import { PolymarketAdapter } from "./aggregation/polymarketAdapter";
import { KalshiAdapter } from "./aggregation/kalshiAdapter";


const prisma = new PrismaClient();
const aggregationService = new MarketAggregationService([
  new OddgridAdapter(prisma),
  new PolymarketAdapter(),
  new KalshiAdapter(),
]);
const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    // allow our custom auth header
    allowedHeaders: ["Content-Type", "x-user-id"],
  })
);

app.use(express.json());

// Simple middleware to attach userId from header (dev only)
app.use((req, _res, next) => {
  const userId = req.header("x-user-id") || null;
  (req as any).userId = userId;
  next();
});

// Helper to require userId
function requireUserId(req: express.Request, res: express.Response): string | null {
  const userId = (req as any).userId as string | null;
  if (!userId) {
    res.status(401).json({ error: "Missing x-user-id header" });
    return null;
  }
  return userId;
}

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

/**
 * Dev login:
 * - Upsert user by email
 * - Ensure user has a USDV balance (seed with 10_000 if new)
 */
app.post("/auth/dev-login", async (req, res) => {
  try {
    const { email } = req.body as { email?: string };

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Upsert user
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        username: email.split("@")[0],
      },
    });

    // Ensure a USDV balance exists
    const startingAmount = 10_000;

    await prisma.balance.upsert({
      where: {
        userId_currency: {
          userId: user.id,
          currency: "USDV",
        },
      },
      update: {}, // keep existing amount as-is (no reset on relogin)
      create: {
        userId: user.id,
        currency: "USDV",
        amount: startingAmount,
      },
    });

    return res.json({
      userId: user.id,
      email: user.email,
    });
  } catch (e) {
    console.error("dev-login error", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Get current user + balances based on x-user-id header.
 */
app.get("/me", async (req, res) => {
  const userId = (req as any).userId as string | null;

  if (!userId) {
    return res.status(401).json({ error: "Missing x-user-id header" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      balances: true,
      positions: {
        include: {
          market: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    balances: user.balances,
    positions: user.positions,
  });
});


/**
 * Markets list
 * 
 */
app.get("/markets", async (_req, res) => {
  const markets = await prisma.market.findMany({
    include: { venue: true },
    take: 50,
  });

  res.json(markets);
});

// Aggregated markets (currently only OddGrid; external venues later)
app.get("/aggregated-markets", async (_req, res) => {
  try {
    const markets = await aggregationService.listAllMarkets();
    res.json(markets);
  } catch (e) {
    console.error("aggregated-markets error", e);
    res.status(500).json({ error: "Failed to load aggregated markets" });
  }
});


/**
 * POST /orders
 * Buy YES on a YES/NO market against the house.
 *
 * Body:
 * {
 *   marketId: string;
 *   probability: number; // 0–1
 *   stakeUsd: number;    // how much USDV user pays
 * }
 *
 * Semantics:
 * - price = probability
 * - cost = stakeUsd
 * - shares = cost / price
 * - balance(USDV) -= cost
 * - position.size += shares
 * - position.avgPrice recalculated
 */
app.post("/orders", async (req, res) => {
  const userId = requireUserId(req, res);
  if (!userId) return;

  try {
    const { marketId, probability, stakeUsd } = req.body as {
      marketId?: string;
      probability?: number;
      stakeUsd?: number;
    };

    if (!marketId) {
      return res.status(400).json({ error: "marketId is required" });
    }
    if (typeof probability !== "number" || probability <= 0 || probability >= 1) {
      return res
        .status(400)
        .json({ error: "probability must be a number between 0 and 1 (exclusive)" });
    }
    if (typeof stakeUsd !== "number" || stakeUsd <= 0) {
      return res
        .status(400)
        .json({ error: "stakeUsd must be a positive number" });
    }

    // Load market
    const market = await prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      return res.status(404).json({ error: "Market not found" });
    }

    if (market.status !== "OPEN" || market.type !== "YES_NO") {
      return res
        .status(400)
        .json({ error: "Only OPEN YES_NO markets are tradable in this phase" });
    }

    // Load user + USDV balance
    const balance = await prisma.balance.findUnique({
      where: {
        userId_currency: {
          userId,
          currency: "USDV",
        },
      },
    });

    if (!balance) {
      return res.status(400).json({ error: "User has no USDV balance" });
    }

    const cost = stakeUsd;
    const available = Number(balance.amount);

    if (available < cost) {
      return res.status(400).json({
        error: "Insufficient USDV balance",
        available,
        required: cost,
      });
    }

    const price = probability;
    const shares = cost / price; // how many YES shares we get

    // Update DB (simple, non-transactional for now; good enough for Phase 1)
    const order = await prisma.order.create({
      data: {
        userId,
        marketId: market.id,
        side: "BUY",
        outcome: "YES",
        orderType: "MARKET",
        price,
        size: shares,
        status: "FILLED",
      },
    });

    await prisma.balance.update({
      where: {
        userId_currency: {
          userId,
          currency: "USDV",
        },
      },
      data: {
        amount: available - cost,
      },
    });

    // Update or create position
    const existingPosition = await prisma.position.findUnique({
      where: {
        userId_marketId_outcome: {
          userId,
          marketId: market.id,
          outcome: "YES",
        },
      },
    });

    if (!existingPosition) {
      await prisma.position.create({
        data: {
          userId,
          marketId: market.id,
          outcome: "YES",
          size: shares,
          avgPrice: price,
        },
      });
    } else {
      const prevSize = Number(existingPosition.size);
      const prevAvg = Number(existingPosition.avgPrice);
      const newSize = prevSize + shares;

      const newAvgPrice =
        newSize === 0
          ? price
          : (prevSize * prevAvg + shares * price) / newSize;

      await prisma.position.update({
        where: { id: existingPosition.id },
        data: {
          size: newSize,
          avgPrice: newAvgPrice,
        },
      });
    }

    // Return order + a lightweight summary
    return res.json({
      order,
      fill: {
        price,
        shares,
        cost,
      },
    });
  } catch (e) {
    console.error("order error", e);
    return res.status(500).json({ error: "Internal server error" });
  }
});

const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, () => {
  console.log(`OddGrid backend running on http://localhost:${PORT}`);
});
