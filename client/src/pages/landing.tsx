import { useEffect, useState } from "react";
import crossImg from "@assets/s11728_chrome_hearts_cross_isolated_on_white_background_-sty_7_1780310861273.png";

const BL = "'UnifrakturMaguntia', serif";
const SERIF = "'Cormorant Garamond', serif";

const FISHNET: React.CSSProperties = {
  backgroundImage: `
    repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.045) 5px, rgba(255,255,255,0.045) 6px),
    repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(255,255,255,0.045) 5px, rgba(255,255,255,0.045) 6px)
  `,
};

const SmallCross = ({ opacity = 0.3 }: { opacity?: number }) => (
  <svg width="14" height="14" viewBox="0 0 100 100" fill="none" style={{ opacity, flexShrink: 0 }}>
    <rect x="43" y="8" width="14" height="84" fill="white" />
    <rect x="8" y="43" width="84" height="14" fill="white" />
  </svg>
);

const FEATURES = [
  { title: "Stream anything",    desc: "YouTube, SoundCloud, Spotify links or search queries. Alessa finds it." },
  { title: "Queue control",      desc: "Add, remove, move, shuffle, loop. Full control without stopping playback." },
  { title: "Now playing",        desc: "Live progress bar with album art and track info. Always know what's on." },
  { title: "Vote skip",          desc: "Majority vote when 3+ in voice, instant if fewer. Fair by design." },
  { title: "Rave mode",          desc: "Genre sessions with automatic discovery and AI commentary. Set it and go." },
  { title: "Saved playlists",    desc: "Save your queue and reload it whenever you want." },
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
        background: "rgba(0,0,0,0.88)",
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1.5rem", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: BL, fontSize: "1.4rem", letterSpacing: "0.05em", lineHeight: 1 }}>
            Alessa
          </span>
          <button onClick={goInvite} style={{
            fontFamily: SERIF, fontWeight: 700, fontSize: "0.7rem",
            letterSpacing: "0.2em", textTransform: "uppercase",
            background: "transparent", color: "rgba(255,255,255,0.65)",
            border: "1px solid rgba(255,255,255,0.22)", padding: "6px 18px",
            cursor: "pointer", transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.color = "#000"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.65)"; }}
          >
            Add to Discord
          </button>
        </div>
      </nav>

      {/* ─── Hero ─────────────────────────────────────────── */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 1, paddingTop: "52px" }}>

        {/* Cross hero image */}
        <div style={{
          position: "relative",
          marginBottom: "2.5rem",
          filter: "drop-shadow(0 0 60px rgba(180,180,200,0.18)) drop-shadow(0 0 120px rgba(120,120,160,0.1))",
        }}>
          <img
            src={crossImg}
            alt=""
            style={{
              width: "clamp(260px, 34vw, 440px)",
              height: "auto",
              display: "block",
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Eyebrow */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <SmallCross opacity={0.35} />
          <span style={{ fontFamily: SERIF, fontSize: "0.6rem", letterSpacing: "0.45em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
            Discord Music Bot
          </span>
          <SmallCross opacity={0.35} />
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: BL,
          fontSize: "clamp(4.5rem, 13vw, 10rem)",
          lineHeight: 0.9,
          color: "#fff",
          marginBottom: "0.1em",
          textShadow: "0 0 80px rgba(255,255,255,0.1)",
          letterSpacing: "0.02em",
          textAlign: "center",
        }}>
          Alessa
        </h1>

        {/* Rule */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.5rem 0 1.75rem" }}>
          <div style={{ width: 60, height: 1, background: "rgba(255,255,255,0.15)" }} />
          <SmallCross opacity={0.5} />
          <div style={{ width: 60, height: 1, background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Tagline */}
        <p style={{
          fontFamily: SERIF, fontStyle: "italic",
          fontSize: "clamp(0.95rem, 2vw, 1.15rem)",
          lineHeight: 1.85, color: "rgba(255,255,255,0.38)",
          maxWidth: 420, marginBottom: "2.75rem",
          textAlign: "center", padding: "0 1.5rem",
        }}>
          A music bot that plays what you want and stays out of your way.
          No opinions. No memory. No lectures.
        </p>

        {/* CTA */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
          <button onClick={goInvite} style={{
            fontFamily: SERIF, fontWeight: 700,
            fontSize: "0.8rem", letterSpacing: "0.22em", textTransform: "uppercase",
            background: "#fff", color: "#000",
            border: "none", padding: "14px 48px",
            cursor: "pointer", transition: "all 0.2s",
            boxShadow: "0 0 40px rgba(255,255,255,0.1)",
          }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 60px rgba(255,255,255,0.22)"; e.currentTarget.style.background = "#e8e8e8"; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 40px rgba(255,255,255,0.1)"; e.currentTarget.style.background = "#fff"; }}
          >
            Add Alessa to your server
          </button>
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.78rem", color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em" }}>
            ✝ &nbsp;free &nbsp;·&nbsp; no account needed &nbsp;✝
          </span>
        </div>

        {/* Scroll hint */}
        <div style={{ position: "absolute", bottom: "2.5rem", left: "50%", transform: "translateX(-50%)", opacity: 0.2, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
          <SmallCross opacity={1} />
          <div style={{ width: 1, height: 32, background: "rgba(255,255,255,0.4)" }} />
        </div>
      </section>

      {/* ─── Divider ──────────────────────────────────────── */}
      <div style={{ zIndex: 1, position: "relative", display: "flex", alignItems: "center", gap: "1.25rem", padding: "0 1.5rem" }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
        <SmallCross opacity={0.25} />
        <SmallCross opacity={0.18} />
        <SmallCross opacity={0.25} />
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
      </div>

      {/* ─── Features ─────────────────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>

          <p style={{
            fontFamily: SERIF, fontSize: "0.58rem", letterSpacing: "0.48em",
            textTransform: "uppercase", color: "rgba(255,255,255,0.22)",
            marginBottom: "3rem", textAlign: "center",
          }}>
            ✝ &nbsp; Commands &nbsp; ✝
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "1px", background: "rgba(255,255,255,0.07)" }}>
            {FEATURES.map((f, i) => (
              <div key={f.title} style={{ background: "#000", padding: "2rem 1.75rem", position: "relative", ...FISHNET }}>
                <div style={{ position: "absolute", top: 10, right: 10, opacity: 0.12 }}>
                  <SmallCross opacity={1} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                  <SmallCross opacity={0.4} />
                  <span style={{ fontFamily: SERIF, fontSize: "0.58rem", letterSpacing: "0.3em", textTransform: "uppercase", color: "rgba(255,255,255,0.28)" }}>
                    0{i + 1}
                  </span>
                </div>
                <h3 style={{ fontFamily: BL, fontSize: "1.45rem", color: "#fff", marginBottom: "0.6rem", letterSpacing: "0.02em", lineHeight: 1.1 }}>
                  {f.title}
                </h3>
                <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.9rem", lineHeight: 1.8, color: "rgba(255,255,255,0.35)" }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Inverted CTA strip ───────────────────────────── */}
      <section style={{ position: "relative", zIndex: 1, background: "#fff", color: "#000", padding: "5.5rem 1.5rem", textAlign: "center" }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `
            repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(0,0,0,0.035) 5px, rgba(0,0,0,0.035) 6px),
            repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(0,0,0,0.035) 5px, rgba(0,0,0,0.035) 6px)
          `,
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginBottom: "1.75rem" }}>
            <svg width="22" height="22" viewBox="0 0 100 100" fill="none" style={{ opacity: 0.18 }}>
              <rect x="43" y="8" width="14" height="84" fill="black" />
              <rect x="8" y="43" width="84" height="14" fill="black" />
            </svg>
            <svg width="22" height="22" viewBox="0 0 100 100" fill="none" style={{ opacity: 0.12 }}>
              <rect x="43" y="8" width="14" height="84" fill="black" />
              <rect x="8" y="43" width="84" height="14" fill="black" />
            </svg>
            <svg width="22" height="22" viewBox="0 0 100 100" fill="none" style={{ opacity: 0.18 }}>
              <rect x="43" y="8" width="14" height="84" fill="black" />
              <rect x="8" y="43" width="84" height="14" fill="black" />
            </svg>
          </div>
          <h2 style={{ fontFamily: BL, fontSize: "clamp(2.5rem, 8vw, 5.5rem)", color: "#000", lineHeight: 0.95, marginBottom: "0.75rem", letterSpacing: "0.02em" }}>
            Add Alessa.
          </h2>
          <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "1rem", color: "rgba(0,0,0,0.42)", marginBottom: "2.5rem" }}>
            Pick a server. She handles the music.
          </p>
          <button onClick={goInvite} style={{
            fontFamily: SERIF, fontWeight: 700,
            fontSize: "0.8rem", letterSpacing: "0.22em", textTransform: "uppercase",
            background: "#000", color: "#fff",
            border: "none", padding: "14px 48px",
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
      <footer style={{ position: "relative", zIndex: 1, borderTop: "1px solid rgba(255,255,255,0.07)", padding: "1.75rem 1.5rem" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem" }}>
          <SmallCross opacity={0.15} />
          <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "0.75rem", color: "rgba(255,255,255,0.18)", letterSpacing: "0.1em" }}>
            alessa · your discord dj
          </span>
          <SmallCross opacity={0.15} />
        </div>
      </footer>
    </div>
  );
}
