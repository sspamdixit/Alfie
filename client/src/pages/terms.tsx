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
    id: "acceptance",
    title: "1. Acceptance of Terms",
    body: [
      "By adding Alessa to a Discord server or using it as a member of a server, you agree to these Terms of Service and our Privacy Policy. If you do not agree, remove Alessa from your server or stop using it.",
      "These terms form a binding agreement between you and the operator of the Alessa service.",
    ],
  },
  {
    id: "service",
    title: "2. Description of the Service",
    body: [
      "Alessa is a Discord music bot that provides:",
    ],
    items: [
      "Music playback from YouTube, SoundCloud, Spotify, and other public sources via Lavalink.",
      "Queue management, shuffle, loop, autoplay, and saved playlists.",
      "DJ / Rave mode with genre-based automated sessions.",
      "Text-to-speech (TTS) in voice channels when enabled.",
      "A web dashboard for server administrators to view bot status and manage settings.",
      "Listening statistics stored per server and globally.",
    ],
    body2: [
      "Alessa operates as a Discord application and is subject to Discord's Terms of Service, Community Guidelines, and Developer Policy. Use of Alessa must comply with all Discord policies.",
    ],
  },
  {
    id: "eligibility",
    title: "3. Eligibility",
    body: [
      "You must be at least 13 years of age (or the minimum age required to use Discord in your country) to use Alessa. By using Alessa, you confirm you meet this requirement.",
      "Server administrators who add Alessa and access its dashboard confirm they have the authority to do so under applicable law.",
    ],
  },
  {
    id: "admin",
    title: "4. Server Administrator Obligations",
    body: [
      "By adding Alessa to a server, you as the server administrator accept the following responsibilities:",
    ],
    items: [
      "Disclosure: Inform your members that a music bot is present and that song request records may be stored for statistics purposes.",
      "Lawful use: Use Alessa only in ways that comply with applicable law and Discord's policies.",
      "No abuse: Do not use Alessa to harass, spam, or harm any individual or community.",
      "Appropriate configuration: Configure song request channels and DJ roles responsibly. You are responsible for how Alessa is configured in your server.",
    ],
  },
  {
    id: "prohibited",
    title: "5. Prohibited Uses",
    body: [
      "The following uses are strictly prohibited:",
    ],
    items: [
      "Using Alessa to play or distribute copyrighted content in violation of applicable law.",
      "Attempting to exploit, reverse-engineer, or otherwise circumvent Alessa's rate limits or security measures.",
      "Using Alessa in servers that violate Discord's Community Guidelines.",
      "Automating interactions with Alessa's commands to cause excessive load.",
      "Using TTS features to harass, threaten, or broadcast harmful content.",
    ],
  },
  {
    id: "copyright",
    title: "6. Copyright and Content",
    body: [
      "Alessa plays music by resolving public URLs through Lavalink and third-party streaming services. Alessa does not host or distribute audio files.",
      "Responsibility for the legality of content played lies with the users who request it. The operators of Alessa are not liable for copyright infringement by users.",
      "If you are a rights holder and believe Alessa is being used to infringe your copyright, contact us on Discord.",
    ],
  },
  {
    id: "ip",
    title: "7. Intellectual Property",
    body: [
      "Alessa, its name, logo, and source code are the property of the operator. You may not reproduce, distribute, or create derivative works without permission.",
      "Music, track titles, artist names, and album art served by Alessa belong to their respective rights holders.",
    ],
  },
  {
    id: "privacy",
    title: "8. Data and Privacy",
    body: [
      "Our Privacy Policy describes what data Alessa collects and how it is used. By using Alessa, you consent to data handling described in that policy.",
    ],
  },
  {
    id: "disclaimer",
    title: "9. Disclaimers and Limitation of Liability",
    body: [
      'Alessa is provided "as is" without warranty of any kind. We do not guarantee uninterrupted service, accuracy of lyrics or metadata, or availability of any specific music source.',
      "To the maximum extent permitted by applicable law, the operators of Alessa shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the service.",
      "Alessa relies on third-party Lavalink nodes and streaming APIs. We are not responsible for the availability, content, or actions of those third-party services.",
    ],
  },
  {
    id: "termination",
    title: "10. Suspension and Termination",
    body: [
      "We reserve the right to terminate or suspend Alessa's service in a specific server at any time, without notice, if we determine that the server is violating these terms or Discord's policies.",
      "You may terminate your use of Alessa at any time by removing the bot from your server via Discord's server settings.",
    ],
  },
  {
    id: "changes",
    title: "11. Changes to These Terms",
    body: [
      "We may update these terms from time to time. The effective date at the top of this page reflects the most recent revision. Continued use of Alessa after changes constitutes acceptance of the updated terms.",
    ],
  },
  {
    id: "contact",
    title: "12. Contact",
    body: [
      "For any questions about these terms, data deletion requests, or abuse reports, contact us on Discord.",
    ],
  },
];

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.9rem", color: DIM, margin: 0 }}>
            Effective date: 29 June 2026 &nbsp;·&nbsp; Version 1.0
          </p>
        </div>

        {/* Notice box */}
        <div style={{ border: `1px solid rgba(196,30,58,0.25)`, background: "rgba(196,30,58,0.05)", padding: "1rem 1.25rem", marginBottom: "2.5rem" }}>
          <p style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.92rem", color: DIM, margin: 0, lineHeight: 1.75 }}>
            <strong style={{ color: INK, fontStyle: "normal" }}>Plain summary:</strong> By adding Alessa to your server or using it, you agree to these terms. Play music responsibly. Server administrators are responsible for how Alessa is configured in their community.
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
              <ul style={{ paddingLeft: "1.4rem", margin: "0.5rem 0 0.85rem" }}>
                {s.items.map((item, i) => (
                  <li key={i} style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.92rem", color: DIM, lineHeight: 1.75, marginBottom: "0.5rem" }}>
                    {item}
                  </li>
                ))}
              </ul>
            )}
            {(s as any).body2?.map((b: string, i: number) => (
              <p key={`b2-${i}`} style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.95rem", color: DIM, lineHeight: 1.8, margin: "0 0 0.85rem" }}>
                {b}
              </p>
            ))}
          </section>
        ))}
      </div>

      {/* FOOTER */}
      <footer style={{ borderTop: `1px solid ${RULE}`, padding: "1.5rem 5vw", display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontFamily: CURSIVE, fontStyle: "italic", fontSize: "0.82rem", color: "rgba(245,240,236,0.2)" }}>
          © 2026 Alessa
        </span>
        <Link href="/terms" style={{ fontFamily: SERIF, fontSize: "0.5rem", letterSpacing: "0.15em", textTransform: "uppercase", color: CRIMSON, textDecoration: "none" }}>Terms</Link>
        <Link href="/privacy" style={{ fontFamily: SERIF, fontSize: "0.5rem", letterSpacing: "0.15em", textTransform: "uppercase", color: DIM, textDecoration: "none" }}>Privacy</Link>
      </footer>
    </div>
  );
}
