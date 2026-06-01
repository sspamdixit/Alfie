import { useEffect, useState } from "react";
import crossImg from "@assets/s11728_chrome_hearts_cross_isolated_on_white_background_-sty_7_1780310861273.png";

export default function LandingPage() {
  const [inviteUrl, setInviteUrl] = useState("/api/public/invite-url");

  useEffect(() => {
    fetch("/api/public/invite-url")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.url) setInviteUrl(d.url); })
      .catch(() => {});
  }, []);

  return (
    <div style={{
      background: "#000",
      color: "#fff",
      height: "100vh",
      width: "100vw",
      overflow: "hidden",
      display: "flex",
      position: "relative",
      fontFamily: "'Cinzel', serif",
    }}>

      {/* Left — cross */}
      <div style={{
        flex: "0 0 55%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingLeft: "4vw",
      }}>
        <img
          src={crossImg}
          alt=""
          draggable={false}
          style={{
            width: "clamp(320px, 42vw, 620px)",
            height: "auto",
            userSelect: "none",
            pointerEvents: "none",
            filter: "drop-shadow(0 0 80px rgba(160,160,190,0.15))",
          }}
        />
      </div>

      {/* Right — name + button */}
      <div style={{
        flex: "0 0 45%",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        justifyContent: "flex-start",
        paddingTop: "5vh",
        paddingRight: "5vw",
      }}>
        {/* Name — top right */}
        <h1 style={{
          fontFamily: "'Cinzel', serif",
          fontWeight: 400,
          fontSize: "clamp(2.8rem, 5vw, 5rem)",
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#fff",
          margin: 0,
          lineHeight: 1,
        }}>
          Alessa
        </h1>
      </div>

      {/* Add to Discord — vertically centred on right side */}
      <div style={{
        position: "absolute",
        right: "5vw",
        top: "50%",
        transform: "translateY(-50%)",
      }}>
        <a
          href={inviteUrl}
          style={{
            fontFamily: "'Cinzel', serif",
            fontWeight: 600,
            fontSize: "0.75rem",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.35)",
            padding: "14px 32px",
            textDecoration: "none",
            display: "block",
            transition: "all 0.2s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = "#fff";
            e.currentTarget.style.color = "#000";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "#fff";
          }}
        >
          Add to Discord
        </a>
      </div>
    </div>
  );
}
