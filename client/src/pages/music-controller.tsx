import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Play, Pause, SkipForward, Square, Shuffle, Volume2,
  Music2, Disc3, ListMusic, RefreshCw, Radio,
} from "lucide-react";
import { apiRequest, DASHBOARD_AUTH_TOKEN_STORAGE_KEY, DASHBOARD_AUTH_CHANGED_EVENT } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const AUTH_FLAG_KEY = "alessa-authed";

function hasDashboardSession(): boolean {
  return (
    sessionStorage.getItem(AUTH_FLAG_KEY) === "1" &&
    !!sessionStorage.getItem(DASHBOARD_AUTH_TOKEN_STORAGE_KEY)
  );
}

interface QueueTrack {
  title: string;
  author: string;
  duration: number;
  uri: string;
  artworkUrl: string | null;
}

interface MusicEntry {
  guildId: string;
  current: QueueTrack | null;
  queueLength: number;
  volume: number;
  paused: boolean;
  loop: "none" | "track" | "queue";
  autoplay: boolean;
  position: number;
}

interface MusicStatusData {
  sessions: MusicEntry[];
  updatedAt: number;
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

function ProgressBar({ position, duration }: { position: number; duration: number }) {
  const pct = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  return (
    <div className="w-full bg-white/10 rounded-full h-1 mt-2">
      <div className="bg-indigo-400 h-1 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
    </div>
  );
}

function GuildCard({ entry, onControl }: {
  entry: MusicEntry;
  onControl: (guildId: string, action: string, opts?: Record<string, unknown>) => void;
}) {
  const [vol, setVol] = useState(entry.volume);

  useEffect(() => { setVol(entry.volume); }, [entry.volume]);

  const handleVolumeCommit = (v: number) => {
    onControl(entry.guildId, "volume", { value: v });
  };

  const loopLabel = entry.loop === "track" ? "🔂 Track" : entry.loop === "queue" ? "🔁 Queue" : "Loop: off";

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4" data-testid={`guild-card-${entry.guildId}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-indigo-400" />
          <span className="text-white/50 font-mono text-xs">Guild {entry.guildId.slice(0, 8)}…</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/40">
          <ListMusic className="w-3 h-3" />
          <span>{entry.queueLength} in queue</span>
          {entry.autoplay && <span className="text-indigo-400">✨ autoplay</span>}
        </div>
      </div>

      {entry.current ? (
        <div className="flex gap-4 items-start">
          {entry.current.artworkUrl ? (
            <img src={entry.current.artworkUrl} alt="art" className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Disc3 className="w-6 h-6 text-white/30" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold truncate" data-testid={`track-title-${entry.guildId}`}>
              {entry.current.title}
            </p>
            <p className="text-white/50 text-sm truncate">{entry.current.author}</p>
            <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
              <span>{formatDuration(entry.position)}</span>
              <span>/</span>
              <span>{formatDuration(entry.current.duration)}</span>
              {entry.paused && <span className="text-yellow-400 ml-1">⏸ paused</span>}
            </div>
            <ProgressBar position={entry.position} duration={entry.current.duration} />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-white/30 py-2">
          <Music2 className="w-5 h-5" />
          <span className="text-sm">Nothing playing</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          data-testid={`btn-pause-${entry.guildId}`}
          onClick={() => onControl(entry.guildId, entry.paused ? "resume" : "pause")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-medium transition-colors"
        >
          {entry.paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          {entry.paused ? "Resume" : "Pause"}
        </button>
        <button
          data-testid={`btn-skip-${entry.guildId}`}
          onClick={() => onControl(entry.guildId, "skip")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
        >
          <SkipForward className="w-4 h-4" /> Skip
        </button>
        <button
          data-testid={`btn-shuffle-${entry.guildId}`}
          onClick={() => onControl(entry.guildId, "shuffle")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
        >
          <Shuffle className="w-4 h-4" /> Shuffle
        </button>
        <button
          data-testid={`btn-stop-${entry.guildId}`}
          onClick={() => onControl(entry.guildId, "stop")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-300 text-sm transition-colors"
        >
          <Square className="w-4 h-4" /> Stop
        </button>
        <span className="text-white/30 text-xs ml-auto">{loopLabel}</span>
      </div>

      <div className="flex items-center gap-3">
        <Volume2 className="w-4 h-4 text-white/40 flex-shrink-0" />
        <input
          data-testid={`vol-slider-${entry.guildId}`}
          type="range" min={0} max={100} value={vol}
          onChange={e => setVol(Number(e.target.value))}
          onMouseUp={e => handleVolumeCommit(Number((e.target as HTMLInputElement).value))}
          onTouchEnd={e => handleVolumeCommit(Number((e.target as HTMLInputElement).value))}
          className="flex-1 accent-indigo-400"
        />
        <span className="text-white/50 text-xs w-8 text-right">{vol}%</span>
      </div>
    </div>
  );
}

export default function MusicControllerPage() {
  const [isAuthed, setIsAuthed] = useState(hasDashboardSession());
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => {
    const handler = () => setIsAuthed(hasDashboardSession());
    window.addEventListener(DASHBOARD_AUTH_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DASHBOARD_AUTH_CHANGED_EVENT, handler);
  }, []);

  const { data, isLoading, dataUpdatedAt } = useQuery<MusicStatusData>({
    queryKey: ["/api/music/status"],
    enabled: isAuthed,
    refetchInterval: 3000,
  });

  const controlMutation = useMutation({
    mutationFn: async ({ guildId, action, opts }: { guildId: string; action: string; opts?: Record<string, unknown> }) => {
      await apiRequest("POST", `/api/music/${guildId}/control`, { action, ...opts });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/music/status"] });
    },
    onError: (err: any) => {
      toast({ title: "Control failed", description: err.message, variant: "destructive" });
    },
  });

  const handleControl = useCallback((guildId: string, action: string, opts?: Record<string, unknown>) => {
    controlMutation.mutate({ guildId, action, opts });
  }, [controlMutation]);

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-[#0d0f1a] flex items-center justify-center">
        <div className="text-center text-white/50">
          <Music2 className="w-12 h-12 mx-auto mb-4 text-white/20" />
          <p className="mb-4">Dashboard login required.</p>
          <Link href="/admin" className="text-indigo-400 hover:text-indigo-300 underline">Go to admin login</Link>
        </div>
      </div>
    );
  }

  const sessions = data?.sessions ?? [];

  return (
    <div className="min-h-screen bg-[#0d0f1a] text-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Music2 className="w-7 h-7 text-indigo-400" />
            <div>
              <h1 className="text-2xl font-bold">Music Controller</h1>
              <p className="text-white/40 text-sm">Remote control for all active sessions</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {dataUpdatedAt > 0 && (
              <span className="text-white/30 text-xs flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> live
              </span>
            )}
            <Link href="/admin" className="text-white/40 hover:text-white text-sm transition-colors">← Admin</Link>
          </div>
        </div>

        {isLoading && (
          <div className="text-center text-white/40 py-16">
            <Disc3 className="w-10 h-10 mx-auto mb-3 animate-spin text-white/20" />
            <p>Loading sessions…</p>
          </div>
        )}

        {!isLoading && sessions.length === 0 && (
          <div className="text-center text-white/30 py-16 border border-white/5 rounded-2xl">
            <Music2 className="w-12 h-12 mx-auto mb-4 text-white/10" />
            <p className="text-lg">No active music sessions</p>
            <p className="text-sm mt-1">Alessa isn't playing in any servers right now.</p>
          </div>
        )}

        <div className="grid gap-4">
          {sessions.map(entry => (
            <GuildCard key={entry.guildId} entry={entry} onControl={handleControl} />
          ))}
        </div>
      </div>
    </div>
  );
}
