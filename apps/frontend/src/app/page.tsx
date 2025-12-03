"use client";

import { useEffect, useState } from "react";

type VenueSlug = "oddgrid" | "polymarket" | "kalshi" | "manifold";

type NormalizedOutcome = {
  id: string;
  name: string;
  probability: number | null;
  bestBid?: number | null;
  bestAsk?: number | null;
};

type Market = {
  id: string;
  venue: VenueSlug;
  externalId: string;
  title: string;
  description?: string | null;
  type: "YES_NO" | "MULTI_OUTCOME";
  status: "OPEN" | "RESOLVED" | "SUSPENDED";
  outcomes: NormalizedOutcome[];
  resolutionRule?: string | null;
  volume24h?: number | null;
  openInterest?: number | null;
  lastUpdated: string;
};

type Balance = {
  id: string;
  currency: string;
  amount: string;
};

type Position = {
  id: string;
  outcome: string;
  size: string;
  avgPrice: string;
  market: {
    id: string;
    title: string;
  };
};

type MeResponse = {
  id: string;
  email: string;
  username: string | null;
  balances: Balance[];
  positions?: Position[];
};

const BACKEND_URL = "http://localhost:4000";

export default function HomePage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [venueFilter, setVenueFilter] = useState<VenueSlug | "all">("all");
  const [loadingMarkets, setLoadingMarkets] = useState(true);

  const [email, setEmail] = useState("");
  const [user, setUser] = useState<MeResponse | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // local trade state per market
  const [probByMarket, setProbByMarket] = useState<Record<string, number>>({});
  const [stakeByMarket, setStakeByMarket] = useState<Record<string, number>>(
    {}
  );
  const [tradeMessage, setTradeMessage] = useState<string | null>(null);

  // Load markets once
  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/aggregated-markets`);
        const data = await res.json();
        setMarkets(data);
      } catch (e) {
        console.error("Failed to fetch markets", e);
      } finally {
        setLoadingMarkets(false);
      }
    };
    fetchMarkets();
  }, []);

  // On first load, try to restore a stored userId and fetch /me
  useEffect(() => {
    const storedUserId =
      typeof window !== "undefined"
        ? window.localStorage.getItem("oddgrid:userId")
        : null;

    if (storedUserId) {
      fetchMe(storedUserId);
    }
  }, []);

  const fetchMe = async (userId: string) => {
    try {
      setAuthLoading(true);
      setError(null);
      const res = await fetch(`${BACKEND_URL}/me`, {
        headers: {
          "x-user-id": userId,
        },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to fetch user");
      }

      const raw = (await res.json()) as MeResponse;
      setUser({
        ...raw,
        positions: raw.positions ?? [],
      });
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to load user");
      setUser(null);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDevLogin = async () => {
    if (!email) {
      setError("Please enter an email");
      return;
    }

    try {
      setAuthLoading(true);
      setError(null);

      const res = await fetch(`${BACKEND_URL}/auth/dev-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Login failed");
      }

      const data: { userId: string; email: string } = await res.json();

      if (typeof window !== "undefined") {
        window.localStorage.setItem("oddgrid:userId", data.userId);
      }

      await fetchMe(data.userId);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Login error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("oddgrid:userId");
    }
    setUser(null);
    setEmail("");
  };

  const usdBalance = user?.balances.find((b) => b.currency === "USDV");

  const getUserId = () => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem("oddgrid:userId");
  };

  const handleTrade = async (marketId: string) => {
    const userId = getUserId();
    if (!userId) {
      setError("You must be logged in to trade");
      return;
    }

    const currentProb = probByMarket[marketId] ?? 60;
    const currentStake = stakeByMarket[marketId] ?? 100;

    const probability = currentProb / 100; // convert % to 0–1
    const stakeUsd = currentStake;

    try {
      setError(null);
      setTradeMessage(null);

      const res = await fetch(`${BACKEND_URL}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
        body: JSON.stringify({
          marketId,
          probability,
          stakeUsd,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Order failed");
      }

      const data = await res.json();
      console.log("Order result", data);

      setTradeMessage(
        `Trade filled: bought YES at ${(probability * 100).toFixed(
          1
        )}% for ${stakeUsd.toFixed(2)} USDV`
      );

      // refresh user balances + positions
      await fetchMe(userId);
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Order error");
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">OddGrid (Phase 1)</h1>
            <p className="text-xs text-slate-400 mt-1">
              Simulation-only · multi-venue markets · dev login · simple YES
              buys
            </p>
          </div>

          {/* Auth box */}
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 min-w-[260px]">
            {user ? (
              <div className="space-y-2">
                <div className="text-sm">
                  <div className="text-slate-400 text-[11px] uppercase tracking-wide mb-1">
                    Logged in as
                  </div>
                  <div className="font-medium">{user.email}</div>
                  {user.username && (
                    <div className="text-xs text-slate-400">
                      ({user.username})
                    </div>
                  )}
                </div>
                <div className="text-sm">
                  <div className="text-slate-400 text-[11px] uppercase tracking-wide mb-1">
                    Virtual balance
                  </div>
                  <div className="font-semibold">
                    {usdBalance
                      ? Number(usdBalance.amount).toLocaleString()
                      : "0"}{" "}
                    USDV
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="mt-2 text-xs text-slate-300 underline underline-offset-2"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">
                  Dev login
                </div>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md bg-slate-950 border border-slate-800 px-2 py-1 text-sm outline-none focus:border-sky-500"
                />
                <button
                  onClick={handleDevLogin}
                  disabled={authLoading}
                  className="w-full mt-1 rounded-md bg-sky-600 hover:bg-sky-500 text-sm font-medium py-1.5 disabled:opacity-60"
                >
                  {authLoading ? "Logging in..." : "Login (dev)"}
                </button>
                <p className="text-[10px] text-slate-500 mt-1">
                  Internal only. Creates a simulated user with virtual USDV
                  balance.
                </p>
              </div>
            )}
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
            {tradeMessage && (
              <p className="mt-2 text-xs text-emerald-400">{tradeMessage}</p>
            )}
          </div>
        </header>

        {/* Markets + trade ticket */}
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Markets</h2>
          {loadingMarkets ? (
            <p className="text-sm text-slate-300">Loading markets…</p>
          ) : (
            <>
              {/* Venue filter bar */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-slate-400">Filter venue:</span>
                {(
                  [
                    "all",
                    "oddgrid",
                    "polymarket",
                    "kalshi",
                    "manifold",
                  ] as const
                ).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVenueFilter(v)}
                    className={`px-2 py-1 text-[11px] rounded-md border ${
                      venueFilter === v
                        ? "border-sky-500 bg-sky-900/40 text-sky-100"
                        : "border-slate-700 bg-slate-900 text-slate-300"
                    }`}
                  >
                    {v.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Visible markets based on filter */}
              <div className="grid md:grid-cols-2 gap-4">
                {(venueFilter === "all"
                  ? markets
                  : markets.filter((m) => m.venue === venueFilter)
                ).map((m) => {
                  const prob = probByMarket[m.id] ?? 60;
                  const stake = stakeByMarket[m.id] ?? 100;

                  return (
                    <div
                      key={m.id}
                      className="rounded-xl border border-slate-800 p-4 bg-slate-900 flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <h3 className="text-base font-semibold">{m.title}</h3>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-[10px] uppercase tracking-wide text-slate-400">
                            {m.venue}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            updated{" "}
                            {new Date(m.lastUpdated).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      {m.description && (
                        <p className="text-sm text-slate-300 line-clamp-3">
                          {m.description}
                        </p>
                      )}

                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>Status: {m.status}</span>
                        <span>Phase 1 · virtual only</span>
                      </div>

                      {/* Trade ticket */}
                      {user ? (
                        <div className="mt-2 space-y-2 border-t border-slate-800 pt-2">
                          <div className="flex gap-2 items-center">
                            <label className="text-xs text-slate-300 w-24">
                              Probability
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={99}
                              value={prob}
                              onChange={(e) =>
                                setProbByMarket((prev) => ({
                                  ...prev,
                                  [m.id]: Number(e.target.value),
                                }))
                              }
                              className="w-20 rounded-md bg-slate-950 border border-slate-800 px-2 py-1 text-xs"
                            />
                            <span className="text-xs text-slate-400">%</span>
                          </div>

                          <div className="flex gap-2 items-center">
                            <label className="text-xs text-slate-300 w-24">
                              Stake
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={stake}
                              onChange={(e) =>
                                setStakeByMarket((prev) => ({
                                  ...prev,
                                  [m.id]: Number(e.target.value),
                                }))
                              }
                              className="w-28 rounded-md bg-slate-950 border border-slate-800 px-2 py-1 text-xs"
                            />
                            <span className="text-xs text-slate-400">USDV</span>
                          </div>

                          <button
                            onClick={() => handleTrade(m.id)}
                            className="mt-1 w-full rounded-md bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold py-1.5"
                          >
                            Buy YES
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-[11px] text-slate-500 border-t border-slate-800 pt-2">
                          Login (dev) to simulate trades.
                        </p>
                      )}
                    </div>
                  );
                })}

                {markets.length === 0 && (
                  <p className="text-sm text-slate-400">
                    No markets yet. Seed via backend.
                  </p>
                )}
              </div>
            </>
          )}
        </section>

        {/* Simple positions view (debuggy) */}
        {user?.positions && user.positions.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-200">
              Open Positions (debug view)
            </h2>
            <div className="space-y-1 text-xs text-slate-300">
              {user.positions.map((p) => (
                <div
                  key={p.id}
                  className="flex justify-between border border-slate-800 rounded-md px-3 py-1.5 bg-slate-900"
                >
                  <div className="flex-1 mr-2">
                    <div className="font-semibold text-[11px]">
                      {p.market.title} — {p.outcome}
                    </div>
                  </div>
                  <div className="text-right">
                    <div>Size: {Number(p.size).toFixed(2)} shares</div>
                    <div>
                      Avg price: {(Number(p.avgPrice) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
