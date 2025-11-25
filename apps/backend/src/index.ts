import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
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
    include: { balances: true },
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  return res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    balances: user.balances,
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

const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, () => {
  console.log(`OddGrid backend running on http://localhost:${PORT}`);
});
