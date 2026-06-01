import { useEffect, useState, useRef, useCallback } from "react";

const LACE_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'>
  <line x1='0' y1='0' x2='80' y2='80' stroke='black' stroke-width='0.9' opacity='0.14'/>
  <line x1='80' y1='0' x2='0' y2='80' stroke='black' stroke-width='0.9' opacity='0.14'/>
  <line x1='0' y1='40' x2='40' y2='0' stroke='black' stroke-width='0.6' opacity='0.1'/>
  <line x1='40' y1='0' x2='80' y2='40' stroke='black' stroke-width='0.6' opacity='0.1'/>
  <line x1='80' y1='40' x2='40' y2='80' stroke='black' stroke-width='0.6' opacity='0.1'/>
  <line x1='40' y1='80' x2='0' y2='40' stroke='black' stroke-width='0.6' opacity='0.1'/>
  <circle cx='40' cy='40' r='7' fill='none' stroke='black' stroke-width='0.9' opacity='0.18'/>
  <circle cx='40' cy='40' r='3' fill='none' stroke='black' stroke-width='0.7' opacity='0.16'/>
  <circle cx='40' cy='40' r='1.4' fill='black' opacity='0.22'/>
  <path d='M40,33 Q44,36.5 40,40 Q36,36.5 40,33Z' fill='black' opacity='0.1'/>
  <path d='M40,47 Q44,43.5 40,40 Q36,43.5 40,47Z' fill='black' opacity='0.1'/>
  <path d='M33,40 Q36.5,44 40,40 Q36.5,36 33,40Z' fill='black' opacity='0.1'/>
  <path d='M47,40 Q43.5,44 40,40 Q43.5,36 47,40Z' fill='black' opacity='0.1'/>
  <circle cx='0' cy='0' r='2.8' fill='black' opacity='0.22'/>
  <circle cx='80' cy='0' r='2.8' fill='black' opacity='0.22'/>
  <circle cx='0' cy='80' r='2.8' fill='black' opacity='0.22'/>
  <circle cx='80' cy='80' r='2.8' fill='black' opacity='0.22'/>
  <circle cx='40' cy='0' r='2.2' fill='black' opacity='0.18'/>
  <circle cx='0' cy='40' r='2.2' fill='black' opacity='0.18'/>
  <circle cx='80' cy='40' r='2.2' fill='black' opacity='0.18'/>
  <circle cx='40' cy='80' r='2.2' fill='black' opacity='0.18'/>
</svg>`;

const LACE_URL = `url("data:image/svg+xml,${encodeURIComponent(LACE_SVG)}")`;

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
        background: "#fff",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        display: "flex",
        position: "relative",
        backgroundImage: LACE_URL,
        backgroundSize: "80px 80px",
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
