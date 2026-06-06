import { useEffect, useState, useRef, useCallback } from "react";

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
  { title: "Stream Anything",    desc: "YouTube, SoundCloud, and Spotify. Search by name or paste a link. Alessa finds it and queues it instantly." },
  { title: "Full Queue Control", desc: "Add, remove, shuffle, and reorder. Loop a single song or the whole queue. Nothing stops playback." },
  { title: "Rave Mode",          desc: "Infinite genre sessions with DJ commentary between tracks. Set a vibe and walk away." },
  { title: "Now Playing",        desc: "Live progress bar, iTunes album art, track info, and runtime — always visible, always current." },
  { title: "Autoplay",           desc: "When the queue runs out, Alessa finds similar music and keeps going. The party doesn't stop." },
  { title: "Saved Playlists",    desc: "Save the current queue as a named playlist. Reload it any time with a single command." },
];

const CMDS_A = [
  { n: "/play",       d: "Play a song or playlist" },
  { n: "/skip",       d: "Skip (vote-skip with 3+)" },
  { n: "/queue",      d: "Show the current queue" },
  { n: "/nowplaying", d: "See what's currently on" },
  { n: "/volume",     d: "Set the volume (0–100)" },
  { n: "/shuffle",    d: "Shuffle the queue" },
  { n: "/loop",       d: "off → track → queue → off" },
];
const CMDS_B = [
  { n: "/seek",       d: "Jump to any position" },
  { n: "/lyrics",     d: "Lyrics for the current song" },
  { n: "/history",    d: "Last 20 tracks played" },
  { n: "/autoplay",   d: "Toggle autoplay mode" },
  { n: "/rave",       d: "Infinite DJ session" },
  { n: "/savequeue",  d: "Save queue as playlist" },
  { n: "/speak",      d: "TTS in your voice channel" },
];

// ── sub-components ─────────────────────────────────────────────────────────

const Cross = ({
  size = 12,
  color = CRIMSON,
  opacity = 1,
}: {
  size?: number;
  color?: string;
  opacity?: number;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 12 12"
    fill="none"
    style={{ opacity, flexShrink: 0, display: "block" }}
  >
    <rect x="5" y="0" width="2" height="12" fill={color} />
    <rect x="0" y="5" width="12" height="2" fill={color} />
  </svg>
);

function NavLink({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: SERIF,
        fontSize: "0.56rem",
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: hov ? INK : DIM,
        background: "none",
        border: "none",
        cursor: "pointer",
        padding: 0,
        transition: "color 0.18s",
      }}
    >
      {children}
    </button>
  );
}

function Btn({
  href,
  children,
  variant = "outline",
  size = "md",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "solid" | "outline";
  size?: "md" | "lg";
}) {
  const [hov, setHov] = useState(false);
  return (
    <a
      href={href}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "inline-block",
        fontFamily: SERIF,
        fontWeight: 600,
        fontSize: size === "lg" ? "0.7rem" : "0.63rem",
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        textDecoration: "none",
        padding: size === "lg" ? "17px 50px" : "12px 30px",
        border: `1.5px solid ${
          variant === "solid"
            ? CRIMSON
            : hov
            ? CRIMSON
            : RULE
        }`,
        background:
          variant === "solid"
            ? hov
              ? "transparent"
              : CRIMSON
            : hov
            ? CRIMSON
            : "transparent",
        color: INK,
        transition: "background 0.22s, border-color 0.22s",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </a>
  );
}

