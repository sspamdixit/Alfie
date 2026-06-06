import { useEffect, useState } from "react";
import { useLocation } from "wouter";

// ── palette (matches landing) ──────────────────────────────────────────────
const VOID        = "#0c0c0c";
const INK         = "#f5f0ec";
const DIM         = "rgba(245,240,236,0.45)";
const RULE        = "rgba(245,240,236,0.09)";
const CRIMSON     = "#c41e3a";
const CRIMSON_MID = "rgba(196,30,58,0.55)";

const LACE: React.CSSProperties = {
  backgroundImage: `linear-gradient(rgba(12,12,12,0.94),rgba(12,12,12,0.94)),url('/lace-texture.webp')`,
  backgroundSize: "auto,420px auto",
  backgroundRepeat: "repeat",
  backgroundColor: VOID,
};

const SERIF   = "'Cinzel',serif";
const DECO    = "'Cinzel Decorative',serif";
const CURSIVE = "'Cormorant Garamond',serif";

interface DiscordUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
  avatarUrl: string;
}
interface ManagedGuild {
  id: string;
  name: string;
  icon: string | null;
  iconUrl: string | null;
  owner: boolean;
  permissions: string;
  hasAlessa: boolean;
}

const Cross = ({ size = 10, opacity = 1 }: { size?: number; opacity?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ opacity, flexShrink: 0, display: "block" }}>
    <rect x="5" y="0" width="2" height="12" fill={CRIMSON} />
    <rect x="0" y="5" width="12" height="2" fill={CRIMSON} />
  </svg>
);

