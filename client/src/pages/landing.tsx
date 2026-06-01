import { useEffect, useState, useRef, useCallback } from "react";

export default function LandingPage() {
  const [inviteUrl, setInviteUrl] = useState("/api/public/invite-url");
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [btnHover, setBtnHover] = useState(false);
  const rafRef = useRef<number | null>(null);
  const targetRef = useRef({ tx: 0, ty: 0, ox: 0, oy: 0 });
  const currentRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  useEffect(() => {
    fetch("/api/public/invite-url")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.url) setInviteUrl(d.url); })
      .catch(() => {});
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY, currentTarget } = e;
    const { width, height, left, top } = currentTarget.getBoundingClientRect();
    const nx = (clientX - left) / width - 0.5;
    const ny = (clientY - top) / height - 0.5;
    targetRef.current = { tx: ny * 14, ty: nx * -14, ox: nx * 18, oy: ny * 12 };
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

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        display: "flex",
        position: "relative",
        backgroundImage: `linear-gradient(rgba(255,255,255,0.88), rgba(255,255,255,0.88)), url('/lace-texture.webp')`,
        backgroundSize: "auto, 420px auto",
        backgroundRepeat: "repeat",
        backgroundColor: "#fff",
      }}
    >
      {/* Left — text */}
      <div style={{
        flex: "0 0 48%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        paddingLeft: "7vw",
        zIndex: 2,
        position: "relative",
      }}>

        {/* Decorative top rule */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "2rem" }}>
          <div style={{ width: 32, height: 1, background: "rgba(0,0,0,0.25)" }} />
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="4" y="0" width="2" height="10" fill="black" opacity="0.35"/>
            <rect x="0" y="4" width="10" height="2" fill="black" opacity="0.35"/>
          </svg>
          <div style={{ width: 32, height: 1, background: "rgba(0,0,0,0.25)" }} />
        </div>

        {/* Name */}
        <h1 style={{
          fontFamily: "'Cinzel', serif",
          fontWeight: 700,
          fontSize: "clamp(3.5rem, 7vw, 6.5rem)",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: "#0a0a0a",
          margin: "0 0 0.1em",
          lineHeight: 1,
        }}>
          Alessa
        </h1>

        {/* Sub label */}
        <p style={{
          fontFamily: "'Cinzel', serif",
          fontWeight: 400,
          fontSize: "0.6rem",
          letterSpacing: "0.45em",
          textTransform: "uppercase",
          color: "rgba(0,0,0,0.35)",
          margin: "0.9rem 0 2.8rem",
        }}>
          Discord Music Bot
        </p>

        {/* CTA button */}
        <div>
          <a
            href={inviteUrl}
            onMouseEnter={() => setBtnHover(true)}
            onMouseLeave={() => setBtnHover(false)}
            style={{
              fontFamily: "'Cinzel', serif",
              fontWeight: 600,
              fontSize: "0.68rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: btnHover ? "#fff" : "#0a0a0a",
              background: btnHover ? "#0a0a0a" : "transparent",
              border: "1.5px solid #0a0a0a",
              padding: "13px 36px",
              textDecoration: "none",
              display: "inline-block",
              transition: "background 0.25s, color 0.25s",
              position: "relative",
            }}
          >
            Add to Discord
          </a>
        </div>

        {/* Decorative bottom rule */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "2.5rem" }}>
          <div style={{ width: 32, height: 1, background: "rgba(0,0,0,0.25)" }} />
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="4" y="0" width="2" height="10" fill="black" opacity="0.35"/>
            <rect x="0" y="4" width="10" height="2" fill="black" opacity="0.35"/>
          </svg>
          <div style={{ width: 32, height: 1, background: "rgba(0,0,0,0.25)" }} />
        </div>
      </div>

      {/* Right — cross */}
      <div style={{
        flex: "0 0 52%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        perspective: "900px",
        position: "relative",
        zIndex: 1,
      }}>
        <img
          src="/cross-transparent.png"
          alt=""
          draggable={false}
          style={{
            width: "clamp(300px, 44vw, 640px)",
            height: "auto",
            userSelect: "none",
            pointerEvents: "none",
            transform: `perspective(900px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translate(${offset.x * 0.5}px, ${offset.y * 0.5}px)`,
            willChange: "transform",
            filter: "drop-shadow(0 8px 40px rgba(0,0,0,0.18)) drop-shadow(0 2px 8px rgba(0,0,0,0.12))",
          }}
        />
      </div>
    </div>
  );
}
