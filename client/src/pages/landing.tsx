import { useEffect, useState } from "react";

const MUSIC_FEATURES = [
  {
    num: "01",
    title: "YouTube & Spotify",
    desc: "Stream anything. Paste a link, search a name, or drop a playlist. Alfie handles the rest.",
  },
  {
    num: "02",
    title: "Smart queue",
    desc: "Add tracks, skip by vote, shuffle, loop, view history. Full queue control from Discord.",
  },
  {
    num: "03",
    title: "Now playing",
    desc: "Live progress bar, album art, and on-demand lyrics. Always know what's on.",
  },
  {
    num: "04",
    title: "Rave mode",
    desc: "BPM-matched energy builds, auto crossfade, and mood-aware discovery for the long sessions.",
  },
  {
    num: "05",
    title: "Voice commands",
    desc: "Play, pause, skip, volume — all slash commands. Nothing to install, nothing to configure.",
  },
  {
    num: "06",
    title: "Text-to-speech",
    desc: "Drop a message into voice with /speak. Announcements, jokes, chaos — your call.",
  },
];

export default function LandingPage() {
  const [inviteUrl, setInviteUrl] = useState<string>("/api/oauth/discord");
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    fetch("/api/public/invite-url")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.url) setInviteUrl(d.url); })
      .catch(() => {});
  }, []);

  const handleAdd = () => { window.location.href = inviteUrl; };

  return (
    <div
      className="min-h-screen text-[#f0ecf5]"
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: "#080008",
      }}
    >
      {/* Ambient glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 75% 0%, rgba(180,0,60,0.12) 0%, transparent 60%), radial-gradient(ellipse 40% 60% at 0% 100%, rgba(100,0,80,0.08) 0%, transparent 60%)",
        }}
      />

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/[0.05] bg-[#080008]/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <span
            style={{ fontFamily: "'Architex', cursive", letterSpacing: "0.05em" }}
            className="text-lg text-white"
          >
            alfie
          </span>
          <button
            onClick={handleAdd}
            className="px-4 py-1.5 text-sm font-semibold rounded-md transition-all"
            style={{
              background: "rgba(200,0,50,0.85)",
              color: "#fff",
              border: "1px solid rgba(255,80,100,0.3)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(220,0,55,0.95)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(200,0,50,0.85)")}
          >
            Add to Discord
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Misa — right side */}
        <div
          className="absolute right-0 bottom-0 pointer-events-none select-none"
          style={{ width: "clamp(280px, 45vw, 560px)" }}
        >
          {!imgError ? (
            <img
              src="/misa.jpg"
              alt="Misa Amane"
              className="w-full h-auto object-contain object-bottom"
              style={{
                maxHeight: "92vh",
                filter: "drop-shadow(0 0 40px rgba(200,0,60,0.25))",
                maskImage: "linear-gradient(to top, transparent 0%, black 12%)",
                WebkitMaskImage: "linear-gradient(to top, transparent 0%, black 12%)",
              }}
              onError={() => setImgError(true)}
            />
          ) : (
            /* Fallback silhouette */
            <div
              className="w-full"
              style={{
                height: "min(92vh, 700px)",
                background: "linear-gradient(160deg, rgba(160,0,50,0.15) 0%, transparent 60%)",
                borderLeft: "1px solid rgba(200,0,60,0.12)",
                maskImage: "linear-gradient(to top, transparent 0%, black 20%)",
              }}
            />
          )}
          {/* Fade edge */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(to right, #080008 0%, transparent 25%), linear-gradient(to top, #080008 0%, transparent 15%)",
            }}
          />
        </div>

        {/* Left content */}
        <div className="relative z-10 max-w-5xl mx-auto w-full px-6 pt-28 pb-24">
          <div className="max-w-[520px]">
            <p
              className="text-xs tracking-[0.25em] uppercase mb-6"
              style={{ color: "rgba(220,60,90,0.8)" }}
            >
              Discord music bot
            </p>

            <h1
              style={{
                fontFamily: "'Architex', cursive",
                lineHeight: 0.95,
                fontSize: "clamp(5rem, 12vw, 9rem)",
              }}
              className="text-white mb-8 -ml-1"
            >
              Alfie.
            </h1>

            <p className="text-lg leading-relaxed mb-10" style={{ color: "rgba(240,220,235,0.55)" }}>
              A music bot that plays what you want, remembers nothing embarrassing about you, and never talks back.
              Just the queue, the vibes, and Misa holding it together.
            </p>

            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleAdd}
                className="px-6 py-3 text-sm font-bold rounded-lg transition-all"
                style={{
                  background: "rgba(200,0,50,0.9)",
                  color: "#fff",
                  border: "1px solid rgba(255,80,100,0.35)",
                  boxShadow: "0 0 30px rgba(200,0,50,0.3)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(225,0,60,1)";
                  e.currentTarget.style.boxShadow = "0 0 45px rgba(220,0,55,0.45)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(200,0,50,0.9)";
                  e.currentTarget.style.boxShadow = "0 0 30px rgba(200,0,50,0.3)";
                }}
              >
                Add Alfie to your server
              </button>
              <a
                href="/admin"
                className="px-6 py-3 text-sm font-medium rounded-lg transition-all"
                style={{
                  color: "rgba(255,255,255,0.35)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.65)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "rgba(255,255,255,0.35)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                }}
              >
                Dashboard
              </a>
            </div>

            <p
              style={{ fontFamily: "'Caveat', cursive", color: "rgba(220,60,90,0.45)" }}
              className="mt-5 text-base tracking-wide"
            >
              free to add. no credit card. misa approves.
            </p>
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: "rgba(200,0,60,0.12)" }} />

      {/* Features */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs tracking-widest uppercase mb-14" style={{ color: "rgba(220,60,90,0.6)" }}>
            what alfie does
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-10">
            {MUSIC_FEATURES.map((f) => (
              <div key={f.num}>
                <p
                  style={{ fontFamily: "'Caveat', cursive", color: "rgba(200,0,60,0.4)" }}
                  className="text-lg mb-1.5"
                >
                  {f.num}
                </p>
                <h3 className="text-sm font-semibold text-white mb-2">{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(240,220,235,0.4)" }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Divider */}
      <div className="border-t" style={{ borderColor: "rgba(200,0,60,0.12)" }} />

      {/* CTA strip */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-8">
          <div>
            <h2
              style={{ fontFamily: "'Architex', cursive" }}
              className="text-3xl text-white mb-2"
            >
              add alfie.
            </h2>
            <p className="text-sm" style={{ color: "rgba(240,220,235,0.35)" }}>
              Pick a server. She'll handle the music.
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="shrink-0 px-6 py-3 text-sm font-bold rounded-lg transition-all"
            style={{
              background: "rgba(200,0,50,0.85)",
              color: "#fff",
              border: "1px solid rgba(255,80,100,0.3)",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(220,0,55,0.95)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(200,0,50,0.85)")}
          >
            Get started →
          </button>
        </div>
      </section>

      {/* Footer */}
      <div className="border-t" style={{ borderColor: "rgba(200,0,60,0.08)" }} />
      <footer className="py-7 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span
            style={{ fontFamily: "'Caveat', cursive", color: "rgba(240,220,235,0.2)" }}
            className="text-base"
          >
            alfie. your discord DJ.
          </span>
          <a href="/admin" className="text-xs transition-colors" style={{ color: "rgba(240,220,235,0.2)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(240,220,235,0.5)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(240,220,235,0.2)")}
          >
            Admin
          </a>
        </div>
      </footer>
    </div>
  );
}
