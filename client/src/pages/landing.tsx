import { useEffect, useState, useRef, useCallback } from "react";

const LACE_BG = {
  backgroundImage: `linear-gradient(rgba(255,255,255,0.88), rgba(255,255,255,0.88)), url('/lace-texture.webp')`,
  backgroundSize: "auto, 420px auto",
  backgroundRepeat: "repeat" as const,
  backgroundColor: "#fff",
};

const SERIF = "'Cinzel', serif";

const FEATURES = [
  {
    title: "Stream Anything",
    desc: "YouTube, SoundCloud, and Spotify links. Search by name. Alessa finds it and queues it immediately.",
  },
  {
    title: "Full Queue Control",
    desc: "Add, remove, move, and shuffle tracks. Loop a single song or the whole queue. Nothing stops playback.",
  },
  {
    title: "Rave Mode",
    desc: "Start an infinite genre session. AI-written DJ commentary plays between tracks. Set a vibe and disappear.",
  },
  {
    title: "Now Playing",
    desc: "Live progress bar with album art, track info, and runtime. Always know what's on and what's next.",
  },
  {
    title: "Autoplay",
    desc: "When your queue runs dry, Alessa picks up similar music automatically. The party doesn't stop.",
  },
  {
    title: "Saved Playlists",
    desc: "Save the current queue as a named playlist. Reload it any time with a single command.",
  },
];

const Cross = ({ size = 12, color = "#1a1a1a", opacity = 1 }: { size?: number; color?: string; opacity?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ opacity, flexShrink: 0, display: "block" }}>
    <rect x="5" y="0" width="2" height="12" fill={color} />
    <rect x="0" y="5" width="12" height="2" fill={color} />
  </svg>
);

