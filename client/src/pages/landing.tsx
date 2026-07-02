import { useEffect, useState, useRef, useCallback, useSyncExternalStore } from "react";
import { Link } from "wouter";

// ── prefers-reduced-motion hook ────────────────────────────────────────────
function subscribe(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

// ── palette ────────────────────────────────────────────────────────────────
const VOID         = "#0a0a0a";
const INK          = "#f5f0ec";
const DIM          = "rgba(245,240,236,0.45)";
const DIM2         = "rgba(245,240,236,0.28)";
const RULE         = "rgba(245,240,236,0.08)";
const CRIMSON      = "#c41e3a";
const CRIMSON_MID  = "rgba(196,30,58,0.5)";
const CRIMSON_DIM  = "rgba(196,30,58,0.12)";
const CRIMSON_DIM2 = "rgba(196,30,58,0.07)";

const LACE: React.CSSProperties = {
  backgroundImage: `linear-gradient(rgba(10,10,10,0.96),rgba(10,10,10,0.96)),url('/lace-texture.webp')`,
  backgroundSize: "auto,420px auto",
  backgroundRepeat: "repeat",
  backgroundColor: VOID,
};

const SERIF   = "'Cinzel',serif";
const DECO    = "'Cinzel Decorative',serif";
const CURSIVE = "'Cormorant Garamond',serif";
const MONO    = "'Fira Code','JetBrains Mono',monospace";

// ── demo data ─────────────────────────────────────────────────────────────
const DEMO_TRACKS = [
  { title: "Midnight City",   artist: "M83",              duration: "4:03", requester: "luna"  },
  { title: "Runaway",         artist: "Kanye West",        duration: "9:08", requester: "kai"   },
  { title: "Redbone",         artist: "Childish Gambino",  duration: "5:27", requester: "mira"  },
  { title: "Electric Feel",   artist: "MGMT",              duration: "3:49", requester: "sol"   },
] as const;

const DEMO_QUEUE = [
  "Midnight City — M83",
  "Electric Feel — MGMT",
  "Redbone — Childish Gambino",
  "Do I Wanna Know? — Arctic Monkeys",
  "Runaway — Kanye West",
];

const TICKER = [
  "YouTube","SoundCloud","Spotify","15-Band EQ","Crossfade",
  "Rave Mode","AI DJ","Jukebox Vote","Saved Playlists","24/7 Mode",
  "Request Channels","Spotify Import","Sleep Timer","Lyrics","History",
  "Autoplay","TTS","DJ Roles","Queue Control","Stats",
];

// ── comparison ────────────────────────────────────────────────────────────
type CheckVal = boolean | "paid";
interface CompareRow {
  label:  string;
  alessa: CheckVal | string; // string only on the price row
  hydra:  CheckVal | string;
  jockie: CheckVal | string;
  mee6:   CheckVal | string;
}
const COMPARE_FEATURES: CompareRow[] = [
  { label: "Spotify import",        alessa: true,  hydra: "paid",    jockie: "paid",   mee6: "paid"    },
  { label: "Saved playlists",       alessa: true,  hydra: "paid",    jockie: true,     mee6: "paid"    },
  { label: "24/7 mode",             alessa: true,  hydra: "paid",    jockie: "paid",   mee6: "paid"    },
  { label: "15-band EQ",            alessa: true,  hydra: "paid",    jockie: false,    mee6: false     },
  { label: "Crossfade",             alessa: true,  hydra: "paid",    jockie: false,    mee6: false     },
  { label: "AI rave sessions",      alessa: true,  hydra: false,     jockie: false,    mee6: false     },
  { label: "Request channel",       alessa: true,  hydra: "paid",    jockie: false,    mee6: "paid"    },
  { label: "Web dashboard",         alessa: true,  hydra: "paid",    jockie: false,    mee6: "paid"    },
  { label: "Vote queue (jukebox)",  alessa: true,  hydra: false,     jockie: false,    mee6: false     },
  { label: "Listening stats",       alessa: true,  hydra: "paid",    jockie: false,    mee6: "paid"    },
  { label: "Price",                 alessa: "Free",hydra: "$3.99/mo",jockie: "$4/mo",  mee6: "$5.99/mo"},
];

// ── features ──────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: "▶",  title: "Stream Anything",      desc: "YouTube, SoundCloud, Spotify. Search by name or paste any link — Alessa resolves it and queues it instantly, no menus required." },
  { icon: "🎛", title: "15-Band EQ + Crossfade", desc: "Dial in every frequency from –0.25 to 1.0. Set crossfade up to 10 seconds so tracks blend rather than cut cold." },
  { icon: "🔥", title: "Rave Mode",             desc: "Infinite genre sessions with real-time AI DJ commentary between tracks. Set a vibe, pick a genre, walk away." },
  { icon: "🗳", title: "Jukebox Vote Queue",    desc: "Alessa presents 3 options, the VC votes, the winner plays. Democratic, no arguments in chat." },
  { icon: "📋", title: "Saved Playlists",       desc: "Save the current queue as a named playlist. Reload it anytime with /playlist load. Per-user, per-server." },
  { icon: "🌐", title: "Web Dashboard",         desc: "Control music from your browser — pause, skip, shuffle, EQ, volume. Live, without touching Discord." },
  { icon: "📡", title: "Request Channel",       desc: "Designate a text channel as a request board. Members post a song, Alessa reacts ✅ and queues it." },
  { icon: "📊", title: "Listening Stats",       desc: "Per-server and global play counts, top track leaderboards, and unique track totals — all via /stats." },
  { icon: "♾", title: "24/7 Mode",             desc: "Stays in VC after everyone leaves. Releases the audio node when idle, wakes up the moment someone returns." },
];

