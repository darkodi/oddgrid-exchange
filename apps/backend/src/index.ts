import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  })
);
app.use(express.json());

// Health
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Very simple list markets - placeholder
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
