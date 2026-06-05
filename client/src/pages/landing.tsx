import { useEffect, useState, useRef } from "react";

const ACCENT = "#818cf8";
const ACCENT_DIM = "rgba(129,140,248,0.15)";
const ACCENT_BORDER = "rgba(129,140,248,0.3)";
const BG = "#080810";
const SURFACE = "rgba(255,255,255,0.03)";
const BORDER = "rgba(255,255,255,0.08)";
const TEXT = "#f1f5f9";
const MUTED = "rgba(241,245,249,0.45)";
const SANS = "'Space Grotesk', 'Inter', system-ui, sans-serif";

const FEATURES = [
  {
    icon: "▶",
    title: "Stream Anything",
    desc: "YouTube, SoundCloud, Spotify links — or just search by name. Queued instantly.",
  },
  {
    icon: "≡",
    title: "Full Queue Control",
    desc: "Add, remove, move, shuffle. Loop a track or the whole queue. Nothing interrupts playback.",
  },
  {
    icon: "✦",
    title: "Rave Mode",
    desc: "Pick a genre and let the AI DJ take over. Infinite session, automatic track selection.",
  },
  {
    icon: "◉",
    title: "Now Playing",
    desc: "Live progress bar with album art, track info, and queue preview at a glance.",
  },
  {
    icon: "∞",
    title: "Autoplay",
    desc: "Queue runs out? Alessa finds similar music and keeps it going automatically.",
  },
  {
    icon: "♫",
    title: "Saved Playlists",
    desc: "Save the current queue as a named playlist. Load it back anytime with one command.",
  },
];