const STEPS = [
  { n: "01", title: "Invite in seconds",  desc: "Click 'Add to Discord', select your server, done. No dashboard login, no setup wizard, no credit card." },
  { n: "02", title: "Type /play",          desc: "Paste a URL or search by name. YouTube, SoundCloud, Spotify playlists all work out of the box." },
  { n: "03", title: "Run the server",      desc: "Set EQ, request channels, DJ roles, 24/7 mode. Every setting persists across restarts." },
];

const CMDS_A = [
  { n: "/play",           d: "Song, playlist, or Spotify URL" },
  { n: "/skip",           d: "Skip (vote-skip with 3+ listeners)" },
  { n: "/queue",          d: "Show the full queue" },
  { n: "/nowplaying",     d: "Rich embed of the current track" },
  { n: "/volume",         d: "Set volume 0–100" },
  { n: "/shuffle",        d: "Shuffle the queue" },
  { n: "/loop",           d: "off → track → queue → off" },
  { n: "/autoplay",       d: "Keep going when queue ends" },
  { n: "/sleep",          d: "Auto-stop after N minutes" },
  { n: "/seek",           d: "Jump to a timestamp" },
];
const CMDS_B = [
  { n: "/eq",             d: "Set EQ band (0–14, –0.25 to 1.0)" },
  { n: "/crossfade",      d: "Blend tracks (0–10 s)" },
  { n: "/jukebox",        d: "Vote queue — VC picks the winner" },
  { n: "/rave",           d: "Infinite AI DJ session by genre" },
  { n: "/savequeue",      d: "Save queue as named playlist" },
  { n: "/playlist",       d: "list / load / delete a playlist" },
  { n: "/stats",          d: "Listening stats (server or global)" },
  { n: "/speak",          d: "TTS in your voice channel" },
  { n: "/247",            d: "Toggle 24/7 persistence mode" },
  { n: "/requestchannel", d: "Set a dedicated request board" },
];

// ── primitives ────────────────────────────────────────────────────────────

const Cross = ({ size = 12, color = CRIMSON, opacity = 1 }: { size?: number; color?: string; opacity?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true" style={{ opacity, flexShrink: 0, display: "block" }}>
    <rect x="5" y="0" width="2" height="12" fill={color} />
    <rect x="0" y="5" width="12" height="2" fill={color} />
  </svg>
);

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
      <Cross size={8} opacity={0.5} />
      <span style={{ fontFamily: SERIF, fontSize: "0.44rem", letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(196,30,58,0.65)" }}>{children}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: DECO, fontWeight: 900, fontSize: "clamp(1.8rem,3.2vw,2.7rem)", letterSpacing: "0.04em", textTransform: "uppercase", color: INK, margin: "0 0 1rem", lineHeight: 1.05 }}>
      {children}
    </h2>
  );
}

function Btn({ href, children, variant = "outline", size = "md" }: { href: string; children: React.ReactNode; variant?: "solid" | "outline"; size?: "md" | "lg" }) {
  const [hov, setHov] = useState(false);
  return (
    <a href={href}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "inline-block", fontFamily: SERIF, fontWeight: 600, fontSize: size === "lg" ? "0.7rem" : "0.63rem", letterSpacing: "0.2em", textTransform: "uppercase", textDecoration: "none", padding: size === "lg" ? "18px 56px" : "13px 32px", border: `1.5px solid ${variant === "solid" ? CRIMSON : hov ? CRIMSON : RULE}`, background: variant === "solid" ? (hov ? "transparent" : CRIMSON) : (hov ? CRIMSON : "transparent"), color: INK, transition: "background 0.22s, border-color 0.22s", cursor: "pointer", whiteSpace: "nowrap" }}>
      {children}
    </a>
  );
}

function NavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ fontFamily: SERIF, fontSize: "0.56rem", letterSpacing: "0.2em", textTransform: "uppercase", color: hov ? INK : DIM, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.18s" }}>
      {children}
    </button>
  );
}

