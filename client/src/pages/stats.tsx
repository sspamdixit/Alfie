import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Music, TrendingUp, Globe, Hash } from "lucide-react";
import { DASHBOARD_AUTH_TOKEN_STORAGE_KEY, DASHBOARD_AUTH_CHANGED_EVENT } from "@/lib/queryClient";
import { Link } from "wouter";

const AUTH_FLAG_KEY = "alessa-authed";

function hasDashboardSession(): boolean {
  return (
    sessionStorage.getItem(AUTH_FLAG_KEY) === "1" &&
    !!sessionStorage.getItem(DASHBOARD_AUTH_TOKEN_STORAGE_KEY)
  );
}

interface GlobalStats {
  totalPlays: number;
  uniqueTracks: number;
  topGuilds: Array<{ guildId: string; plays: number }>;
  updatedAt: number;
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-start gap-4" data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">{icon}</div>
      <div>
        <p className="text-white/50 text-sm">{label}</p>
        <p className="text-white text-2xl font-bold mt-0.5">{typeof value === "number" ? value.toLocaleString() : value}</p>
        {sub && <p className="text-white/30 text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function StatsPage() {
  const [isAuthed, setIsAuthed] = useState(hasDashboardSession());

  useEffect(() => {
    const handler = () => setIsAuthed(hasDashboardSession());
    window.addEventListener(DASHBOARD_AUTH_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DASHBOARD_AUTH_CHANGED_EVENT, handler);
  }, []);

  const { data, isLoading } = useQuery<GlobalStats>({
    queryKey: ["/api/music/stats"],
    enabled: isAuthed,
    refetchInterval: 30_000,
  });

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[#0d0f1a] flex items-center justify-center">
        <div className="text-center text-white/50">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 text-white/20" />
          <p className="mb-4">Dashboard login required.</p>
          <Link href="/admin" className="text-indigo-400 hover:text-indigo-300 underline">Go to admin login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0f1a] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-indigo-400" />
            <div>
              <h1 className="text-2xl font-bold">Listening Stats</h1>
              <p className="text-white/40 text-sm">All-time play counts across every server</p>
            </div>
          </div>
          <Link href="/admin" className="text-white/40 hover:text-white text-sm transition-colors">← Admin</Link>
        </div>

        {isLoading && (
          <div className="text-center text-white/40 py-16">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 text-white/20 animate-pulse" />
            <p>Loading stats…</p>
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <StatCard
                icon={<Music className="w-5 h-5" />}
                label="Total Plays"
                value={data.totalPlays}
                sub="songs played across all servers"
              />
              <StatCard
                icon={<Hash className="w-5 h-5" />}
                label="Unique Tracks"
                value={data.uniqueTracks}
                sub="distinct songs ever played"
              />
            </div>

            {data.topGuilds.length > 0 && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-indigo-400" />
                  <h2 className="font-semibold text-white">Most Active Servers</h2>
                </div>
                <div className="space-y-3">
                  {data.topGuilds.map((g, i) => (
                    <div key={g.guildId} className="flex items-center gap-3" data-testid={`top-guild-${i}`}>
                      <span className="text-white/30 text-sm w-5 text-right">{i + 1}.</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white/70 font-mono text-xs">{g.guildId}</span>
                          <span className="text-white/50 text-xs">{g.plays.toLocaleString()} plays</span>
                        </div>
                        <div className="w-full bg-white/5 rounded-full h-1.5">
                          <div
                            className="bg-indigo-500 h-1.5 rounded-full"
                            style={{ width: `${Math.round((g.plays / data.topGuilds[0].plays) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.topGuilds.length === 0 && (
              <div className="text-center text-white/30 py-10 border border-white/5 rounded-2xl">
                <Globe className="w-10 h-10 mx-auto mb-3 text-white/10" />
                <p>No play data yet.</p>
                <p className="text-sm mt-1">Stats accumulate as Alessa plays music in servers.</p>
              </div>
            )}

            {data.updatedAt && (
              <p className="text-white/20 text-xs text-center mt-6">
                Updated {new Date(data.updatedAt).toLocaleTimeString()}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