export default function ServersPage() {
  const [, navigate] = useLocation();
  const [user,      setUser]      = useState<DiscordUser | null>(null);
  const [guilds,    setGuilds]    = useState<ManagedGuild[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string>("");

  useEffect(() => {
    Promise.all([
      fetch("/api/oauth/me",           { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch("/api/public/guilds",      { credentials: "include" }).then(r => r.ok ? r.json() : null),
      fetch("/api/public/invite-url",  { credentials: "include" }).then(r => r.ok ? r.json() : null),
    ])
      .then(([me, guildData, inviteData]) => {
        if (!me?.id) { navigate("/"); return; }
        setUser(me);
        setGuilds(guildData?.guilds ?? []);
        setInviteUrl(inviteData?.url ?? "");
      })
      .catch(() => setError("Failed to load. Please try again."))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogout = async () => {
    await fetch("/api/oauth/logout", { method: "POST", credentials: "include" });
    navigate("/");
  };

  const handleAdd = (guildId: string) => {
    if (!inviteUrl) return;
    window.open(`${inviteUrl}&guild_id=${guildId}&disable_guild_select=true`, "_blank");
  };

  const activeGuilds = guilds.filter(g => g.hasAlessa);
  const otherGuilds  = guilds.filter(g => !g.hasAlessa);

  if (loading) {
    return (
      <div style={{ ...LACE, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.2rem" }}>
          <Cross size={18} opacity={0.5} />
          <span style={{ fontFamily: SERIF, fontSize: "0.52rem", letterSpacing: "0.4em", textTransform: "uppercase", color: "rgba(245,240,236,0.25)" }}>
            Loading
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...LACE, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <Cross size={18} opacity={0.4} />
          <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "1rem", color: DIM, margin: "1.2rem 0 1.8rem" }}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{ fontFamily: SERIF, fontSize: "0.52rem", letterSpacing: "0.25em", textTransform: "uppercase", color: "rgba(196,30,58,0.7)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline", textUnderlineOffset: 4 }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...LACE, minHeight: "100vh", fontFamily: SERIF }}>

      {/* ── NAV ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 5vw",
        background: "rgba(12,12,12,0.93)",
        borderBottom: `1px solid ${RULE}`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}>
        {/* back */}
        <button
          onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
            <path d="M5 1L1 5l4 4M1 5h10" stroke={DIM} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <Cross size={9} opacity={0.65} />
            <span style={{ fontFamily: DECO, fontWeight: 700, fontSize: "0.62rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(245,240,236,0.55)" }}>
              Alessa
            </span>
          </span>
        </button>

        {/* user */}
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
            {user.avatarUrl && (
              <img
                src={user.avatarUrl}
                alt=""
                style={{ width: 28, height: 28, borderRadius: "50%", border: `1px solid ${RULE}`, flexShrink: 0 }}
              />
            )}
            <span style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.9rem", color: DIM }}>
              {user.global_name ?? user.username}
            </span>
            <button
              onClick={handleLogout}
              style={{ fontFamily: SERIF, fontSize: "0.5rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(245,240,236,0.3)", background: "none", border: "none", cursor: "pointer", padding: 0, transition: "color 0.18s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "rgba(245,240,236,0.65)")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(245,240,236,0.3)")}
            >
              Sign out
            </button>
          </div>
        )}
      </nav>

      {/* ── MAIN ── */}
      <main style={{ paddingTop: 56 }}>

        {/* page header */}
        <div style={{ padding: "5vh 7vw 3.5vh", borderBottom: `1px solid ${RULE}` }}>
          {/* top hairline */}
          <div style={{ height: 1, background: `linear-gradient(90deg,${CRIMSON_MID},transparent)`, marginBottom: "2.5rem", width: "clamp(80px,10vw,160px)" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "0.7rem" }}>
            <Cross size={9} opacity={0.65} />
            <span style={{ fontFamily: SERIF, fontSize: "0.49rem", letterSpacing: "0.52em", textTransform: "uppercase", color: "rgba(196,30,58,0.6)" }}>
              Your servers
            </span>
          </div>
          <h1 style={{ fontFamily: DECO, fontWeight: 700, fontSize: "clamp(1.4rem,2.5vw,2.2rem)", letterSpacing: "0.06em", textTransform: "uppercase", color: INK, margin: "0 0 0.5rem" }}>
            Server Dashboard
          </h1>
          <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.95rem", color: DIM, margin: 0, lineHeight: 1.7 }}>
            Servers where you hold Manage Server permission.
          </p>
        </div>

        {/* content */}
        <div style={{ padding: "4vh 7vw 8vh" }}>

          {guilds.length === 0 && (
            <div style={{ paddingTop: "6vh", display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem" }}>
              <Cross size={22} opacity={0.2} />
              <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "1rem", color: "rgba(245,240,236,0.22)", margin: 0 }}>
                No servers with Manage Server permission found.
              </p>
            </div>
          )}

          {activeGuilds.length > 0 && (
            <section style={{ marginBottom: "4rem" }}>
              <SectionLabel label="Alessa is here" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "1px", background: RULE, border: `1px solid ${RULE}` }}>
                {activeGuilds.map(guild => (
                  <GuildCard key={guild.id} guild={guild} active onAdd={() => handleAdd(guild.id)} />
                ))}
              </div>
            </section>
          )}

          {otherGuilds.length > 0 && (
            <section>
              <SectionLabel label="Add Alessa" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "1px", background: RULE, border: `1px solid ${RULE}` }}>
                {otherGuilds.map(guild => (
                  <GuildCard key={guild.id} guild={guild} active={false} onAdd={() => handleAdd(guild.id)} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "1rem" }}>
      <Cross size={8} opacity={0.55} />
      <span style={{ fontFamily: "'Cinzel',serif", fontSize: "0.48rem", letterSpacing: "0.5em", textTransform: "uppercase", color: "rgba(196,30,58,0.55)" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: RULE }} />
    </div>
  );
}

function GuildCard({
  guild,
  active,
  onAdd,
}: {
  guild: ManagedGuild;
  active: boolean;
  onAdd: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "1.6rem 1.5rem",
        background: hov
          ? active
            ? "rgba(196,30,58,0.06)"
            : "rgba(245,240,236,0.025)"
          : VOID,
        boxShadow: active
          ? `inset 3px 0 0 0 ${hov ? CRIMSON : "rgba(196,30,58,0.45)"}`
          : "none",
        transition: "background 0.2s, box-shadow 0.2s",
        display: "flex",
        flexDirection: "column",
        gap: "1.2rem",
      }}
    >
      {/* guild info */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
        {guild.iconUrl ? (
          <img
            src={guild.iconUrl}
            alt={guild.name}
            style={{ width: 40, height: 40, borderRadius: 6, flexShrink: 0, border: `1px solid ${RULE}` }}
          />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: 6, border: `1px solid ${RULE}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: "rgba(245,240,236,0.03)" }}>
            <span style={{ fontFamily: SERIF, fontSize: "0.7rem", fontWeight: 700, color: DIM, letterSpacing: "0.05em" }}>
              {guild.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontFamily: SERIF, fontSize: "0.74rem", fontWeight: 700, letterSpacing: "0.06em", color: INK, margin: "0 0 0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {guild.name}
          </p>
          <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.8rem", color: active ? "rgba(196,30,58,0.65)" : DIM, margin: 0 }}>
            {active ? "Active" : "Not added"}
          </p>
        </div>
      </div>

      {/* action button */}
      <AddButton active={active} onClick={onAdd} />
    </div>
  );
}

function AddButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        fontFamily: SERIF,
        fontWeight: 600,
        fontSize: "0.5rem",
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        color: INK,
        background: active
          ? hov ? CRIMSON : "transparent"
          : hov ? CRIMSON : "transparent",
        border: `1.5px solid ${hov ? CRIMSON : active ? "rgba(196,30,58,0.4)" : RULE}`,
        padding: "9px 0",
        width: "100%",
        cursor: "pointer",
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      {active ? "Add again →" : "Add Alessa"}
    </button>
  );
}