// ── NowPlayingCard ────────────────────────────────────────────────────────
function NowPlayingCard() {
  // Single source of truth: trackIdx + progress live together in one ref so
  // the setInterval callback always sees fresh values without stale closures.
  const stateRef = useRef({ trackIdx: 0, progress: 0.3, playing: true });
  const [display, setDisplay] = useState({ trackIdx: 0, progress: 0.3, playing: true });
  const [queueOpen, setQueueOpen] = useState(false);

  const commit = () => setDisplay({ ...stateRef.current });

  // Advance playback every 120 ms
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      if (!s.playing) return;
      s.progress += 0.002;
      if (s.progress >= 1) {
        s.trackIdx = (s.trackIdx + 1) % DEMO_TRACKS.length;
        s.progress = 0;
      }
      setDisplay({ ...s });
    }, 120);
    return () => clearInterval(id);
  }, []);

  const goTrack = (delta: number) => {
    const s = stateRef.current;
    s.trackIdx = (s.trackIdx + delta + DEMO_TRACKS.length) % DEMO_TRACKS.length;
    s.progress = 0;
    commit();
  };
  const togglePlay = () => {
    stateRef.current.playing = !stateRef.current.playing;
    commit();
  };

  const track = DEMO_TRACKS[display.trackIdx];
  const [m, sec] = track.duration.split(":").map(Number);
  const totalSec = m * 60 + sec;
  const elapsedSec = Math.floor(totalSec * display.progress);
  const elapsed = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, "0")}`;

  return (
    <div style={{ position: "relative", width: "clamp(280px,30vw,390px)" }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: "-30px", background: `radial-gradient(ellipse at 50% 60%, rgba(196,30,58,0.2) 0%, transparent 70%)`, pointerEvents: "none", zIndex: 0 }} />

      <div role="region" aria-label="Live music player demo" style={{ position: "relative", zIndex: 1, background: "rgba(14,10,10,0.93)", border: `1px solid ${RULE}`, backdropFilter: "blur(24px)" }}>
        <div style={{ height: 2, background: `linear-gradient(90deg,${CRIMSON},rgba(196,30,58,0.3))` }} />

        <div style={{ padding: "1.4rem 1.5rem 0" }}>
          {/* header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.2rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div aria-hidden="true" style={{ width: 6, height: 6, borderRadius: "50%", background: CRIMSON, boxShadow: `0 0 8px ${CRIMSON}`, animation: display.playing ? "np-pulse 1.8s ease-in-out infinite" : "none" }} />
              <span style={{ fontFamily: SERIF, fontSize: "0.46rem", letterSpacing: "0.32em", textTransform: "uppercase", color: "rgba(196,30,58,0.8)" }}>Now Playing</span>
            </div>
            <span aria-hidden="true" style={{ fontFamily: MONO, fontSize: "0.6rem", color: DIM2 }}>#247</span>
          </div>

          {/* track info */}
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1.2rem" }}>
            <div aria-hidden="true" style={{ width: 58, height: 58, flexShrink: 0, background: `linear-gradient(135deg,rgba(196,30,58,0.35) 0%,rgba(30,10,10,0.9) 100%)`, border: `1px solid ${RULE}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>♪</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.05em", color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: "0.25rem" }}>{track.title}</div>
              <div style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.85rem", color: DIM, marginBottom: "0.3rem" }}>{track.artist}</div>
              <div style={{ fontFamily: MONO, fontSize: "0.52rem", color: "rgba(196,30,58,0.55)", letterSpacing: "0.04em" }}>requested by {track.requester}</div>
            </div>
          </div>

          {/* progress */}
          <div style={{ marginBottom: "0.6rem" }}>
            <div role="progressbar" aria-valuenow={Math.round(display.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Playback progress: ${elapsed} of ${track.duration}`}
              style={{ height: 2, background: "rgba(245,240,236,0.08)", position: "relative" }}>
              <div style={{ height: "100%", width: `${display.progress * 100}%`, background: `linear-gradient(90deg,${CRIMSON},rgba(196,30,58,0.6))`, transition: "width 0.12s linear" }} />
              <div aria-hidden="true" style={{ position: "absolute", top: "50%", left: `${display.progress * 100}%`, transform: "translate(-50%,-50%)", width: 8, height: 8, borderRadius: "50%", background: CRIMSON, boxShadow: `0 0 6px ${CRIMSON}` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.35rem" }}>
              <span style={{ fontFamily: MONO, fontSize: "0.5rem", color: DIM2 }}>{elapsed}</span>
              <span style={{ fontFamily: MONO, fontSize: "0.5rem", color: DIM2 }}>{track.duration}</span>
            </div>
          </div>

          {/* controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1.8rem", paddingBottom: "1.1rem" }}>
            <button type="button" aria-label="Previous track" onClick={() => goTrack(-1)}
              style={{ background: "none", border: "none", cursor: "pointer", color: DIM, padding: 0, fontSize: "0.9rem", lineHeight: 1 }}>⏮</button>
            <button type="button" aria-label={display.playing ? "Pause" : "Play"} onClick={togglePlay}
              style={{ width: 38, height: 38, borderRadius: "50%", border: `1.5px solid ${CRIMSON}`, background: CRIMSON_DIM, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", color: INK, transition: "background 0.2s" }}>
              {display.playing ? "⏸" : "▶"}
            </button>
            <button type="button" aria-label="Next track" onClick={() => goTrack(1)}
              style={{ background: "none", border: "none", cursor: "pointer", color: DIM, padding: 0, fontSize: "0.9rem", lineHeight: 1 }}>⏭</button>
            <button type="button" aria-label={queueOpen ? "Hide queue" : "Show queue"} onClick={() => setQueueOpen(o => !o)}
              style={{ background: "none", border: "none", cursor: "pointer", color: queueOpen ? CRIMSON : DIM2, padding: 0, fontSize: "0.8rem", transition: "color 0.15s" }}>☰</button>
          </div>
        </div>

        {/* queue drawer */}
        <div style={{ maxHeight: queueOpen ? 180 : 0, overflow: "hidden", transition: "max-height 0.32s ease", borderTop: queueOpen ? `1px solid ${RULE}` : "none" }}>
          {DEMO_QUEUE.map((t, i) => (
            <div key={t} style={{ padding: "0.6rem 1.5rem", borderBottom: i < DEMO_QUEUE.length - 1 ? `1px solid ${RULE}` : "none", display: "flex", alignItems: "center", gap: "0.7rem" }}>
              <span aria-hidden="true" style={{ fontFamily: MONO, fontSize: "0.46rem", color: CRIMSON_MID, minWidth: 14 }}>{i + 1}</span>
              <span style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.82rem", color: i === 0 ? INK : DIM2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</span>
            </div>
          ))}
        </div>
      </div>

      {/* floating label */}
      <div aria-hidden="true" style={{ position: "absolute", bottom: -14, right: 16, background: VOID, border: `1px solid ${RULE}`, padding: "4px 10px", display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <Cross size={6} opacity={0.6} />
        <span style={{ fontFamily: SERIF, fontSize: "0.38rem", letterSpacing: "0.28em", textTransform: "uppercase", color: DIM2 }}>Web Dashboard</span>
      </div>
    </div>
  );
}

// ── Marquee ───────────────────────────────────────────────────────────────
function Marquee() {
  const items = [...TICKER, ...TICKER];
  return (
    <div aria-hidden="true" style={{ overflow: "hidden", borderTop: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}`, padding: "0.85rem 0", background: CRIMSON_DIM2 }}>
      <div style={{ display: "flex", gap: "3rem", width: "max-content", animation: "marquee 40s linear infinite" }}>
        {items.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.7rem", flexShrink: 0 }}>
            <Cross size={7} opacity={0.4} />
            <span style={{ fontFamily: SERIF, fontSize: "0.46rem", letterSpacing: "0.28em", textTransform: "uppercase", color: DIM }}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FeatureCard ───────────────────────────────────────────────────────────
// Borders are driven by CSS classes so the mobile override works cleanly.
function FeatureCard({ icon, title, desc, index }: { icon: string; title: string; desc: string; index: number }) {
  const [hov, setHov] = useState(false);
  const col = index % 3;
  const row = Math.floor(index / 3);
  // Build class list for responsive borders
  const borderClasses = [
    col < 2 ? "fc-border-right"  : "",
    row < 2 ? "fc-border-bottom" : "",
  ].filter(Boolean).join(" ");
  return (
    <div className={borderClasses} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: "2.4rem 2rem 2rem", background: hov ? "rgba(196,30,58,0.05)" : "transparent", boxShadow: hov ? `inset 0 3px 0 0 ${CRIMSON}` : `inset 0 3px 0 0 transparent`, transition: "background 0.22s, box-shadow 0.22s" }}>
      <div style={{ marginBottom: "1.1rem" }}>
        <span aria-hidden="true" style={{ fontSize: "1.5rem", display: "block", marginBottom: "0.7rem" }}>{icon}</span>
        <span style={{ fontFamily: SERIF, fontSize: "0.42rem", letterSpacing: "0.38em", textTransform: "uppercase", color: hov ? CRIMSON : "rgba(196,30,58,0.5)", transition: "color 0.2s" }}>0{index + 1}</span>
      </div>
      <h3 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.12em", textTransform: "uppercase", color: INK, margin: "0 0 0.7rem" }}>{title}</h3>
      <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.96rem", lineHeight: 1.8, color: DIM, margin: 0 }}>{desc}</p>
    </div>
  );
}

