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

export default function HomePage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMarkets = async () => {
      try {
        const res = await fetch("http://localhost:4000/markets");
        const data = await res.json();
        setMarkets(data);
      } catch (e) {
        console.error("Failed to fetch markets", e);
      } finally {
        setLoading(false);
      }
    };
    fetchMarkets();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">OddGrid (Phase 1)</h1>
          <span className="text-xs text-slate-400">
            Simulation-only · multi-venue markets
          </span>
        </header>

        {loading ? (
          <p>Loading markets...</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {markets.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border border-slate-800 p-4 bg-slate-900"
              >
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-lg font-semibold">{m.title}</h2>
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
          </div>
        )}
      </div>
    </main>
  );
}
