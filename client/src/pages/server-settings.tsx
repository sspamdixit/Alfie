import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";

interface GuildInfo {
  id: string;
  name: string;
  iconUrl: string | null;
  hasAlfie: boolean;
}

const COMMANDS = [
  { name: "/play", desc: "Play a song or playlist in your voice channel" },
  { name: "/playtop", desc: "Add a song to the front of the queue" },
  { name: "/skip", desc: "Skip the current track (vote-skip with 3+ listeners)" },
  { name: "/queue", desc: "Show the current music queue" },
  { name: "/nowplaying", desc: "Show what's currently playing" },
  { name: "/pause / /resume", desc: "Pause or resume playback" },
  { name: "/volume", desc: "Set the playback volume (0–100)" },
  { name: "/shuffle", desc: "Shuffle the queue" },
  { name: "/loop", desc: "Cycle loop mode: off → track → queue → off" },
  { name: "/seek", desc: "Seek to a position in the current track" },
  { name: "/lyrics", desc: "Fetch lyrics for the current or searched song" },
  { name: "/history", desc: "Show the last 20 tracks played this session" },
  { name: "/autoplay", desc: "Toggle autoplay when the queue runs out" },
  { name: "/savequeue", desc: "Save the current queue as a named playlist" },
  { name: "/playlist", desc: "List, load, or delete saved playlists" },
  { name: "/rave", desc: "Start an infinite genre-based rave with DJ commentary" },
  { name: "/ravestop", desc: "Stop the current rave session" },
  { name: "/speak", desc: "Say something in the voice channel via TTS" },
  { name: "/stop", desc: "Stop music and disconnect" },
  { name: "/disconnect", desc: "Disconnect from the voice channel" },
];

export default function ServerSettingsPage() {
  const [, navigate] = useLocation();
  const [match, params] = useRoute("/servers/:guildId");
  const guildId = match ? params?.guildId : null;

  const [guild, setGuild] = useState<GuildInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!guildId) return;
    fetch(`/api/public/guilds/${guildId}/info`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((info) => {
        if (!info) { navigate("/servers"); return; }
        setGuild(info);
      })
      .catch(() => navigate("/servers"))
      .finally(() => setLoading(false));
  }, [guildId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center">
        <span className="text-sm text-white/30">Loading…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111111] text-[#f0f0f0]" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>

      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.07] bg-[#111111]/90 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/servers")}
              className="text-sm text-white/30 hover:text-white/70 transition-colors"
            >
              ← servers
            </button>
            {guild && (
              <div className="flex items-center gap-2">
                <span className="text-white/15">·</span>
                {guild.iconUrl ? (
                  <img src={guild.iconUrl} alt={guild.name} className="w-5 h-5 rounded" />
                ) : null}
                <span className="text-sm text-white/50">{guild.name}</span>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="pt-24 pb-20 px-6 max-w-3xl mx-auto">

        {guild && !guild.hasAlfie && (
          <div className="mb-8 p-4 rounded-lg border border-white/[0.1] bg-white/[0.03]">
            <p className="text-sm text-white/60 mb-1 font-medium">Alessa isn't in this server yet</p>
            <p className="text-xs text-white/30 mb-3">Add Alessa to start using music commands.</p>
            <a
              href={`/api/public/invite-url?guild_id=${guild?.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-white/50 hover:text-white/80 transition-colors underline underline-offset-4"
            >
              Add Alessa to this server →
            </a>
          </div>
        )}

        <div className="mb-10">
          <h1 className="text-2xl font-bold text-white mb-1">{guild?.name ?? "Server"}</h1>
          <p className="text-sm text-white/30">
            {guild?.hasAlfie ? "Alessa is active in this server." : "Alessa is not in this server yet."}
          </p>
        </div>

        <div className="mb-6">
          <p className="text-xs text-white/25 uppercase tracking-widest font-medium mb-5">Available commands</p>
          <div className="divide-y divide-white/[0.05]">
            {COMMANDS.map((cmd) => (
              <div key={cmd.name} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <code className="text-sm text-white/80 font-mono">{cmd.name}</code>
                <p className="text-xs text-white/35">{cmd.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {guild?.hasAlfie && (
          <div className="mt-10 pt-8 border-t border-white/[0.07]">
            <a
              href={`/api/public/invite-url?guild_id=${guild.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/30 hover:text-white/60 transition-colors underline underline-offset-4"
            >
              Re-invite Alessa to this server
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