// ── CompareCell ───────────────────────────────────────────────────────────
function CompareCell({ val, isAlessa }: { val: CompareRow[keyof Omit<CompareRow, "label">]; isAlessa: boolean }) {
  // "paid" badge — must come before the generic string check
  if (val === "paid") {
    return (
      <td style={{ padding: "0.85rem 1.2rem", textAlign: "center", borderRight: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
        <span style={{ fontFamily: SERIF, fontSize: "0.44rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,236,0.22)", background: "rgba(245,240,236,0.05)", padding: "3px 8px", border: `1px solid rgba(245,240,236,0.1)` }}>paid</span>
      </td>
    );
  }
  // Price row — any other string (e.g. "Free", "$3.99/mo")
  if (typeof val === "string") {
    return (
      <td style={{ padding: "0.85rem 1.2rem", textAlign: "center", borderRight: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
        <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "0.65rem", letterSpacing: "0.08em", color: isAlessa ? CRIMSON : DIM2 }}>{val}</span>
      </td>
    );
  }
  return (
    <td style={{ padding: "0.85rem 1.2rem", textAlign: "center", borderRight: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>
      {val ? (
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-label="Yes" role="img" style={{ margin: "0 auto", display: "block" }}>
          <path d="M2 7l4 4 6-6" stroke={isAlessa ? CRIMSON : "rgba(245,240,236,0.35)"} strokeWidth={isAlessa ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-label="No" role="img" style={{ margin: "0 auto", display: "block", opacity: 0.2 }}>
          <path d="M2 2l8 8M10 2l-8 8" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </td>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [inviteUrl,  setInviteUrl]  = useState<string>("#");
  const [navSolid,   setNavSolid]   = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const reducedMotion = useReducedMotion();

  // Parallax/tilt driven via refs → direct DOM transform, no per-frame setState
  const crossRef = useRef<HTMLImageElement>(null);
  const cardRef  = useRef<HTMLDivElement>(null);
  const rafRef   = useRef<number | null>(null);
  const target   = useRef({ tx: 0, ty: 0, px: 0, py: 0 });
  const cur      = useRef({ tx: 0, ty: 0, px: 0, py: 0 });
  const wrapRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/public/invite-url")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.url) setInviteUrl(d.url); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const cb = () => setNavSolid(el.scrollTop > 60);
    el.addEventListener("scroll", cb, { passive: true });
    return () => el.removeEventListener("scroll", cb);
  }, []);

  // RAF loop: only runs when motion is allowed
  useEffect(() => {
    if (reducedMotion) {
      if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
      // Reset transforms so the elements sit in their natural position
      if (crossRef.current) crossRef.current.style.transform = "";
      if (cardRef.current)  cardRef.current.style.transform  = "";
      return;
    }
    const ease = 0.07;
    const tick = () => {
      const t = target.current, c = cur.current;
      c.tx += (t.tx - c.tx) * ease;
      c.ty += (t.ty - c.ty) * ease;
      c.px += (t.px - c.px) * ease;
      c.py += (t.py - c.py) * ease;
      if (crossRef.current)
        crossRef.current.style.transform = `perspective(900px) rotateX(${c.tx * 0.7}deg) rotateY(${c.ty * 0.7}deg)`;
      if (cardRef.current)
        cardRef.current.style.transform = `translate(${c.px * -0.1}px,${c.py * -0.1}px)`;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [reducedMotion]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    if (reducedMotion) return;
    const { clientX, clientY, currentTarget } = e;
    const { width, height, left, top } = currentTarget.getBoundingClientRect();
    const nx = (clientX - left) / width  - 0.5;
    const ny = (clientY - top)  / height - 0.5;
    target.current = { tx: ny * 10, ty: nx * -10, px: nx * 22, py: ny * 10 };
  }, [reducedMotion]);

  const onMouseLeave = useCallback(() => { target.current = { tx: 0, ty: 0, px: 0, py: 0 }; }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
    setMobileMenu(false);
  };

  return (
    <div ref={wrapRef} style={{ ...LACE, fontFamily: SERIF, overflowY: "auto", overflowX: "hidden" }}>

      {/* ── GLOBAL STYLES ──────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@700;900&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Fira+Code:wght@400;500&display=swap');

        @keyframes alessa-fade-up { from{opacity:0;transform:translateY(20px);}  to{opacity:1;transform:translateY(0);} }
        @keyframes alessa-pulse   { 0%,100%{transform:scale(1);opacity:.65;}     50%{transform:scale(1.09);opacity:1;} }
        @keyframes alessa-float   { 0%,100%{transform:translateY(0);}            50%{transform:translateY(-20px);} }
        @keyframes marquee        { from{transform:translateX(0);}               to{transform:translateX(-50%);} }
        @keyframes np-pulse       { 0%,100%{opacity:1;}                          50%{opacity:0.25;} }

        @media (prefers-reduced-motion: reduce) {
          *,*::before,*::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; }
        }

        *,*::before,*::after { box-sizing:border-box; }
        body { margin:0; }
        a { color:inherit; }
        ::-webkit-scrollbar       { width:4px; }
        ::-webkit-scrollbar-track { background:${VOID}; }
        ::-webkit-scrollbar-thumb { background:rgba(196,30,58,0.35); border-radius:2px; }

        /* ── feature card borders (desktop) ────── */
        .fc-border-right  { border-right:  1px solid ${RULE}; }
        .fc-border-bottom { border-bottom: 1px solid ${RULE}; }

        /* ── responsive overrides ───────────────── */
        @media (max-width: 768px) {
          .hero-split       { flex-direction: column !important; }
          .hero-left        { flex: unset !important; padding: 88px 6vw 2vh !important; }
          .hero-right       { flex: unset !important; padding: 0 6vw 8vh !important; justify-content: flex-start !important; }
          .grid-3           { grid-template-columns: 1fr !important; }
          .grid-2           { grid-template-columns: 1fr !important; }
          .stats-bar        { grid-template-columns: 1fr 1fr !important; }
          .nav-links        { display: none !important; }
          .nav-hamburger    { display: flex !important; }
          /* on mobile every card in a 3-col grid gets a bottom border, no right border */
          .grid-3 > div { border-right: none !important; border-bottom: 1px solid ${RULE} !important; }
        }
        @media (max-width: 480px) {
          .stats-bar        { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── NAV ────────────────────────────────────────────────────────── */}
      <nav aria-label="Main navigation" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, background: navSolid || mobileMenu ? "rgba(10,10,10,0.97)" : "transparent", borderBottom: `1px solid ${navSolid || mobileMenu ? RULE : "transparent"}`, backdropFilter: navSolid ? "blur(24px)" : "none", WebkitBackdropFilter: navSolid ? "blur(24px)" : "none", transition: "background 0.3s, border-color 0.3s" }}>
        <div style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 5vw" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
            <Cross size={10} opacity={0.75} />
            <span style={{ fontFamily: DECO, fontWeight: 700, fontSize: "0.68rem", letterSpacing: "0.2em", textTransform: "uppercase", color: INK }}>Alessa</span>
          </div>

          {/* desktop links */}
          <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: "2.2rem" }}>
            <NavBtn onClick={() => scrollTo("features")}>Features</NavBtn>
            <NavBtn onClick={() => scrollTo("compare")}>Compare</NavBtn>
            <NavBtn onClick={() => scrollTo("commands")}>Commands</NavBtn>
            <Btn href={inviteUrl} variant="solid">Add to Discord</Btn>
          </div>

          {/* mobile hamburger — hidden on desktop via CSS */}
          <button type="button" aria-label={mobileMenu ? "Close menu" : "Open menu"} aria-expanded={mobileMenu}
            className="nav-hamburger"
            onClick={() => setMobileMenu(o => !o)}
            style={{ display: "none", flexDirection: "column", gap: 5, padding: 8, background: "none", border: "none", cursor: "pointer" }}>
            {[0, 1, 2].map(i => (
              <span key={i} style={{ display: "block", width: 22, height: 1.5, background: INK, transformOrigin: "center", transition: "transform 0.2s, opacity 0.2s",
                transform: mobileMenu ? (i === 0 ? "translateY(6.5px) rotate(45deg)" : i === 2 ? "translateY(-6.5px) rotate(-45deg)" : "scaleX(0)") : "none",
                opacity: mobileMenu && i === 1 ? 0 : 1,
              }} />
            ))}
          </button>
        </div>

        {/* mobile dropdown menu */}
        {mobileMenu && (
          <div style={{ borderTop: `1px solid ${RULE}`, padding: "1.2rem 5vw 1.5rem", display: "flex", flexDirection: "column", gap: "1.2rem" }}>
            <NavBtn onClick={() => scrollTo("features")}>Features</NavBtn>
            <NavBtn onClick={() => scrollTo("compare")}>Compare</NavBtn>
            <NavBtn onClick={() => scrollTo("commands")}>Commands</NavBtn>
            <div style={{ paddingTop: "0.4rem" }}>
              <Btn href={inviteUrl} variant="solid">Add to Discord</Btn>
            </div>
          </div>
        )}
      </nav>

      {/* ── HERO ───────────────────────────────────────────────────────── */}
      <section onMouseMove={onMouseMove} onMouseLeave={onMouseLeave}
        style={{ minHeight: "100vh", display: "flex", position: "relative", overflow: "hidden", paddingTop: 56 }}
        className="hero-split">
        {/* bg glow */}
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 70% 50% at 50% 110%,${CRIMSON_DIM},transparent 70%)`, pointerEvents: "none", zIndex: 1 }} />
        <div aria-hidden="true" style={{ position: "absolute", top: 56, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${CRIMSON_MID},transparent)`, zIndex: 5 }} />

        {/* left */}
        <div className="hero-left" style={{ flex: "0 0 50%", display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: "7vw", paddingBottom: "6vh", zIndex: 2, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "2rem", animation: "alessa-fade-up 0.8s ease both" }}>
            <div aria-hidden="true" style={{ width: 28, height: 1, background: CRIMSON_MID }} />
            <Cross size={9} opacity={0.8} />
            <span style={{ fontFamily: SERIF, fontSize: "0.46rem", letterSpacing: "0.5em", textTransform: "uppercase", color: "rgba(196,30,58,0.72)" }}>Discord Music Bot</span>
            <Cross size={9} opacity={0.8} />
            <div aria-hidden="true" style={{ width: 28, height: 1, background: CRIMSON_MID }} />
          </div>

          <h1 style={{ fontFamily: DECO, fontWeight: 900, fontSize: "clamp(3.8rem,7vw,7rem)", letterSpacing: "0.03em", color: INK, margin: "0 0 0.04em", lineHeight: 0.9, textTransform: "uppercase", animation: "alessa-fade-up 0.8s 0.1s ease both" }}>
            Alessa
          </h1>
          <div aria-hidden="true" style={{ width: "clamp(80px,11vw,180px)", height: 1, background: `linear-gradient(90deg,${CRIMSON},transparent)`, margin: "1.6rem 0", animation: "alessa-fade-up 0.8s 0.18s ease both" }} />

          <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontWeight: 300, fontSize: "clamp(1rem,1.5vw,1.22rem)", color: DIM, lineHeight: 1.85, maxWidth: 360, margin: "0 0 0.9rem", animation: "alessa-fade-up 0.8s 0.24s ease both" }}>
            Every feature premium bots charge for.<br />All of it, free, forever.
          </p>
          <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.95rem", color: DIM2, lineHeight: 1.72, maxWidth: 350, margin: "0 0 2.5rem", animation: "alessa-fade-up 0.8s 0.28s ease both" }}>
            Spotify import, 24/7 mode, web dashboard, 15-band EQ, saved playlists, AI rave sessions — no subscription, no tiers.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "1.4rem", flexWrap: "wrap", marginBottom: "2.4rem", animation: "alessa-fade-up 0.8s 0.32s ease both" }}>
            <Btn href={inviteUrl} variant="solid" size="lg">Add to Discord</Btn>
            <button type="button" onClick={() => scrollTo("features")}
              style={{ fontFamily: SERIF, fontSize: "0.58rem", letterSpacing: "0.2em", textTransform: "uppercase", color: DIM, background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              Explore features
              <svg aria-hidden="true" width="9" height="13" viewBox="0 0 9 13" fill="none"><path d="M4.5 0v10M1 7.5l3.5 4.5 3.5-4.5" stroke={DIM} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "1.4rem", flexWrap: "wrap", animation: "alessa-fade-up 0.8s 0.38s ease both" }}>
            {(["Free forever", "No account needed", "Invite in seconds"] as const).map(txt => (
              <div key={txt} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span aria-hidden="true" style={{ color: CRIMSON, fontSize: "0.7rem" }}>✓</span>
                <span style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.82rem", color: "rgba(245,240,236,0.3)" }}>{txt}</span>
              </div>
            ))}
          </div>
        </div>

        {/* right — cross (purely decorative) + now-playing card */}
        <div className="hero-right" style={{ flex: "0 0 50%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div aria-hidden="true" style={{ position: "absolute", left: "8%", top: "50%", transform: "translateY(-50%)", animation: "alessa-float 7s ease-in-out infinite", zIndex: 1, pointerEvents: "none" }}>
            <img ref={crossRef} src="/chrome-hearts-cross.svg" alt=""
              style={{ width: "clamp(140px,16vw,240px)", height: "auto", display: "block", userSelect: "none", pointerEvents: "none", willChange: "transform", filter: "invert(1) sepia(1) saturate(4) hue-rotate(295deg) brightness(0.72) drop-shadow(0 0 44px rgba(196,30,58,0.52)) drop-shadow(0 12px 36px rgba(0,0,0,0.98))", opacity: 0.5 }} />
          </div>
          <div ref={cardRef} style={{ position: "relative", zIndex: 2, willChange: "transform", animation: "alessa-fade-up 1s 0.4s ease both" }}>
            <NowPlayingCard />
          </div>
        </div>

        {/* scroll hint */}
        <div aria-hidden="true" style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 5 }}>
          <div style={{ width: 1, height: 34, background: `linear-gradient(to bottom,${CRIMSON_MID},transparent)` }} />
          <Cross size={7} opacity={0.25} />
        </div>
      </section>

      {/* ── TICKER ─────────────────────────────────────────────────────── */}
      <Marquee />

      {/* ── STATS BAR ──────────────────────────────────────────────────── */}
      <section aria-label="Key stats" className="stats-bar" style={{ borderBottom: `1px solid ${RULE}`, display: "grid", gridTemplateColumns: "repeat(4,1fr)" }}>
        {([
          { n: "100%",  label: "Free, forever"       },
          { n: "0",     label: "Paywalled features"   },
          { n: "30+",   label: "Slash commands"       },
          { n: "∞",     label: "Queue length"         },
        ] as const).map(({ n, label }, i) => (
          <div key={label} style={{ padding: "2.4rem 2rem", borderRight: i < 3 ? `1px solid ${RULE}` : "none", textAlign: "center" }}>
            <div style={{ fontFamily: DECO, fontWeight: 900, fontSize: "clamp(2rem,4vw,3.4rem)", color: CRIMSON, lineHeight: 1, marginBottom: "0.5rem", letterSpacing: "0.04em" }}>{n}</div>
            <div style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.9rem", color: DIM2 }}>{label}</div>
          </div>
        ))}
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────────────── */}
      <section style={{ padding: "7vh 7vw 6vh", borderBottom: `1px solid ${RULE}`, position: "relative" }}>
        <div aria-hidden="true" style={{ position: "absolute", top: 40, right: "7vw", opacity: 0.18, display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <Cross size={8} /><div style={{ width: 52, height: 1, background: CRIMSON }} /><Cross size={8} />
        </div>
        <SectionLabel>Getting Started</SectionLabel>
        <SectionTitle>Three steps, then music.</SectionTitle>
        <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "1rem", color: DIM, maxWidth: 440, lineHeight: 1.75, margin: "0 0 4rem" }}>
          No configuration required. But if you want it, it's all there.
        </p>
        <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", border: `1px solid ${RULE}` }}>
          {STEPS.map((step, i) => (
            <div key={step.n} style={{ padding: "2.6rem 2.2rem", borderRight: i < 2 ? `1px solid ${RULE}` : "none", position: "relative" }}>
              <div aria-hidden="true" style={{ fontFamily: DECO, fontWeight: 900, fontSize: "3.2rem", color: "rgba(196,30,58,0.1)", lineHeight: 1, position: "absolute", top: "1.2rem", right: "1.6rem", letterSpacing: "0.04em", userSelect: "none" }}>{step.n}</div>
              <div style={{ fontFamily: SERIF, fontSize: "0.42rem", letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(196,30,58,0.6)", marginBottom: "1rem" }}>{step.n}</div>
              <h3 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "0.82rem", letterSpacing: "0.1em", textTransform: "uppercase", color: INK, margin: "0 0 0.75rem" }}>{step.title}</h3>
              <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.96rem", lineHeight: 1.8, color: DIM, margin: 0 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────────────── */}
      <section id="features" style={{ borderBottom: `1px solid ${RULE}` }}>
        <div style={{ padding: "7vh 7vw 4vh" }}>
          <SectionLabel>What She Does</SectionLabel>
          <SectionTitle>Features</SectionTitle>
          <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "1rem", color: DIM, maxWidth: 480, lineHeight: 1.75, margin: 0 }}>
            Everything you'd want. Nothing gated behind a subscription.
          </p>
        </div>
        <div className="grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderTop: `1px solid ${RULE}` }}>
          {FEATURES.map((f, i) => <FeatureCard key={f.title} {...f} index={i} />)}
        </div>
      </section>

      {/* ── COMPARISON ─────────────────────────────────────────────────── */}
      <section id="compare" style={{ padding: "7vh 7vw", borderBottom: `1px solid ${RULE}` }}>
        <SectionLabel>How We Compare</SectionLabel>
        <SectionTitle>Free vs. Paid</SectionTitle>
        <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "1rem", color: DIM, maxWidth: 520, lineHeight: 1.75, margin: "0 0 3.5rem" }}>
          Every feature below is locked behind a subscription on competing bots. Alessa ships all of it free.
        </p>
        <div style={{ border: `1px solid ${RULE}`, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${RULE}` }}>
                <th scope="col" style={{ padding: "1rem 1.2rem", textAlign: "left", fontFamily: SERIF, fontSize: "0.46rem", letterSpacing: "0.28em", textTransform: "uppercase", color: DIM2, fontWeight: 400, borderRight: `1px solid ${RULE}` }}>Feature</th>
                {([["Alessa", true], ["Hydra", false], ["Jockie", false], ["MEE6 Music", false]] as const).map(([name, isAlessa]) => (
                  <th scope="col" key={name} style={{ padding: "1rem 1.2rem", textAlign: "center", fontFamily: SERIF, fontSize: "0.46rem", letterSpacing: "0.24em", textTransform: "uppercase", fontWeight: isAlessa ? 700 : 400, color: isAlessa ? CRIMSON : DIM2, borderRight: `1px solid ${RULE}`, background: isAlessa ? CRIMSON_DIM2 : "transparent" }}>
                    {name}
                    {isAlessa && <div style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.7rem", color: "rgba(196,30,58,0.6)", fontWeight: 300, textTransform: "none", letterSpacing: 0, marginTop: 2 }}>free</div>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_FEATURES.map(row => (
                <tr key={row.label}>
                  <td style={{ padding: "0.85rem 1.2rem", fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.92rem", color: DIM, borderRight: `1px solid ${RULE}`, borderBottom: `1px solid ${RULE}` }}>{row.label}</td>
                  <CompareCell val={row.alessa} isAlessa={true}  />
                  <CompareCell val={row.hydra}  isAlessa={false} />
                  <CompareCell val={row.jockie} isAlessa={false} />
                  <CompareCell val={row.mee6}   isAlessa={false} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── COMMANDS ───────────────────────────────────────────────────── */}
      <section id="commands" style={{ padding: "7vh 7vw 6vh", borderBottom: `1px solid ${RULE}` }}>
        <SectionLabel>Slash Commands</SectionLabel>
        <SectionTitle>Commands</SectionTitle>
        <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "1rem", color: DIM, maxWidth: 480, lineHeight: 1.75, margin: "0 0 3rem" }}>
          Type <code style={{ fontFamily: MONO, fontSize: "0.85rem", color: CRIMSON, background: "none" }}>/</code> in Discord and they all appear. No prefix, no DM required.
        </p>
        <div className="grid-2" style={{ border: `1px solid ${RULE}`, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {[CMDS_A, CMDS_B].map((list, li) => (
            <div key={li} style={{ borderRight: li === 0 ? `1px solid ${RULE}` : "none" }}>
              {list.map(c => (
                <div key={c.n} style={{ padding: "0.8rem 1.2rem", borderBottom: `1px solid ${RULE}`, display: "flex", alignItems: "baseline", gap: "0.7rem" }}>
                  <code style={{ fontFamily: MONO, fontSize: "0.68rem", color: CRIMSON, flexShrink: 0, letterSpacing: "0.01em" }}>{c.n}</code>
                  <span style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.88rem", color: DIM, lineHeight: 1.3 }}>{c.d}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ─────────────────────────────────────────────────── */}
      <section style={{ padding: "9vh 7vw", position: "relative", overflow: "hidden", borderBottom: `1px solid ${RULE}`, textAlign: "center" }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 60% at 50% 50%, rgba(196,30,58,0.09) 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div aria-hidden="true" style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${CRIMSON_MID},transparent)` }} />
        <div aria-hidden="true" style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${CRIMSON_MID},transparent)` }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.7rem", marginBottom: "1.8rem" }}>
            <div style={{ width: 40, height: 1, background: CRIMSON_MID }} />
            <Cross size={10} opacity={0.7} />
            <div style={{ width: 40, height: 1, background: CRIMSON_MID }} />
          </div>
          <h2 style={{ fontFamily: DECO, fontWeight: 900, fontSize: "clamp(2.2rem,5vw,4.2rem)", letterSpacing: "0.04em", textTransform: "uppercase", color: INK, margin: "0 0 1.2rem", lineHeight: 1 }}>
            Your server deserves better.
          </h2>
          <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "clamp(1rem,1.4vw,1.18rem)", color: DIM, maxWidth: 480, lineHeight: 1.85, margin: "0 auto 2.8rem" }}>
            Stop paying $5/month for features that should be free. Add Alessa and cancel your subscription today.
          </p>
          <Btn href={inviteUrl} variant="solid" size="lg">Add Alessa — It's Free</Btn>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <footer style={{ padding: "2.2rem 7vw", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <Cross size={8} opacity={0.35} />
          <span style={{ fontFamily: DECO, fontWeight: 700, fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,236,0.3)" }}>Alessa</span>
        </div>
        <nav aria-label="Footer navigation" style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
          <Link href="/servers" style={{ fontFamily: SERIF, fontSize: "0.5rem", letterSpacing: "0.18em", textTransform: "uppercase", color: DIM2, textDecoration: "none" }}>Dashboard</Link>
          <Link href="/privacy" style={{ fontFamily: SERIF, fontSize: "0.5rem", letterSpacing: "0.18em", textTransform: "uppercase", color: DIM2, textDecoration: "none" }}>Privacy</Link>
          <Link href="/terms"   style={{ fontFamily: SERIF, fontSize: "0.5rem", letterSpacing: "0.18em", textTransform: "uppercase", color: DIM2, textDecoration: "none" }}>Terms</Link>
          <a href={inviteUrl}   style={{ fontFamily: SERIF, fontSize: "0.5rem", letterSpacing: "0.18em", textTransform: "uppercase", color: CRIMSON, textDecoration: "none" }}>Invite</a>
        </nav>
        <span style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.8rem", color: "rgba(245,240,236,0.16)" }}>© 2026 Alessa</span>
      </footer>
    </div>
  );
}
