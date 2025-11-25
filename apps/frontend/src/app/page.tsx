"use client";

import { useEffect, useState } from "react";

type Venue = {
  id: string;
  name: string;
  slug: string;
};

type Market = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  venue: Venue;
};

type Balance = {
  id: string;
  currency: string;
  amount: string; // Prisma Decimal serialized as string
};

type MeResponse = {
  id: string;
  email: string;
  username: string | null;
  balances: Balance[];
};

const BACKEND_URL = "http://localhost:4000";

export default function HomePage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loadingMarkets, setLoadingMarkets] = useState(true);

  const [email, setEmail] = useState("");
  const [user, setUser] = useState<MeResponse | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load markets once
  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/markets`);
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

      const data: MeResponse = await res.json();
      setUser(data);
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

      // Store userId locally for future sessions
      if (typeof window !== "undefined") {
        window.localStorage.setItem("oddgrid:userId", data.userId);
      }

      // Fetch full profile + balances
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

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">OddGrid (Phase 1)</h1>
            <p className="text-xs text-slate-400 mt-1">
              Simulation-only · multi-venue markets · dev login
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
                    {usdBalance ? Number(usdBalance.amount).toLocaleString() : "0"}{" "}
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
            {error && (
              <p className="mt-2 text-xs text-red-400">
                {error}
              </p>
            )}
          </div>
        </header>

        {/* Markets list */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Markets</h2>
          {loadingMarkets ? (
            <p className="text-sm text-slate-300">Loading markets…</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {markets.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-slate-800 p-4 bg-slate-900"
                >
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-base font-semibold">{m.title}</h3>
                    <span className="text-[10px] uppercase tracking-wide text-slate-400">
                      {m.venue?.slug}
                    </span>
                  </div>
                  {m.description && (
                    <p className="text-sm text-slate-300 line-clamp-3">
                      {m.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span>Status: {m.status}</span>
                    <span>Phase 1 · virtual only</span>
                  </div>
                </div>
              ))}
              {markets.length === 0 && (
                <p className="text-sm text-slate-400">
                  No markets yet. Seed via backend.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
