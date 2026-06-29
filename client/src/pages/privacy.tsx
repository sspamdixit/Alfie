import { Link } from "wouter";

const VOID    = "#0c0c0c";
const INK     = "#f5f0ec";
const DIM     = "rgba(245,240,236,0.45)";
const RULE    = "rgba(245,240,236,0.09)";
const CRIMSON = "#c41e3a";
const SERIF   = "'Cinzel',serif";
const DECO    = "'Cinzel Decorative',serif";
const CURSIVE = "'Cormorant Garamond',serif";
const LACE: React.CSSProperties = {
  backgroundImage: `linear-gradient(rgba(12,12,12,0.97),rgba(12,12,12,0.97)),url('/lace-texture.webp')`,
  backgroundSize: "auto,420px auto",
  backgroundRepeat: "repeat",
  backgroundColor: VOID,
};

const SECTIONS = [
  {
    id: "who",
    title: "1. Who We Are",
    body: [
      "Alessa is a Discord music bot operated independently. For any privacy-related questions, contact us on Discord.",
      "This policy explains what data Alessa collects, why, and how long it's kept. It applies to anyone who adds Alessa to their server or uses it via a server they're a member of.",
    ],
  },
  {
    id: "collect",
    title: "2. What Data We Collect",
    body: [
      "Alessa collects the minimum necessary to function:",
    ],
    items: [
      "Guild IDs — to associate music queues, settings, and playlists with the correct server.",
      "User IDs and usernames — to attribute song requests, saved playlists, and listening stats.",
      "Channel IDs — to post now-playing messages and song-request confirmations.",
      "Song play records — title, artist, source URI, and the username of the requester. Stored to power the /stats command.",
      "Guild settings — request channel, crossfade preference. Stored so settings survive bot restarts.",
      "Dashboard OAuth data — if you log in to the dashboard via Discord, your Discord user ID, username, and avatar URL are stored in a session cookie. No password is stored.",
    ],
  },
  {
    id: "notcollect",
    title: "3. What We Do Not Collect",
    body: [
      "Alessa never collects or stores:",
    ],
    items: [
      "Message content — unless ENABLE_TTS is active (ambient TTS mode), in which case only the text of messages in the designated TTS channel is read temporarily to generate speech. It is never written to disk.",
      "Voice audio — Alessa does not record or store audio from voice channels.",
      "IP addresses.",
      "Payment or financial data.",
      "Personal information beyond what Discord provides in the interaction payload.",
    ],
  },
  {
    id: "use",
    title: "4. How We Use Your Data",
    body: [
      "Data is used exclusively to provide and improve Alessa's features:",
    ],
    items: [
      "Song play records are used to generate server and global listening statistics via /stats.",
      "Guild settings are used to restore preferences (crossfade, request channel) after bot restarts.",
      "Saved playlists are stored so users can reload them with /playlist load.",
      "Dashboard OAuth sessions allow server administrators to view bot status and manage settings.",
    ],
  },
  {
    id: "sharing",
    title: "5. Data Sharing",
    body: [
      "Your data is never sold, rented, or shared with advertisers or third parties for marketing purposes.",
      "Song metadata (titles, artists, URIs) is resolved via Lavalink nodes and public streaming APIs (YouTube, SoundCloud, Spotify). These services have their own privacy policies.",
      "Hosting providers (e.g. Render) may process data in the course of normal server operation.",
    ],
  },
  {
    id: "retention",
    title: "6. Data Retention",
    body: [
      "Song play records are kept indefinitely to power long-term listening statistics. Server administrators may request deletion of all records for their guild.",
      "Guild settings are kept until the bot is removed from the server, at which point they are no longer actively used (they may be cleaned up periodically).",
      "Dashboard sessions expire after the browser session ends or after 30 days, whichever comes first.",
    ],
  },
  {
    id: "rights",
    title: "7. Your Rights",
    body: [
      "You may request access to, correction of, or deletion of data associated with your Discord user ID or your server's guild ID at any time by contacting us on Discord.",
      "Server administrators may request deletion of all song play records and settings for their server.",
      "We will respond to requests within 30 days.",
    ],
  },
  {
    id: "security",
    title: "8. Security",
    body: [
      "Database credentials are stored as environment secrets, never in source code.",
      "Dashboard authentication tokens are generated with cryptographically random bytes. Admin passwords are compared using constant-time equality to prevent timing attacks.",
      "Session cookies are signed with a secret key and set as HttpOnly and Secure in production.",
    ],
  },
  {
    id: "children",
    title: "9. Children",
    body: [
      "Alessa is not directed at children under 13. Discord's own minimum age requirement applies. If you believe a child under 13 has data stored by Alessa, contact us for immediate deletion.",
    ],
  },
  {
    id: "changes",
    title: "10. Changes to This Policy",
    body: [
      "We may update this policy from time to time. The effective date at the top of this page will reflect the most recent revision. Continued use of Alessa after changes constitutes acceptance of the updated policy.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div style={{ ...LACE, minHeight: "100vh", fontFamily: SERIF }}>
      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 5vw",
        background: "rgba(12,12,12,0.94)",
        borderBottom: `1px solid ${RULE}`,
        backdropFilter: "blur(20px)",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
            <rect x="5" y="0" width="2" height="12" fill={CRIMSON} />
            <rect x="0" y="5" width="12" height="2" fill={CRIMSON} />
          </svg>
          <span style={{ fontFamily: DECO, fontWeight: 700, fontSize: "0.68rem", letterSpacing: "0.2em", textTransform: "uppercase", color: INK }}>
            Alessa
          </span>
        </Link>
        <Link href="/" style={{ fontFamily: SERIF, fontSize: "0.56rem", letterSpacing: "0.18em", textTransform: "uppercase", color: DIM, textDecoration: "none" }}>
          ← Back
        </Link>
      </nav>

      {/* CONTENT */}
      <div style={{ maxWidth: 740, margin: "0 auto", padding: "4rem 5vw 6rem" }}>
        {/* Header */}
        <div style={{ marginBottom: "3rem", borderBottom: `1px solid ${RULE}`, paddingBottom: "2rem" }}>
          <p style={{ fontFamily: SERIF, fontSize: "0.49rem", letterSpacing: "0.4em", textTransform: "uppercase", color: CRIMSON, marginBottom: "1rem" }}>
            Legal
          </p>
          <h1 style={{ fontFamily: DECO, fontWeight: 900, fontSize: "clamp(2rem,5vw,3.2rem)", letterSpacing: "0.04em", textTransform: "uppercase", color: INK, margin: "0 0 0.75rem", lineHeight: 1 }}>
            Privacy Policy
          </h1>
          <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.9rem", color: DIM, margin: 0 }}>
            Effective date: 29 June 2026 &nbsp;·&nbsp; Version 1.0
          </p>
        </div>

        {/* Notice box */}
        <div style={{ border: `1px solid rgba(196,30,58,0.25)`, background: "rgba(196,30,58,0.05)", padding: "1rem 1.25rem", marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.92rem", color: DIM, margin: 0, lineHeight: 1.75 }}>
            <strong style={{ color: INK, fontStyle: "normal" }}>Short version:</strong> Alessa stores song play records, guild settings, and saved playlists so its features work. Your data is never sold. You can request deletion at any time.
          </p>
        </div>

        {/* TOC */}
        <div style={{ background: "rgba(245,240,236,0.03)", border: `1px solid ${RULE}`, padding: "1.25rem 1.5rem", marginBottom: "3rem" }}>
          <p style={{ fontFamily: SERIF, fontSize: "0.49rem", letterSpacing: "0.3em", textTransform: "uppercase", color: DIM, marginBottom: "0.75rem" }}>Contents</p>
          <ol style={{ paddingLeft: "1.25rem", margin: 0 }}>
            {SECTIONS.map((s) => (
              <li key={s.id} style={{ marginBottom: "0.3rem" }}>
                <a href={`#${s.id}`} style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.9rem", color: DIM, textDecoration: "none" }}>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </div>

        {/* Sections */}
        {SECTIONS.map((s) => (
          <section key={s.id} id={s.id} style={{ marginBottom: "2.75rem" }}>
            <h2 style={{
              fontFamily: SERIF, fontSize: "0.58rem", fontWeight: 700, letterSpacing: "0.22em",
              textTransform: "uppercase", color: INK, margin: "0 0 1rem",
              borderLeft: `2px solid ${CRIMSON}`, paddingLeft: "0.75rem",
            }}>
              {s.title}
            </h2>
            {s.body.map((b, i) => (
              <p key={i} style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.95rem", color: DIM, lineHeight: 1.8, margin: "0 0 0.85rem" }}>
                {b}
              </p>
            ))}
            {s.items && (
              <ul style={{ paddingLeft: "1.4rem", margin: "0.5rem 0 0" }}>
                {s.items.map((item, i) => (
                  <li key={i} style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.92rem", color: DIM, lineHeight: 1.75, marginBottom: "0.5rem" }}>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${RULE}`, padding: "1.5rem 5vw", display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.82rem", color: "rgba(245,240,236,0.2)" }}>
          © 2026 Alessa
        </span>
        <Link href="/terms" style={{ fontFamily: SERIF, fontSize: "0.5rem", letterSpacing: "0.15em", textTransform: "uppercase", color: DIM, textDecoration: "none" }}>Terms</Link>
        <Link href="/privacy" style={{ fontFamily: SERIF, fontSize: "0.5rem", letterSpacing: "0.15em", textTransform: "uppercase", color: CRIMSON, textDecoration: "none" }}>Privacy</Link>
      </footer>
    </div>
  );
}