export default function LandingPage() {
  const [inviteUrl, setInviteUrl] = useState("/api/public/invite-url");
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [btnHover, setBtnHover] = useState(false);
  const [btn2Hover, setBtn2Hover] = useState(false);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ tx: 0, ty: 0, ox: 0, oy: 0 });
  const currentRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    fetch("/api/public/invite-url")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.url) setInviteUrl(d.url); })
      .catch(() => {});
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const { clientX, clientY, currentTarget } = e;
    const { width, height, left, top } = currentTarget.getBoundingClientRect();
    const nx = (clientX - left) / width - 0.5;
    const ny = (clientY - top) / height - 0.5;
    targetRef.current = { tx: ny * 14, ty: nx * -14, ox: nx * 16, oy: ny * 10 };
  }, []);

  const handleMouseLeave = useCallback(() => {
    targetRef.current = { tx: 0, ty: 0, ox: 0, oy: 0 };
  }, []);

  useEffect(() => {
    const ease = 0.07;
    const animate = () => {
      const t = targetRef.current;
      const c = currentRef.current;
      c.x += (t.tx - c.x) * ease;
      c.y += (t.ty - c.y) * ease;
      c.ox += (t.ox - c.ox) * ease;
      c.oy += (t.oy - c.oy) * ease;
      setTilt({ x: c.x, y: c.y });
      setOffset({ x: c.ox, y: c.oy });
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const scrollToFeatures = () => {
    const hero = heroRef.current;
    if (hero) {
      const next = hero.nextElementSibling as HTMLElement;
      next?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div style={{ ...LACE_BG, fontFamily: SERIF, overflowY: "auto", overflowX: "hidden" }}>

      {/* ── PAGE 1: HERO ─────────────────────────────────────────── */}
      <section
        ref={heroRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ height: "100vh", display: "flex", position: "relative", overflow: "hidden" }}
      >
        {/* Left */}
        <div style={{
          flex: "0 0 48%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          paddingLeft: "7vw",
          zIndex: 2,
          position: "relative",
        }}>
          {/* Eyebrow rule */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "1.8rem" }}>
            <div style={{ width: 36, height: 1, background: "rgba(0,0,0,0.35)" }} />
            <Cross size={11} opacity={0.55} />
            <div style={{ width: 36, height: 1, background: "rgba(0,0,0,0.35)" }} />
          </div>

          {/* Name */}
          <h1 style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: "clamp(3.2rem, 6.5vw, 6rem)",
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#0d0d0d",
            margin: "0 0 0.15em",
            lineHeight: 1,
          }}>
            Alessa
          </h1>

          {/* Label */}
          <p style={{
            fontFamily: SERIF,
            fontWeight: 400,
            fontSize: "0.62rem",
            letterSpacing: "0.42em",
            textTransform: "uppercase",
            color: "rgba(0,0,0,0.55)",
            margin: "0 0 1rem",
          }}>
            Discord Music Bot
          </p>

          {/* Tagline */}
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: "italic",
            fontSize: "clamp(0.95rem, 1.5vw, 1.1rem)",
            color: "rgba(0,0,0,0.52)",
            lineHeight: 1.7,
            maxWidth: 340,
            margin: "0 0 2.5rem",
          }}>
            Plays what you want and stays out of your way.<br />
            No opinions. No memory. No lectures.
          </p>

          {/* CTA */}
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
            <a
              href={inviteUrl}
              onMouseEnter={() => setBtnHover(true)}
              onMouseLeave={() => setBtnHover(false)}
              style={{
                fontFamily: SERIF,
                fontWeight: 600,
                fontSize: "0.68rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: btnHover ? "#fff" : "#0d0d0d",
                background: btnHover ? "#0d0d0d" : "transparent",
                border: "1.5px solid #0d0d0d",
                padding: "13px 34px",
                textDecoration: "none",
                display: "inline-block",
                transition: "background 0.22s, color 0.22s",
              }}
            >
              Add to Discord
            </a>
            <button
              onClick={scrollToFeatures}
              style={{
                fontFamily: SERIF,
                fontWeight: 400,
                fontSize: "0.62rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "rgba(0,0,0,0.45)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              See features
              <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
                <path d="M5 0v11M1 8l4 5 4-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {/* Bottom rule */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginTop: "2.2rem" }}>
            <div style={{ width: 36, height: 1, background: "rgba(0,0,0,0.35)" }} />
            <Cross size={11} opacity={0.55} />
            <div style={{ width: 36, height: 1, background: "rgba(0,0,0,0.35)" }} />
          </div>
        </div>

        {/* Right — cross */}
        <div style={{
          flex: "0 0 52%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          perspective: "900px",
        }}>
          <img
            src="/cross-transparent.png"
            alt=""
            draggable={false}
            style={{
              width: "clamp(280px, 42vw, 600px)",
              height: "auto",
              userSelect: "none",
              pointerEvents: "none",
              transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translate(${offset.x * 0.5}px, ${offset.y * 0.5}px)`,
              willChange: "transform",
              filter: "drop-shadow(0 8px 48px rgba(0,0,0,0.22)) drop-shadow(0 2px 10px rgba(0,0,0,0.14))",
            }}
          />
        </div>
      </section>

      {/* ── PAGE 2: FEATURES ──────────────────────────────────────── */}
      <section style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "5vh 7vw",
        borderTop: "1px solid rgba(0,0,0,0.15)",
        position: "relative",
      }}>

        {/* Section heading */}
        <div style={{ marginBottom: "3.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <Cross size={11} opacity={0.55} />
            <span style={{ fontFamily: SERIF, fontSize: "0.58rem", letterSpacing: "0.48em", textTransform: "uppercase", color: "rgba(0,0,0,0.5)" }}>
              What she does
            </span>
            <Cross size={11} opacity={0.55} />
          </div>
          <h2 style={{
            fontFamily: SERIF,
            fontWeight: 700,
            fontSize: "clamp(1.8rem, 3.5vw, 3rem)",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#0d0d0d",
            margin: 0,
          }}>
            Features
          </h2>
        </div>

        {/* Feature grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "0",
          border: "1px solid rgba(0,0,0,0.14)",
          flex: 1,
        }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              style={{
                padding: "2rem 1.75rem",
                borderRight: (i % 3 !== 2) ? "1px solid rgba(0,0,0,0.12)" : "none",
                borderBottom: (i < 3) ? "1px solid rgba(0,0,0,0.12)" : "none",
                position: "relative",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "1.1rem" }}>
                <Cross size={10} opacity={0.6} />
                <span style={{ fontFamily: SERIF, fontSize: "0.55rem", letterSpacing: "0.35em", textTransform: "uppercase", color: "rgba(0,0,0,0.4)" }}>
                  0{i + 1}
                </span>
              </div>
              <h3 style={{
                fontFamily: SERIF,
                fontWeight: 700,
                fontSize: "0.95rem",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#0d0d0d",
                margin: "0 0 0.7rem",
              }}>
                {f.title}
              </h3>
              <p style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontStyle: "italic",
                fontSize: "0.97rem",
                lineHeight: 1.75,
                color: "rgba(0,0,0,0.58)",
                margin: 0,
              }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div style={{
          marginTop: "3.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
        }}>
          <span style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontStyle: "italic",
            fontSize: "0.9rem",
            color: "rgba(0,0,0,0.38)",
            letterSpacing: "0.04em",
          }}>
            ✝ &nbsp; free &nbsp;·&nbsp; no account needed &nbsp; ✝
          </span>
          <a
            href={inviteUrl}
            onMouseEnter={() => setBtn2Hover(true)}
            onMouseLeave={() => setBtn2Hover(false)}
            style={{
              fontFamily: SERIF,
              fontWeight: 600,
              fontSize: "0.68rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: btn2Hover ? "#fff" : "#0d0d0d",
              background: btn2Hover ? "#0d0d0d" : "transparent",
              border: "1.5px solid #0d0d0d",
              padding: "12px 32px",
              textDecoration: "none",
              display: "inline-block",
              transition: "background 0.22s, color 0.22s",
            }}
          >
            Add Alessa to your server →
          </a>
        </div>
      </section>

    </div>
  );
}
