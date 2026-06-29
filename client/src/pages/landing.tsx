import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "wouter";

// ── palette ────────────────────────────────────────────────────────────────
const VOID        = "#0c0c0c";
const INK         = "#f5f0ec";
const DIM         = "rgba(245,240,236,0.45)";
const GHOST       = "rgba(245,240,236,0.02)";
const RULE        = "rgba(245,240,236,0.09)";
const CRIMSON     = "#c41e3a";
const CRIMSON_MID = "rgba(196,30,58,0.55)";
const CRIMSON_DIM = "rgba(196,30,58,0.13)";

const LACE: React.CSSProperties = {
  backgroundImage: `linear-gradient(rgba(12,12,12,0.94),rgba(12,12,12,0.94)),url('/lace-texture.webp')`,
  backgroundSize: "auto,420px auto",
  backgroundRepeat: "repeat",
  backgroundColor: VOID,
};

const SERIF   = "'Cinzel',serif";
const DECO    = "'Cinzel Decorative',serif";
const CURSIVE = "'Cormorant Garamond',serif";
const MONO    = "'Fira Code','JetBrains Mono',monospace";

// ── data ───────────────────────────────────────────────────────────────────
const FEATURES = [
  { title: "Stream Anything",      desc: "YouTube, SoundCloud, and Spotify. Search by name or paste a link — direct URL or search query, Alessa finds it and queues it." },
  { title: "Full Queue Control",   desc: "Add, remove, shuffle, and reorder. Loop a single song or the whole queue. Vote-skip when 3+ people are listening." },
  { title: "Rave Mode",            desc: "Infinite genre sessions with AI DJ commentary between tracks. Set a vibe, pick a genre, and walk away." },
  { title: "Jukebox Vote Queue",   desc: "Search 3 options, your server votes, the winner plays. Everyone gets a say. No shouting in chat required." },
  { title: "Sleep Timer & EQ",     desc: "Auto-stop after N minutes. Fine-tune EQ across 15 bands. Crossfade between tracks for a seamless listening experience." },
  { title: "Listening Stats",      desc: "Per-server and global play counts, top track leaderboards, and unique track totals — all powered by the /stats command." },
];

const PREMIUM = [
  { title: "Spotify Import",        desc: "Paste a Spotify playlist or album URL directly into /play. Alessa resolves every track and queues them instantly." },
  { title: "Song Request Channel",  desc: "Designate a text channel as a request board. Members type a name or URL, Alessa reacts ✅ or ❌ and queues it." },
  { title: "Saved Playlists",       desc: "Save the current queue as a named playlist. Reload any saved playlist any time with /playlist load. Per-user, per-server." },
];

const CMDS_A = [
  { n: "/play",          d: "Play a song, playlist, or Spotify URL" },
  { n: "/skip",          d: "Skip (vote-skip with 3+ listeners)" },
  { n: "/queue",         d: "Show the current queue" },
  { n: "/nowplaying",    d: "See what's currently on" },
  { n: "/volume",        d: "Set the volume (0–100)" },
  { n: "/shuffle",       d: "Shuffle the queue" },
  { n: "/loop",          d: "off → track → queue → off" },
  { n: "/autoplay",      d: "Keep playing when queue empties" },
];
const CMDS_B = [
  { n: "/sleep",         d: "Auto-stop after N minutes" },
  { n: "/eq",            d: "Set EQ band (0–14, –0.25 to 1.0)" },
  { n: "/crossfade",     d: "Blend tracks together (0–10 s)" },
  { n: "/jukebox",       d: "Vote queue — server picks the winner" },
  { n: "/stats",         d: "Listening stats for server or global" },
  { n: "/rave",          d: "Infinite DJ session by genre" },
  { n: "/savequeue",     d: "Save queue as named playlist" },
  { n: "/speak",         d: "Speak text aloud in voice channel" },
];

// ── sub-components ─────────────────────────────────────────────────────────

const Cross = ({ size = 12, color = CRIMSON, opacity = 1 }: { size?: number; color?: string; opacity?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ opacity, flexShrink: 0, display: "block" }}>
    <rect x="5" y="0" width="2" height="12" fill={color} />
    <rect x="0" y="5" width="12" height="2" fill={color} />
  </svg>
);

function NavBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ fontFamily: SERIF, fontSize: "0.56rem", letterSpacing: "0.2em", textTransform: "uppercase", color: hov ? INK : DIM, background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.18s" }}>
      {children}
    </button>
  );
}

function Btn({ href, children, variant = "outline", size = "md" }: { href: string; children: React.ReactNode; variant?: "solid" | "outline"; size?: "md" | "lg" }) {
  const [hov, setHov] = useState(false);
  return (
    <a href={href} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "inline-block", fontFamily: SERIF, fontWeight: 600, fontSize: size === "lg" ? "0.7rem" : "0.63rem", letterSpacing: "0.2em", textTransform: "uppercase", textDecoration: "none", padding: size === "lg" ? "17px 50px" : "12px 30px", border: `1.5px solid ${variant === "solid" ? CRIMSON : hov ? CRIMSON : RULE}`, background: variant === "solid" ? (hov ? "transparent" : CRIMSON) : (hov ? CRIMSON : "transparent"), color: INK, transition: "background 0.22s, border-color 0.22s", cursor: "pointer", whiteSpace: "nowrap" }}>
      {children}
    </a>
  );
}

function FeatureCard({ title, desc, index, cols = 3, total = 6 }: { title: string; desc: string; index: number; cols?: number; total?: number }) {
  const [hov, setHov] = useState(false);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const rows = Math.ceil(total / cols);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ padding: "2.3rem 2rem", borderRight: col < cols - 1 ? `1px solid ${RULE}` : "none", borderBottom: row < rows - 1 ? `1px solid ${RULE}` : "none", background: hov ? "rgba(196,30,58,0.055)" : GHOST, boxShadow: hov ? `inset 0 3px 0 0 ${CRIMSON}` : `inset 0 3px 0 0 transparent`, transition: "background 0.22s, box-shadow 0.22s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "1.15rem" }}>
        <Cross size={9} opacity={hov ? 1 : 0.6} />
        <span style={{ fontFamily: SERIF, fontSize: "0.49rem", letterSpacing: "0.42em", textTransform: "uppercase", color: hov ? CRIMSON : "rgba(196,30,58,0.58)", transition: "color 0.2s" }}>0{index + 1}</span>
      </div>
      <h3 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "0.84rem", letterSpacing: "0.12em", textTransform: "uppercase", color: INK, margin: "0 0 0.7rem" }}>{title}</h3>
      <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.97rem", lineHeight: 1.8, color: DIM, margin: 0 }}>{desc}</p>
    </div>
  );
}