function FeatureCard({
  title,
  desc,
  index,
}: {
  title: string;
  desc: string;
  index: number;
}) {
  const [hov, setHov] = useState(false);
  const row = Math.floor(index / 3);
  const col = index % 3;
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "2.3rem 2rem",
        borderRight: col < 2 ? `1px solid ${RULE}` : "none",
        borderBottom: row < 1 ? `1px solid ${RULE}` : "none",
        background: hov ? "rgba(196,30,58,0.055)" : GHOST,
        boxShadow: hov
          ? `inset 0 3px 0 0 ${CRIMSON}`
          : `inset 0 3px 0 0 transparent`,
        transition: "background 0.22s, box-shadow 0.22s",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.55rem",
          marginBottom: "1.15rem",
        }}
      >
        <Cross size={9} opacity={hov ? 1 : 0.6} />
        <span
          style={{
            fontFamily: SERIF,
            fontSize: "0.49rem",
            letterSpacing: "0.42em",
            textTransform: "uppercase",
            color: hov ? CRIMSON : "rgba(196,30,58,0.58)",
            transition: "color 0.2s",
          }}
        >
          0{index + 1}
        </span>
      </div>
      <h3
        style={{
          fontFamily: SERIF,
          fontWeight: 700,
          fontSize: "0.84rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: INK,
          margin: "0 0 0.7rem",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: CURSIVE,
          fontStyle: "italic",
          fontSize: "0.97rem",
          lineHeight: 1.8,
          color: DIM,
          margin: 0,
        }}
      >
        {desc}
      </p>
    </div>
  );
}

