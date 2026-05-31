import { useEffect, useState } from "react";

const BL = "'UnifrakturMaguntia', serif";
const SERIF = "'Cormorant Garamond', serif";

const FISHNET: React.CSSProperties = {
  backgroundImage: `
    repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.055) 5px, rgba(255,255,255,0.055) 6px),
    repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(255,255,255,0.055) 5px, rgba(255,255,255,0.055) 6px)
  `,
};

const CrossSVG = ({ size = 80, opacity = 1 }: { size?: number; opacity?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" style={{ opacity }}>
    {/* Vertical arm */}
    <rect x="41" y="8" width="18" height="84" fill="white" />
    {/* Horizontal arm */}
    <rect x="8" y="38" width="84" height="18" fill="white" />
    {/* Flare caps — top */}
    <polygon points="50,2 44,14 56,14" fill="white" />
    {/* Flare caps — bottom */}
    <polygon points="50,98 44,86 56,86" fill="white" />
    {/* Flare caps — left */}
    <polygon points="2,50 14,44 14,56" fill="white" />
    {/* Flare caps — right */}
    <polygon points="98,50 86,44 86,56" fill="white" />
  </svg>
);

const HeartSVG = ({ size = 20, opacity = 1 }: { size?: number; opacity?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 90" fill="white" style={{ opacity }}>
    <path d="M50 85 C50 85 5 52 5 28 C5 14 16 5 28 5 C38 5 46 11 50 18 C54 11 62 5 72 5 C84 5 95 14 95 28 C95 52 50 85 50 85Z" />
  </svg>
);

const FEATURES = [
  { icon: "✝", title: "Stream anything",    desc: "YouTube, SoundCloud, Spotify links or search queries. Alfie finds it." },
  { icon: "✝", title: "Queue control",       desc: "Add, remove, move, shuffle, loop. Full control without stopping playback." },
  { icon: "✝", title: "Now playing",         desc: "Live progress bar with album art and track info. Always know what's on." },
  { icon: "✝", title: "Vote skip",           desc: "Majority vote when 3+ in voice, instant if fewer. Fair by design." },
  { icon: "✝", title: "Rave mode",           desc: "Genre sessions with automatic discovery and crossfade. Set it and go." },
  { icon: "✝", title: "Saved playlists",     desc: "Save your queue and reload it whenever you want." },
];

export default function LandingPage() {
  const [inviteUrl, setInviteUrl] = useState("/api/oauth/discord");

  useEffect(() => {
    fetch("/api/public/invite-url")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.url) setInviteUrl(d.url); })
      .catch(() => {});
  }, []);

  const goInvite = () => { window.location.href = inviteUrl; };

  return (
    <div style={{ background: "#000", color: "#fff", minHeight: "100vh", fontFamily: SERIF, position: "relative", overflowX: "hidden" }}>

      {/* Fishnet overlay */}
      <div className="fixed inset-0 pointer-events-none" style={{ ...FISHNET, zIndex: 0 }} />

      {/* ─── Nav ──────────────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        background: "rgba(0,0,0,0.9)",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
        backdropFilter: "blur(10px)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: BL, fontSize: "1.4rem", letterSpacing: "0.05em", lineHeight: 1 }}>
            Alfie
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <HeartSVG size={14} opacity={0.4} />
            <button onClick={goInvite} style={{
              fontFamily: SERIF, fontWeight: 700, fontSize: "0.7rem",
              letterSpacing: "0.2em", textTransform: "uppercase",
              background: "transparent", color: "rgba(255,255,255,0.7)",
              border: "1px solid rgba(255,255,255,0.25)", padding: "6px 16px",
              cursor: "pointer", transition: "all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#000"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
            >
              Add to Discord
            </button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─────────────────────────────────────────── */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", zIndex: 1 }}>

        {/* Background cross watermark */}
        <div style={{
          position: "absolute", right: "-80px", top: "50%", transform: "translateY(-50%)",
          pointerEvents: "none", userSelect: "none",
        }}>
          <CrossSVG size={520} opacity={0.04} />
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "6rem 1.5rem 4rem", width: "100%" }}>

          {/* Eyebrow */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "2rem" }}>
            <HeartSVG size={13} opacity={0.5} />
            <span style={{ fontFamily: SERIF, fontSize: "0.65rem", letterSpacing: "0.4em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>
              Discord Music Bot
            </span>
            <HeartSVG size={13} opacity={0.5} />
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: BL,
            fontSize: "clamp(5rem, 14vw, 11rem)",
            lineHeight: 0.9,
            color: "#fff",
            marginBottom: "0.15em",
            textShadow: "0 0 60px rgba(255,255,255,0.08)",
            letterSpacing: "0.02em",
          }}>
            Alfie
          </h1>

          {/* Chrome Hearts rule */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.5rem 0 2rem" }}>
            <div style={{ width: 40, height: 1, background: "rgba(255,255,255,0.2)" }} />
            <CrossSVG size={18} opacity={0.6} />
            <div style={{ flex: 1, maxWidth: 320, height: 1, background: "rgba(255,255,255,0.2)" }} />
          </div>

          {/* Tagline */}
          <p style={{
            fontFamily: SERIF, fontStyle: "italic",
            fontSize: "clamp(1rem, 2.2vw, 1.25rem)",
            lineHeight: 1.8, color: "rgba(255,255,255,0.42)",
            maxWidth: 480, marginBottom: "3rem",
          }}>
            A music bot that plays what you want and stays out of your way.
            No opinions. No memory. No lectures.
          </p>

          {/* CTA row */}
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
            <button onClick={goInvite} style={{
              fontFamily: SERIF, fontWeight: 700,
              fontSize: "0.8rem", letterSpacing: "0.22em", textTransform: "uppercase",
              background: "#fff", color: "#000",
              border: "none", padding: "14px 40px",
              cursor: "pointer", transition: "all 0.2s",
              boxShadow: "0 0 30px rgba(255,255,255,0.12)",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "#e8e8e8"; e.currentTarget.style.boxShadow = "0 0 50px rgba(255,255,255,0.2)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.boxShadow = "0 0 30px rgba(255,255,255,0.12)"; }}
            >
              Add Alfie to your server
            </button>
            <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.8rem", color: "rgba(255,255,255,0.22)", letterSpacing: "0.06em" }}>
              ✝ &nbsp;free &nbsp;·&nbsp; no account needed&nbsp; ✝
            </span>
          </div>
        </div>
      </section>

      {/* ─── Divider ──────────────────────────────────────── */}
      <div style={{ zIndex: 1, position: "relative", display: "flex", alignItems: "center", gap: "1.25rem", padding: "0 1.5rem" }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
        <CrossSVG size={16} opacity={0.3} />
        <HeartSVG size={14} opacity={0.25} />
        <CrossSVG size={16} opacity={0.3} />
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
      </div>

      {/* ─── Features ─────────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          {/* Section label */}
          <p style={{
            fontFamily: SERIF, fontSize: "0.6rem", letterSpacing: "0.45em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.25)",
            marginBottom: "3rem", textAlign: "center",
          }}>
            ✝ &nbsp; Commands &nbsp; ✝
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1px", background: "rgba(255,255,255,0.08)" }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} style={{
                background: "#000",
                padding: "2rem 1.75rem",
                position: "relative",
                ...FISHNET,
              }}>
                {/* Corner crosses */}
                <div style={{ position: "absolute", top: 10, right: 10, opacity: 0.15 }}>
                  <CrossSVG size={14} />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                  <HeartSVG size={12} opacity={0.5} />
                  <span style={{ fontFamily: SERIF, fontSize: "0.6rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>
                    0{i + 1}
                  </span>
                </div>
                <h3 style={{ fontFamily: BL, fontSize: "1.5rem", color: "#fff", marginBottom: "0.6rem", letterSpacing: "0.02em", lineHeight: 1.1 }}>
                  {f.title}
                </h3>
                <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.92rem", lineHeight: 1.75, color: "rgba(255,255,255,0.38)" }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Inverted CTA strip ───────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, background: "#fff", color: "#000", padding: "5rem 1.5rem", textAlign: "center", ...FISHNET }}>
        {/* Fishnet on white — use dark lines */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `
            repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 6px),
            repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0,0,0,0.04) 5px, rgba(0,0,0,0.04) 6px)
          `,
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginBottom: "1.5rem" }}>
            <CrossSVG size={24} opacity={0.2} />
            <HeartSVG size={22} opacity={0.18} />
            <CrossSVG size={24} opacity={0.2} />
          </div>
          {/* Recolour SVGs to black in the white section */}
          <style>{`.dark-svg svg rect, .dark-svg svg polygon, .dark-svg svg path { fill: #000 !important; }`}</style>

          <h2 style={{ fontFamily: BL, fontSize: "clamp(2.5rem, 8vw, 5.5rem)", color: "#000", lineHeight: 0.95, marginBottom: "0.75rem", letterSpacing: "0.02em" }}>
            Add Alfie.
          </h2>
          <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1rem", color: "rgba(0,0,0,0.45)", marginBottom: "2.5rem" }}>
            Pick a server. She handles the music.
          </p>
          <button onClick={goInvite} style={{
            fontFamily: SERIF, fontWeight: 700,
            fontSize: "0.8rem", letterSpacing: "0.22em", textTransform: "uppercase",
            background: "#000", color: "#fff",
            border: "none", padding: "14px 44px",
            cursor: "pointer", transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "#1a1a1a"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "#000"; }}
          >
            Get started →
          </button>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────── */}
      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.08)", padding: "1.75rem 1.5rem" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
          <CrossSVG size={12} opacity={0.2} />
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.75rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>
            alfie · your discord dj
          </span>
          <CrossSVG size={12} opacity={0.2} />
        </div>
      </footer>
    </div>
  );
}