function CmdList({ cmds, noBorderRight }: { cmds: { n: string; d: string }[]; noBorderRight?: boolean }) {
  return (
    <div style={{ borderRight: noBorderRight ? "none" : `1px solid ${RULE}` }}>
      {cmds.map((c) => (
        <div key={c.n} style={{ padding: "0.82rem 1.1rem", borderBottom: `1px solid ${RULE}`, display: "flex", alignItems: "baseline", gap: "0.65rem" }}>
          <span style={{ fontFamily: MONO, fontSize: "0.68rem", color: CRIMSON, flexShrink: 0, letterSpacing: "0.01em" }}>{c.n}</span>
          <span style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.88rem", color: DIM, lineHeight: 1.3 }}>{c.d}</span>
        </div>
      ))}
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [inviteUrl, setInviteUrl] = useState<string>("#");
  const [tilt, setTilt]           = useState({ x: 0, y: 0 });
  const [parallax, setParallax]   = useState({ x: 0, y: 0 });
  const [navSolid, setNavSolid]   = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const rafRef  = useRef<number | null>(null);
  const target  = useRef({ tx: 0, ty: 0, px: 0, py: 0 });
  const current = useRef({ tx: 0, ty: 0, px: 0, py: 0 });

  useEffect(() => {
    fetch("/api/public/invite-url")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.url) setInviteUrl(d.url); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const cb = () => setNavSolid(el.scrollTop > 50);
    el.addEventListener("scroll", cb);
    return () => el.removeEventListener("scroll", cb);
  }, []);

  useEffect(() => {
    const ease = 0.07;
    const tick = () => {
      const t = target.current;
      const c = current.current;
      c.tx += (t.tx - c.tx) * ease;
      c.ty += (t.ty - c.ty) * ease;
      c.px += (t.px - c.px) * ease;
      c.py += (t.py - c.py) * ease;
      setTilt({ x: c.tx, y: c.ty });
      setParallax({ x: c.px, y: c.py });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const { clientX, clientY, currentTarget } = e;
    const { width, height, left, top } = currentTarget.getBoundingClientRect();
    const nx = (clientX - left) / width - 0.5;
    const ny = (clientY - top) / height - 0.5;
    target.current = { tx: ny * 11, ty: nx * -11, px: nx * 20, py: ny * 11 };
  }, []);

  const onMouseLeave = useCallback(() => { target.current = { tx: 0, ty: 0, px: 0, py: 0 }; }, []);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div ref={wrapRef} style={{ ...LACE, fontFamily: SERIF, overflowY: "auto", overflowX: "hidden" }}>

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 5vw", background: navSolid ? "rgba(12,12,12,0.94)" : "transparent", borderBottom: `1px solid ${navSolid ? RULE : "transparent"}`, backdropFilter: navSolid ? "blur(20px)" : "none", WebkitBackdropFilter: navSolid ? "blur(20px)" : "none", transition: "background 0.3s, border-color 0.3s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <Cross size={10} opacity={0.7} />
          <span style={{ fontFamily: DECO, fontWeight: 700, fontSize: "0.68rem", letterSpacing: "0.2em", textTransform: "uppercase", color: INK }}>Alessa</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <NavBtn onClick={() => scrollTo("features")}>Features</NavBtn>
          <NavBtn onClick={() => scrollTo("commands")}>Commands</NavBtn>
          <Link href="/privacy" style={{ fontFamily: SERIF, fontSize: "0.56rem", letterSpacing: "0.2em", textTransform: "uppercase", color: DIM, textDecoration: "none" }}>Privacy</Link>
          <Link href="/terms" style={{ fontFamily: SERIF, fontSize: "0.56rem", letterSpacing: "0.2em", textTransform: "uppercase", color: DIM, textDecoration: "none" }}>Terms</Link>
          <Btn href={inviteUrl} variant="solid">Add to Discord</Btn>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section onMouseMove={onMouseMove} onMouseLeave={onMouseLeave} style={{ height: "100vh", display: "flex", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: `linear-gradient(90deg,transparent,${CRIMSON_MID},transparent)`, zIndex: 5 }} />
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(ellipse 80% 45% at 50% 115%,${CRIMSON_DIM},transparent 72%)`, pointerEvents: "none", zIndex: 1 }} />

        {/* LEFT */}
        <div style={{ flex: "0 0 50%", display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: "7vw", paddingTop: 56, zIndex: 2, position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "2rem", animation: "alessa-fade-up 0.8s ease both" }}>
            <div style={{ width: 26, height: 1, background: CRIMSON_MID }} />
            <Cross size={9} opacity={0.8} />
            <span style={{ fontFamily: SERIF, fontSize: "0.49rem", letterSpacing: "0.52em", textTransform: "uppercase", color: "rgba(196,30,58,0.72)" }}>Discord Music Bot</span>
            <Cross size={9} opacity={0.8} />
            <div style={{ width: 26, height: 1, background: CRIMSON_MID }} />
          </div>

          <h1 style={{ fontFamily: DECO, fontWeight: 900, fontSize: "clamp(3.8rem,7.2vw,7.2rem)", letterSpacing: "0.03em", color: INK, margin: "0 0 0.04em", lineHeight: 0.92, textTransform: "uppercase", animation: "alessa-fade-up 0.8s 0.1s ease both" }}>
            Alessa
          </h1>

          <div style={{ width: "clamp(90px,12vw,200px)", height: 1, background: `linear-gradient(90deg,${CRIMSON},transparent)`, margin: "1.5rem 0", animation: "alessa-fade-up 0.8s 0.18s ease both" }} />

          <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontWeight: 300, fontSize: "clamp(1rem,1.55vw,1.22rem)", color: DIM, lineHeight: 1.82, maxWidth: 360, margin: "0 0 2.6rem", animation: "alessa-fade-up 0.8s 0.24s ease both" }}>
            Plays what you want and stays out of your way.
            <br />No opinions. No memory. No lectures.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: "1.4rem", flexWrap: "wrap", marginBottom: "2.3rem", animation: "alessa-fade-up 0.8s 0.3s ease both" }}>
            <Btn href={inviteUrl} variant="solid">Add to Discord</Btn>
            <button onClick={() => scrollTo("features")} style={{ fontFamily: SERIF, fontSize: "0.58rem", letterSpacing: "0.2em", textTransform: "uppercase", color: DIM, background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
              See features
              <svg width="9" height="13" viewBox="0 0 9 13" fill="none"><path d="M4.5 0v10M1 7.5l3.5 4.5 3.5-4.5" stroke={DIM} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", animation: "alessa-fade-up 0.8s 0.36s ease both" }}>
            <Cross size={7} opacity={0.3} />
            <span style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.8rem", color: "rgba(245,240,236,0.25)", letterSpacing: "0.04em" }}>
              free &nbsp;·&nbsp; no account needed &nbsp;·&nbsp; invite in seconds
            </span>
            <Cross size={7} opacity={0.3} />
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ flex: "0 0 50%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{ position: "absolute", width: "64%", paddingBottom: "64%", borderRadius: "50%", background: `radial-gradient(circle,transparent 28%,${CRIMSON_DIM} 56%,transparent 78%)`, animation: "alessa-pulse 4.5s ease-in-out infinite", pointerEvents: "none" }} />
          <div style={{ position: "absolute", width: "36%", paddingBottom: "36%", borderRadius: "50%", background: `radial-gradient(circle,rgba(196,30,58,0.18) 0%,transparent 70%)`, pointerEvents: "none" }} />
          <div style={{ transform: `translate(${parallax.x * 0.35}px,${parallax.y * 0.35}px)`, willChange: "transform", animation: "alessa-fade-up 1s 0.15s ease both" }}>
            <div style={{ animation: "alessa-float 7s ease-in-out infinite" }}>
              <img src="/chrome-hearts-cross.svg" alt="" draggable={false} style={{ width: "clamp(240px,36vw,530px)", height: "auto", display: "block", userSelect: "none", pointerEvents: "none", transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, willChange: "transform", filter: "invert(1) sepia(1) saturate(4) hue-rotate(295deg) brightness(0.82) drop-shadow(0 0 64px rgba(196,30,58,0.62)) drop-shadow(0 14px 52px rgba(0,0,0,0.96))" }} />
            </div>
          </div>
        </div>

        {/* scroll hint */}
        <div style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, zIndex: 5 }}>
          <div style={{ width: 1, height: 34, background: `linear-gradient(to bottom,${CRIMSON_MID},transparent)` }} />
          <Cross size={7} opacity={0.28} />
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────────── */}
      <section id="features" style={{ borderTop: `1px solid ${RULE}`, position: "relative" }}>
        <div style={{ padding: "6vh 7vw 3vh", position: "relative" }}>
          <div style={{ position: "absolute", top: 36, right: "7vw", display: "flex", alignItems: "center", gap: "0.5rem", opacity: 0.22 }}>
            <Cross size={8} /><div style={{ width: 56, height: 1, background: CRIMSON }} /><Cross size={8} />
          </div>
          <div style={{ marginBottom: "3.8rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
              <Cross size={8} opacity={0.5} />
              <span style={{ fontFamily: SERIF, fontSize: "0.44rem", letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(196,30,58,0.65)" }}>What She Does</span>
            </div>
            <h2 style={{ fontFamily: DECO, fontWeight: 900, fontSize: "clamp(1.8rem,3.5vw,2.9rem)", letterSpacing: "0.04em", textTransform: "uppercase", color: INK, margin: "0 0 0.8rem", lineHeight: 1 }}>
              Features
            </h2>
            <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "1rem", color: DIM, maxWidth: 480, lineHeight: 1.75, margin: 0 }}>
              Everything you'd want from a music bot. Nothing you wouldn't.
            </p>
          </div>
        </div>

        {/* 3×2 feature grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderTop: `1px solid ${RULE}` }}>
          {FEATURES.map((f, i) => <FeatureCard key={f.title} {...f} index={i} cols={3} total={FEATURES.length} />)}
        </div>

        {/* Premium section */}
        <div style={{ padding: "5vh 7vw 3vh", borderTop: `1px solid ${RULE}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
            <Cross size={8} opacity={0.5} />
            <span style={{ fontFamily: SERIF, fontSize: "0.44rem", letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(196,30,58,0.65)" }}>Premium — Free</span>
          </div>
          <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "1rem", color: DIM, maxWidth: 480, lineHeight: 1.75, margin: "0 0 3rem" }}>
            Features most bots charge for. All free. Always.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderTop: `1px solid ${RULE}` }}>
          {PREMIUM.map((f, i) => <FeatureCard key={f.title} {...f} index={i} cols={3} total={PREMIUM.length} />)}
        </div>
      </section>

      {/* ── COMMANDS ─────────────────────────────────────────────────────── */}
      <section id="commands" style={{ borderTop: `1px solid ${RULE}`, padding: "6vh 7vw" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
          <Cross size={8} opacity={0.5} />
          <span style={{ fontFamily: SERIF, fontSize: "0.44rem", letterSpacing: "0.38em", textTransform: "uppercase", color: "rgba(196,30,58,0.65)" }}>Slash Commands</span>
        </div>
        <h2 style={{ fontFamily: DECO, fontWeight: 900, fontSize: "clamp(1.8rem,3.5vw,2.9rem)", letterSpacing: "0.04em", textTransform: "uppercase", color: INK, margin: "0 0 0.8rem", lineHeight: 1 }}>Commands</h2>
        <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "1rem", color: DIM, maxWidth: 480, lineHeight: 1.75, margin: "0 0 3rem" }}>
          Every command is a Discord slash command — type / and they appear.
        </p>

        <div style={{ border: `1px solid ${RULE}`, display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          <CmdList cmds={CMDS_A} />
          <CmdList cmds={CMDS_B} noBorderRight />
        </div>

        <div style={{ marginTop: "3.5rem", display: "flex", justifyContent: "center" }}>
          <Btn href={inviteUrl} size="lg">Add Alessa to Your Server</Btn>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{ borderTop: `1px solid ${RULE}`, padding: "2rem 7vw", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <Cross size={8} opacity={0.4} />
          <span style={{ fontFamily: DECO, fontWeight: 700, fontSize: "0.62rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,236,0.35)" }}>Alessa</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap" }}>
          <Link href="/privacy" style={{ fontFamily: SERIF, fontSize: "0.5rem", letterSpacing: "0.18em", textTransform: "uppercase", color: DIM, textDecoration: "none" }}>Privacy Policy</Link>
          <Link href="/terms" style={{ fontFamily: SERIF, fontSize: "0.5rem", letterSpacing: "0.18em", textTransform: "uppercase", color: DIM, textDecoration: "none" }}>Terms of Service</Link>
          <a href={inviteUrl} style={{ fontFamily: SERIF, fontSize: "0.5rem", letterSpacing: "0.18em", textTransform: "uppercase", color: CRIMSON, textDecoration: "none" }}>Invite</a>
        </div>
        <span style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.8rem", color: "rgba(245,240,236,0.18)" }}>
          © 2026 Alessa
        </span>
      </footer>

      {/* ── GLOBAL STYLES ────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Cinzel+Decorative:wght@700;900&family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300;1,400&family=Fira+Code:wght@400;500&display=swap');
        @keyframes alessa-fade-up {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes alessa-pulse {
          0%,100% { transform:scale(1);   opacity:0.7; }
          50%      { transform:scale(1.08); opacity:1;   }
        }
        @keyframes alessa-float {
          0%,100% { transform:translateY(0); }
          50%      { transform:translateY(-18px); }
        }
        *,*::before,*::after { box-sizing:border-box; }
        body { margin:0; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:${VOID}; }
        ::-webkit-scrollbar-thumb { background:rgba(196,30,58,0.35); border-radius:2px; }
      `}</style>
    </div>
  );
}