function CmdList({
  cmds,
  noBorderRight,
}: {
  cmds: { n: string; d: string }[];
  noBorderRight?: boolean;
}) {
  return (
    <div style={{ borderRight: noBorderRight ? "none" : `1px solid ${RULE}` }}>
      {cmds.map((c) => (
        <div
          key={c.n}
          style={{
            padding: "0.82rem 1.1rem",
            borderBottom: `1px solid ${RULE}`,
            display: "flex",
            alignItems: "baseline",
            gap: "0.65rem",
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: "0.68rem",
              color: CRIMSON,
              flexShrink: 0,
              letterSpacing: "0.01em",
            }}
          >
            {c.n}
          </span>
          <span
            style={{
              fontFamily: CURSIVE,
              fontStyle: "italic",
              fontSize: "0.88rem",
              color: DIM,
              lineHeight: 1.3,
            }}
          >
            {c.d}
          </span>
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
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const { clientX, clientY, currentTarget } = e;
    const { width, height, left, top } = currentTarget.getBoundingClientRect();
    const nx = (clientX - left) / width - 0.5;
    const ny = (clientY - top) / height - 0.5;
    target.current = { tx: ny * 11, ty: nx * -11, px: nx * 20, py: ny * 11 };
  }, []);

  const onMouseLeave = useCallback(() => {
    target.current = { tx: 0, ty: 0, px: 0, py: 0 };
  }, []);

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div
      ref={wrapRef}
      style={{
        ...LACE,
        fontFamily: SERIF,
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >

      {/* ────────────────────────────────────────── NAV */}
      <nav
        style={{
          position: "fixed",
          top: 0, left: 0, right: 0,
          zIndex: 100,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 5vw",
          background: navSolid ? "rgba(12,12,12,0.94)" : "transparent",
          borderBottom: `1px solid ${navSolid ? RULE : "transparent"}`,
          backdropFilter: navSolid ? "blur(20px)" : "none",
          WebkitBackdropFilter: navSolid ? "blur(20px)" : "none",
          transition: "background 0.3s, border-color 0.3s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <Cross size={10} opacity={0.7} />
          <span
            style={{
              fontFamily: DECO,
              fontWeight: 700,
              fontSize: "0.68rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: INK,
            }}
          >
            Alessa
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          <NavLink onClick={() => scrollTo("features")}>Features</NavLink>
          <NavLink onClick={() => scrollTo("commands")}>Commands</NavLink>
          <Btn href={inviteUrl} variant="solid">
            Add to Discord
          </Btn>
        </div>
      </nav>

      {/* ────────────────────────────────────────── HERO */}
      <section
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        style={{
          height: "100vh",
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* top crimson hairline */}
        <div
          style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            height: 1,
            background: `linear-gradient(90deg,transparent,${CRIMSON_MID},transparent)`,
            zIndex: 5,
          }}
        />
        {/* bottom vignette */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse 80% 45% at 50% 115%,${CRIMSON_DIM},transparent 72%)`,
            pointerEvents: "none",
            zIndex: 1,
          }}
        />

        {/* LEFT */}
        <div
          style={{
            flex: "0 0 50%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            paddingLeft: "7vw",
            paddingTop: 56,
            zIndex: 2,
            position: "relative",
          }}
        >
          {/* eyebrow */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.7rem",
              marginBottom: "2rem",
              animation: "alessa-fade-up 0.8s ease both",
            }}
          >
            <div style={{ width: 26, height: 1, background: CRIMSON_MID }} />
            <Cross size={9} opacity={0.8} />
            <span
              style={{
                fontFamily: SERIF,
                fontSize: "0.49rem",
                letterSpacing: "0.52em",
                textTransform: "uppercase",
                color: "rgba(196,30,58,0.72)",
              }}
            >
              Discord Music Bot
            </span>
            <Cross size={9} opacity={0.8} />
            <div style={{ width: 26, height: 1, background: CRIMSON_MID }} />
          </div>

          {/* H1 */}
          <h1
            style={{
              fontFamily: DECO,
              fontWeight: 900,
              fontSize: "clamp(3.8rem,7.2vw,7.2rem)",
              letterSpacing: "0.03em",
              color: INK,
              margin: "0 0 0.04em",
              lineHeight: 0.92,
              textTransform: "uppercase",
              animation: "alessa-fade-up 0.8s 0.1s ease both",
            }}
          >
            Alessa
          </h1>

          {/* crimson rule */}
          <div
            style={{
              width: "clamp(90px,12vw,200px)",
              height: 1,
              background: `linear-gradient(90deg,${CRIMSON},transparent)`,
              margin: "1.5rem 0",
              animation: "alessa-fade-up 0.8s 0.18s ease both",
            }}
          />

          {/* tagline */}
          <p
            style={{
              fontFamily: CURSIVE,
              fontStyle: "italic",
              fontWeight: 300,
              fontSize: "clamp(1rem,1.55vw,1.22rem)",
              color: DIM,
              lineHeight: 1.82,
              maxWidth: 360,
              margin: "0 0 2.6rem",
              animation: "alessa-fade-up 0.8s 0.24s ease both",
            }}
          >
            Plays what you want and stays out of your way.
            <br />
            No opinions. No memory. No lectures.
          </p>

          {/* CTAs */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "1.4rem",
              flexWrap: "wrap",
              marginBottom: "2.3rem",
              animation: "alessa-fade-up 0.8s 0.3s ease both",
            }}
          >
            <Btn href={inviteUrl} variant="solid">
              Add to Discord
            </Btn>
            <button
              onClick={() => scrollTo("features")}
              style={{
                fontFamily: SERIF,
                fontSize: "0.58rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: DIM,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              See features
              <svg width="9" height="13" viewBox="0 0 9 13" fill="none">
                <path
                  d="M4.5 0v10M1 7.5l3.5 4.5 3.5-4.5"
                  stroke={DIM}
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {/* free note */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              animation: "alessa-fade-up 0.8s 0.36s ease both",
            }}
          >
            <Cross size={7} opacity={0.3} />
            <span
              style={{
                fontFamily: CURSIVE,
                fontStyle: "italic",
                fontSize: "0.8rem",
                color: "rgba(245,240,236,0.25)",
                letterSpacing: "0.04em",
              }}
            >
              free &nbsp;·&nbsp; no account needed &nbsp;·&nbsp; invite in seconds
            </span>
            <Cross size={7} opacity={0.3} />
          </div>
        </div>

        {/* RIGHT — animated cross */}
        <div
          style={{
            flex: "0 0 50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {/* pulsing ring glow */}
          <div
            style={{
              position: "absolute",
              width: "64%",
              paddingBottom: "64%",
              borderRadius: "50%",
              background: `radial-gradient(circle,transparent 28%,${CRIMSON_DIM} 56%,transparent 78%)`,
              animation: "alessa-pulse 4.5s ease-in-out infinite",
              pointerEvents: "none",
            }}
          />
          {/* inner hot glow */}
          <div
            style={{
              position: "absolute",
              width: "36%",
              paddingBottom: "36%",
              borderRadius: "50%",
              background: `radial-gradient(circle,rgba(196,30,58,0.18) 0%,transparent 70%)`,
              pointerEvents: "none",
            }}
          />

          {/* parallax shell — mouse translation */}
          <div
            style={{
              transform: `translate(${parallax.x * 0.35}px,${parallax.y * 0.35}px)`,
              willChange: "transform",
              animation: "alessa-fade-up 1s 0.15s ease both",
            }}
          >
            {/* float shell — CSS vertical bob */}
            <div style={{ animation: "alessa-float 7s ease-in-out infinite" }}>
              {/* tilt shell — JS perspective rotate */}
              <img
                src="/chrome-hearts-cross.svg"
                alt=""
                draggable={false}
                style={{
                  width: "clamp(240px,36vw,530px)",
                  height: "auto",
                  display: "block",
                  userSelect: "none",
                  pointerEvents: "none",
                  transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
                  willChange: "transform",
                  filter:
                    "invert(1) sepia(1) saturate(4) hue-rotate(295deg) brightness(0.82) " +
                    "drop-shadow(0 0 64px rgba(196,30,58,0.62)) " +
                    "drop-shadow(0 14px 52px rgba(0,0,0,0.96))",
                }}
              />
            </div>
          </div>
        </div>

        {/* scroll hint */}
        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            zIndex: 5,
          }}
        >
          <div
            style={{
              width: 1,
              height: 34,
              background: `linear-gradient(to bottom,${CRIMSON_MID},transparent)`,
            }}
          />
          <Cross size={7} opacity={0.28} />
        </div>
      </section>

      {/* ────────────────────────────────────────── FEATURES */}
      <section
        id="features"
        style={{
          padding: "9vh 7vw",
          borderTop: `1px solid ${RULE}`,
          position: "relative",
        }}
      >
        {/* top-right ornament */}
        <div
          style={{
            position: "absolute",
            top: 36,
            right: "7vw",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            opacity: 0.22,
          }}
        >
          <Cross size={8} />
          <div style={{ width: 56, height: 1, background: CRIMSON }} />
          <Cross size={8} />
        </div>

        {/* heading */}
        <div style={{ marginBottom: "3.8rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.7rem",
              marginBottom: "0.8rem",
            }}
          >
            <Cross size={9} opacity={0.65} />
            <span
              style={{
                fontFamily: SERIF,
                fontSize: "0.49rem",
                letterSpacing: "0.55em",
                textTransform: "uppercase",
                color: "rgba(196,30,58,0.6)",
              }}
            >
              What it does
            </span>
          </div>
          <h2
            style={{
              fontFamily: DECO,
              fontWeight: 700,
              fontSize: "clamp(1.5rem,2.8vw,2.4rem)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: INK,
              margin: 0,
            }}
          >
            Features
          </h2>
        </div>

        {/* grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 0,
            border: `1px solid ${RULE}`,
          }}
        >
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} {...f} index={i} />
          ))}
        </div>

        {/* footer row */}
        <div
          style={{
            marginTop: "3.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <span
            style={{
              fontFamily: CURSIVE,
              fontStyle: "italic",
              fontSize: "0.88rem",
              color: "rgba(196,30,58,0.44)",
            }}
          >
            ✝ &ensp;free &nbsp;·&nbsp; no account needed &nbsp;·&nbsp; invite
            in seconds&ensp; ✝
          </span>
          <Btn href={inviteUrl}>Add Alessa to your server →</Btn>
        </div>
      </section>

      {/* ────────────────────────────────────────── COMMANDS */}
      <section
        id="commands"
        style={{
          padding: "9vh 7vw",
          borderTop: `1px solid ${RULE}`,
          background: "rgba(196,30,58,0.022)",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.55fr",
            gap: "5vw",
            alignItems: "start",
          }}
        >
          {/* left: copy */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.7rem",
                marginBottom: "0.8rem",
              }}
            >
              <Cross size={9} opacity={0.65} />
              <span
                style={{
                  fontFamily: SERIF,
                  fontSize: "0.49rem",
                  letterSpacing: "0.55em",
                  textTransform: "uppercase",
                  color: "rgba(196,30,58,0.6)",
                }}
              >
                Commands
              </span>
            </div>
            <h2
              style={{
                fontFamily: DECO,
                fontWeight: 700,
                fontSize: "clamp(1.5rem,2.8vw,2.4rem)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: INK,
                margin: "0 0 1.2rem",
              }}
            >
              Say the word.
            </h2>
            <p
              style={{
                fontFamily: CURSIVE,
                fontStyle: "italic",
                fontSize: "clamp(0.95rem,1.25vw,1.1rem)",
                color: DIM,
                lineHeight: 1.82,
                margin: "0 0 2.2rem",
                maxWidth: 310,
              }}
            >
              Every action is a slash command. Type it, Alessa responds.
              Nothing to configure. Nothing to learn.
            </p>
            <Btn href={inviteUrl} variant="solid">
              Invite Alessa →
            </Btn>
          </div>

          {/* right: command table */}
          <div
            style={{
              border: `1px solid ${RULE}`,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
            }}
          >
            <CmdList cmds={CMDS_A} />
            <CmdList cmds={CMDS_B} noBorderRight />
          </div>
        </div>
      </section>

      {/* ────────────────────────────────────────── FINAL CTA */}
      <section
        style={{
          padding: "13vh 7vw",
          borderTop: `1px solid ${RULE}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* top ornament */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginBottom: "3rem",
          }}
        >
          <div style={{ width: 48, height: 1, background: CRIMSON_MID }} />
          <img
            src="/chrome-hearts-cross.svg"
            alt=""
            style={{
              width: 48,
              height: 48,
              filter:
                "invert(1) sepia(1) saturate(4) hue-rotate(295deg) brightness(0.8) " +
                "drop-shadow(0 0 12px rgba(196,30,58,0.5))",
              opacity: 0.7,
            }}
          />
          <div style={{ width: 48, height: 1, background: CRIMSON_MID }} />
        </div>

        <blockquote
          style={{
            fontFamily: CURSIVE,
            fontStyle: "italic",
            fontWeight: 300,
            fontSize: "clamp(1.55rem,3.2vw,2.7rem)",
            color: INK,
            lineHeight: 1.35,
            margin: "0 0 0.5em",
            maxWidth: 700,
          }}
        >
          "The silence between tracks is temporary."
        </blockquote>
        <p
          style={{
            fontFamily: SERIF,
            fontSize: "0.5rem",
            letterSpacing: "0.52em",
            textTransform: "uppercase",
            color: "rgba(196,30,58,0.48)",
            margin: "0 0 3rem",
          }}
        >
          Alessa keeps going
        </p>
        <Btn href={inviteUrl} variant="solid" size="lg">
          Add Alessa to Your Server
        </Btn>

        {/* bottom ornament */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            marginTop: "3.5rem",
          }}
        >
          <div style={{ width: 48, height: 1, background: RULE }} />
          <Cross size={10} opacity={0.16} />
          <div style={{ width: 48, height: 1, background: RULE }} />
        </div>
      </section>

      {/* ────────────────────────────────────────── FOOTER */}
      <footer
        style={{
          borderTop: `1px solid ${RULE}`,
          padding: "1.8rem 7vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Cross size={8} opacity={0.32} />
          <span
            style={{
              fontFamily: DECO,
              fontWeight: 700,
              fontSize: "0.6rem",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: "rgba(245,240,236,0.22)",
            }}
          >
            Alessa
          </span>
        </div>
        <span
          style={{
            fontFamily: CURSIVE,
            fontStyle: "italic",
            fontSize: "0.8rem",
            color: "rgba(245,240,236,0.16)",
          }}
        >
          Free. No account needed. Made with ✝
        </span>
        <a
          href={inviteUrl}
          style={{
            fontFamily: SERIF,
            fontSize: "0.5rem",
            letterSpacing: "0.25em",
            textTransform: "uppercase",
            color: "rgba(245,240,236,0.22)",
            textDecoration: "none",
          }}
        >
          Add to Discord
        </a>
      </footer>
    </div>
  );
}
