import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wifi,
  WifiOff,
  Clock,
  Music2,
  ListMusic,
  Lock,
  Bot,
  KeyRound,
  Activity,
} from "lucide-react";
import {
  apiRequest,
  DASHBOARD_AUTH_TOKEN_STORAGE_KEY,
  DASHBOARD_AUTH_CHANGED_EVENT,
} from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const AUTH_FLAG_KEY = "alessa-authed";

function hasDashboardSession(): boolean {
  return (
    sessionStorage.getItem(AUTH_FLAG_KEY) === "1" &&
    !!sessionStorage.getItem(DASHBOARD_AUTH_TOKEN_STORAGE_KEY)
  );
}

interface AlessaBotStatus {
  online: boolean;
  tag: string | null;
  avatarUrl: string | null;
  guildCount: number;
  uptimeStart: number | null;
  status: string;
  lastError: string | null;
}

interface DjTrackInfo {
  title: string;
  author: string;
  duration: number;
  position: number;
}

type RavePhase = "warmup" | "peak" | "afterhours" | "cooldown";

interface DjSession {
  guildId: string;
  genre: string;
  phase: RavePhase;
  currentTrack: DjTrackInfo | null;
  queueLength: number;
  timeRemaining: number | null;
}

interface DjStatusData {
  sessions: DjSession[];
  lavalink: { available: boolean; nodeCount: number };
  updatedAt: number;
}

interface ServiceHealth {
  processStartTime: number;
  uptimeMs: number;
}

const PHASE_LABEL: Record<RavePhase, string> = {
  warmup: "🌅 warm-up",
  peak: "🔥 peak",
  afterhours: "🌙 after-hours",
  cooldown: "🌌 cool-down",
};

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// ── Login screen ──────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      sessionStorage.setItem(DASHBOARD_AUTH_TOKEN_STORAGE_KEY, data.token);
      sessionStorage.setItem(AUTH_FLAG_KEY, "1");
      window.dispatchEvent(new Event(DASHBOARD_AUTH_CHANGED_EVENT));
      onLogin();
      toast({ title: "Logged in" });
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-full max-w-sm px-6">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/5 border border-white/10 mb-4">
            <Lock className="w-5 h-5 text-white/50" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-1">Alessa Dashboard</h1>
          <p className="text-sm text-white/30">Admin access</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Dashboard password"
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-white/25 transition-colors"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 text-sm font-medium bg-white text-[#111] rounded-lg hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Checking…" : "Log in"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

function Dashboard() {
  const { data: alfie, isLoading: alfieLoading } = useQuery<AlessaBotStatus>({
    queryKey: ["/api/alfie/status"],
    refetchInterval: 5000,
  });

  const { data: dj, isLoading: djLoading } = useQuery<DjStatusData>({
    queryKey: ["/api/dj/status"],
    refetchInterval: 5000,
  });

  const { data: service } = useQuery<ServiceHealth>({
    queryKey: ["/api/service/health"],
    refetchInterval: 30000,
  });

  const handleLogout = () => {
    sessionStorage.removeItem(AUTH_FLAG_KEY);
    sessionStorage.removeItem(DASHBOARD_AUTH_TOKEN_STORAGE_KEY);
    window.dispatchEvent(new Event(DASHBOARD_AUTH_CHANGED_EVENT));
    window.location.reload();
  };

  const uptime = alfie?.uptimeStart ? Date.now() - alfie.uptimeStart : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <nav className="border-b border-white/[0.07] bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-white/40" />
            <span className="text-sm font-medium text-white/60">Alessa Admin</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">

        {/* Bot status */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-4 h-4 text-white/30" />
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">Bot status</h2>
          </div>

          {alfieLoading ? (
            <p className="text-sm text-white/30">Loading…</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {alfie?.online ? (
                  <Wifi className="w-4 h-4 text-green-400" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-400" />
                )}
                <div>
                  <p className="text-base font-semibold text-white">
                    {alfie?.tag ?? "Alessa"}
                  </p>
                  <p className="text-xs text-white/30 capitalize">{alfie?.status ?? "offline"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
                <Stat label="Servers" value={alfie?.guildCount?.toString() ?? "—"} />
                <Stat label="Uptime" value={uptime != null ? formatUptime(uptime) : "—"} />
                <Stat label="Process uptime" value={service?.uptimeMs != null ? formatUptime(service.uptimeMs) : "—"} />
              </div>

              {alfie?.lastError && (
                <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">
                  {alfie.lastError}
                </p>
              )}

              {!alfie?.online && !alfie?.lastError && (
                <p className="text-xs text-white/30 bg-white/[0.03] rounded-lg px-3 py-2">
                  Set <code className="text-white/50">ALFIE_TOKEN</code> in Secrets and ensure <code className="text-white/50">ENABLE_ALFIE=true</code> to bring Alessa online.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Lavalink */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
          <div className="flex items-center gap-2 mb-5">
            <Music2 className="w-4 h-4 text-white/30" />
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">Audio</h2>
          </div>

          {djLoading ? (
            <p className="text-sm text-white/30">Loading…</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Stat
                label="Lavalink"
                value={dj?.lavalink.available ? "Connected" : "Unavailable"}
                valueClass={dj?.lavalink.available ? "text-green-400" : "text-red-400"}
              />
              <Stat label="Nodes" value={dj?.lavalink.nodeCount?.toString() ?? "0"} />
            </div>
          )}
        </div>

        {/* DJ / Rave sessions */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
          <div className="flex items-center gap-2 mb-5">
            <ListMusic className="w-4 h-4 text-white/30" />
            <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest">Active rave sessions</h2>
          </div>

          {djLoading ? (
            <p className="text-sm text-white/30">Loading…</p>
          ) : !dj?.sessions.length ? (
            <p className="text-sm text-white/25">No rave sessions running.</p>
          ) : (
            <div className="space-y-3">
              {dj.sessions.map((session) => (
                <div key={session.guildId} className="p-4 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-white">{session.genre}</p>
                    <span className="text-xs text-white/40">{PHASE_LABEL[session.phase]}</span>
                  </div>
                  {session.currentTrack && (
                    <p className="text-xs text-white/40 truncate">
                      {session.currentTrack.title} — {session.currentTrack.author}
                      {" · "}{formatDuration(session.currentTrack.position)} / {formatDuration(session.currentTrack.duration)}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-white/25">{session.queueLength} in queue</span>
                    {session.timeRemaining != null && (
                      <span className="text-xs text-white/25">
                        <Clock className="w-3 h-3 inline mr-1" />
                        {formatDuration(session.timeRemaining)} remaining
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div>
      <p className="text-xs text-white/30 mb-1">{label}</p>
      <p className={`text-sm font-semibold ${valueClass ?? "text-white"}`}>{value}</p>
    </div>
  );
}

// ── Page entry point ──────────────────────────────────────────────────────────

export default function Home() {
  const [authed, setAuthed] = useState(hasDashboardSession);

  useEffect(() => {
    const handler = () => setAuthed(hasDashboardSession());
    window.addEventListener(DASHBOARD_AUTH_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DASHBOARD_AUTH_CHANGED_EVENT, handler);
  }, []);

  if (!authed) {
    return <LoginScreen onLogin={() => setAuthed(true)} />;
  }

  return <Dashboard />;
}