function Waveform() {
  const bars = 28;
  const heights = Array.from({ length: bars }, (_, i) => {
    const base = Math.sin(i * 0.7) * 0.4 + Math.sin(i * 1.3) * 0.3 + 0.3;
    return Math.max(0.1, Math.min(1, base));
  });

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "3px",
      height: "80px",
    }}>
      {heights.map((h, i) => (
        <div
          key={i}
          style={{
            width: "4px",
            height: `${h * 80}px`,
            borderRadius: "2px",
            background: `rgba(129,140,248,${0.25 + h * 0.55})`,
            animation: `wave ${0.8 + (i % 5) * 0.15}s ease-in-out infinite alternate`,
            animationDelay: `${(i * 0.06) % 0.8}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1.0); }
        }
      `}</style>
    </div>
  );
}

export default function LandingPage() {
  const [inviteUrl, setInviteUrl] = useState("/api/public/invite-url");
  const [scrolled, setScrolled] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/public/invite-url")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.url) setInviteUrl(d.url); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 40);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        background: BG,
        fontFamily: SANS,
        overflowY: "auto",
        overflowX: "hidden",
        color: TEXT,
        minHeight: "100vh",
      }}
    >
      {/* ── NAV ─────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 5vw",
        height: "60px",
        background: scrolled ? "rgba(8,8,16,0.92)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? `1px solid ${BORDER}` : "1px solid transparent",
        transition: "background 0.3s, border-color 0.3s, backdrop-filter 0.3s",
      }}>
        <span style={{
          fontWeight: 700,
          fontSize: "1.05rem",
          letterSpacing: "0.04em",
          color: TEXT,
        }}>
          Alessa
        </span>
        <a
          href={inviteUrl}
          style={{
            fontWeight: 600,
            fontSize: "0.8rem",
            letterSpacing: "0.04em",
            color: ACCENT,
            textDecoration: "none",
            padding: "7px 18px",
            border: `1px solid ${ACCENT_BORDER}`,
            borderRadius: "6px",
            background: ACCENT_DIM,
            transition: "background 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(129,140,248,0.25)")}
          onMouseLeave={e => (e.currentTarget.style.background = ACCENT_DIM)}
        >
          Add to Discord
        </a>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────── */}
      <section style={{
        minHeight: "calc(100vh - 60px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "6vh 5vw 8vh",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background glow */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 70% 50% at 50% 0%, rgba(129,140,248,0.1), transparent 70%)`,
          pointerEvents: "none",
        }} />

        {/* Badge */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          background: ACCENT_DIM,
          border: `1px solid ${ACCENT_BORDER}`,
          borderRadius: "100px",
          padding: "5px 14px",
          fontSize: "0.72rem",
          fontWeight: 600,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: ACCENT,
          marginBottom: "2rem",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, display: "inline-block" }} />
          Discord Music Bot
        </div>

        {/* Headline */}
        <h1 style={{
          fontSize: "clamp(3rem, 7vw, 5.5rem)",
          fontWeight: 800,
          lineHeight: 1.05,
          letterSpacing: "-0.03em",
          margin: "0 0 1.25rem",
          maxWidth: "800px",
        }}>
          Music that just{" "}
          <span style={{
            background: `linear-gradient(135deg, ${ACCENT}, #c084fc)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            works
          </span>
        </h1>

        {/* Subheading */}
        <p style={{
          fontSize: "clamp(1rem, 1.8vw, 1.2rem)",
          color: MUTED,
          lineHeight: 1.65,
          maxWidth: "520px",
          margin: "0 0 2.5rem",
          fontWeight: 400,
        }}>
          Plays what you want and stays out of your way.
          No opinions, no memory, no lectures.
        </p>

        {/* CTAs */}
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center", marginBottom: "4rem" }}>
          <a
            href={inviteUrl}
            style={{
              display: "inline-block",
              background: ACCENT,
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.9rem",
              letterSpacing: "0.02em",
              padding: "13px 32px",
              borderRadius: "8px",
              textDecoration: "none",
              transition: "opacity 0.2s, transform 0.2s",
              boxShadow: `0 0 32px rgba(129,140,248,0.35)`,
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
          >
            Add to Discord
          </a>
          <button
            onClick={() => {
              const el = document.getElementById("features");
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            style={{
              display: "inline-block",
              background: SURFACE,
              color: TEXT,
              fontWeight: 500,
              fontSize: "0.9rem",
              padding: "13px 28px",
              borderRadius: "8px",
              border: `1px solid ${BORDER}`,
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
            onMouseLeave={e => (e.currentTarget.style.background = SURFACE)}
          >
            See features
          </button>
        </div>

        {/* Waveform visual */}
        <div style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: "16px",
          padding: "28px 36px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          maxWidth: "480px",
          width: "100%",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: "8px",
              background: ACCENT_DIM,
              border: `1px solid ${ACCENT_BORDER}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.1rem",
            }}>
              ♫
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", lineHeight: 1.3 }}>Now Playing</div>
              <div style={{ color: MUTED, fontSize: "0.75rem" }}>your queue · 1 of 12</div>
            </div>
            <div style={{ marginLeft: "auto", color: ACCENT, fontSize: "0.8rem", fontWeight: 600 }}>LIVE</div>
          </div>
          <Waveform />
          <div style={{
            height: "3px",
            background: BORDER,
            borderRadius: "2px",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: "38%",
              background: `linear-gradient(90deg, ${ACCENT}, #c084fc)`,
              borderRadius: "2px",
            }} />
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────── */}
      <section id="features" style={{
        padding: "8vh 5vw",
        borderTop: `1px solid ${BORDER}`,
      }}>
        <div style={{ maxWidth: "960px", margin: "0 auto" }}>
          <p style={{
            fontSize: "0.72rem",
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: ACCENT,
            marginBottom: "0.75rem",
          }}>
            What it does
          </p>
          <h2 style={{
            fontSize: "clamp(1.8rem, 3.5vw, 2.75rem)",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            margin: "0 0 3rem",
          }}>
            Everything your server needs
          </h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "1px",
            background: BORDER,
            border: `1px solid ${BORDER}`,
            borderRadius: "12px",
            overflow: "hidden",
          }}>
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{
                  background: BG,
                  padding: "1.75rem",
                  transition: "background 0.2s",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(129,140,248,0.05)")}
                onMouseLeave={e => (e.currentTarget.style.background = BG)}
              >
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: "8px",
                  background: ACCENT_DIM,
                  border: `1px solid ${ACCENT_BORDER}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.9rem",
                  color: ACCENT,
                  marginBottom: "1rem",
                }}>
                  {f.icon}
                </div>
                <h3 style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  margin: "0 0 0.5rem",
                }}>
                  {f.title}
                </h3>
                <p style={{
                  fontSize: "0.875rem",
                  lineHeight: 1.65,
                  color: MUTED,
                  margin: 0,
                }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER CTA ──────────────────────────────────────────────── */}
      <section style={{
        padding: "7vh 5vw",
        borderTop: `1px solid ${BORDER}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: "1.5rem",
      }}>
        <h2 style={{
          fontSize: "clamp(1.6rem, 3vw, 2.25rem)",
          fontWeight: 800,
          letterSpacing: "-0.02em",
          margin: 0,
        }}>
          Ready to play something?
        </h2>
        <p style={{ color: MUTED, fontSize: "1rem", margin: 0 }}>
          Free. No account needed. Works in any server.
        </p>
        <a
          href={inviteUrl}
          style={{
            display: "inline-block",
            background: ACCENT,
            color: "#fff",
            fontWeight: 700,
            fontSize: "0.95rem",
            padding: "14px 36px",
            borderRadius: "8px",
            textDecoration: "none",
            boxShadow: `0 0 32px rgba(129,140,248,0.3)`,
            transition: "opacity 0.2s, transform 0.2s",
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
        >
          Add Alessa to Discord →
        </a>
        <p style={{ color: MUTED, fontSize: "0.75rem", margin: 0 }}>
          © {new Date().getFullYear()} Alessa
        </p>
      </section>
    </div>
  );
}
