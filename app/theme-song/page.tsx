'use client';

import MobilePhonePlayer from '@/components/MobilePhonePlayer';

export default function ThemeSongPage() {
  return (
    <main>
      {/* ── Hero Header ──────────────────────────────────────────── */}
      <header className="ts-hero">
        <div className="ts-hero-glow ts-glow-left" aria-hidden="true" />
        <div className="ts-hero-glow ts-glow-right" aria-hidden="true" />
        <div className="container ts-hero-content">
          <span className="ts-eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            Official Theme Song
          </span>
          <h1>
            Keepin&apos; It Real
            <span className="ts-title-accent"> Theme Song</span>
          </h1>
          <p className="ts-subtitle">
            &ldquo;Pedal Power&rdquo; &mdash; composed for Chris &amp; Gary&apos;s San Diego bicycle adventure.
            Press play and ride along.
          </p>
        </div>
      </header>

      {/* ── Player Section ───────────────────────────────────────── */}
      <section className="ts-player-section">
        <div className="ts-player-bg" aria-hidden="true" />
        <div className="container ts-player-container">

          {/* Left: copy */}
          <div className="ts-player-copy">
            <h2 className="ts-track-name">Pedal Power</h2>
            <p className="ts-artist">Chris &amp; Gary <span className="ts-ai-tag">AI Assist</span></p>
            <p className="ts-description">
              Our infectious theme song captures the free-spirited energy of two cyclists rolling
              through San Diego&apos;s neighbourhoods, meeting strangers and sharing stories one pedal
              stroke at a time.
            </p>
            <ul className="ts-meta-list" aria-label="Track details">
              <li>
                <span className="ts-meta-label">Genre</span>
                <span className="ts-meta-value">Indie / Folk-Pop</span>
              </li>
              <li>
                <span className="ts-meta-label">Released</span>
                <span className="ts-meta-value">2024</span>
              </li>
              <li>
                <span className="ts-meta-label">Show</span>
                <span className="ts-meta-value">Keepin&apos; It Real</span>
              </li>
            </ul>
          </div>

          {/* Right: the record player component */}
          <div className="ts-player-widget relative">
            {/* Ambient Glow */}
            <div className="absolute -inset-4 bg-gradient-to-tr from-emerald-500/20 to-transparent blur-3xl rounded-full z-0 pointer-events-none" />
            
            {/* Player Container */}
            <div className="relative z-10">
              <MobilePhonePlayer />
            </div>
          </div>

        </div>
      </section>

      {/* ── Inline scoped styles ───────────────────────────────── */}
      <style>{`
        /* ── Hero ──────────────────────────────────────────────── */
        .ts-hero {
          margin-top: var(--nav-height);
          position: relative;
          background: var(--color-navy);
          padding: 90px 0 80px;
          text-align: center;
          overflow: hidden;
        }
        .ts-hero-glow {
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
          opacity: 0.25;
        }
        .ts-glow-left  { background: #0D9488; top: -100px; left: -150px; }
        .ts-glow-right { background: #F59E0B; bottom: -120px; right: -150px; }

        .ts-hero-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
        }

        .ts-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(13, 148, 136, 0.15);
          border: 1px solid rgba(13, 148, 136, 0.35);
          color: #2DD4BF;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 6px 14px;
          border-radius: 30px;
        }

        .ts-hero h1 {
          color: #FFFFFF;
          font-size: clamp(2.4rem, 6vw, 4rem);
          font-weight: 800;
          line-height: 1.1;
          margin: 0;
          animation: ts-fadeUp 0.8s ease both;
        }
        .ts-title-accent { color: var(--color-gold); }

        .ts-subtitle {
          max-width: 560px;
          color: rgba(255,255,255,0.6);
          font-size: 1.1rem;
          line-height: 1.65;
          margin: 0;
          animation: ts-fadeUp 0.8s ease 0.2s both;
        }

        @keyframes ts-fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Player Section ──────────────────────────────────── */
        .ts-player-section {
          position: relative;
          background: #0B1120;
          padding: 80px 0 100px;
          overflow: hidden;
        }
        .ts-player-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 70% 60% at 20% 50%, rgba(13,148,136,0.07) 0%, transparent 70%),
            radial-gradient(ellipse 60% 50% at 80% 50%, rgba(245,158,11,0.06) 0%, transparent 70%);
          pointer-events: none;
        }

        .ts-player-container {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 64px;
        }

        /* ── Copy column ───────────────────────────────────────── */
        .ts-player-copy {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
          animation: ts-fadeUp 0.8s ease 0.1s both;
        }

        .ts-track-name {
          font-size: 2.5rem;
          font-weight: 800;
          color: #FFFFFF;
          margin: 0;
          line-height: 1.1;
        }

        .ts-artist {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 1rem;
          color: rgba(255,255,255,0.55);
          margin: 0;
          font-weight: 500;
        }
        .ts-ai-tag {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          background: rgba(245,158,11,0.15);
          border: 1px solid rgba(245,158,11,0.3);
          color: var(--color-gold);
          padding: 2px 8px;
          border-radius: 20px;
        }

        .ts-description {
          color: rgba(255,255,255,0.5);
          font-size: 1rem;
          line-height: 1.7;
          max-width: 440px;
          margin: 0;
        }

        .ts-meta-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-top: 1px solid rgba(255,255,255,0.08);
          padding-top: 20px;
          margin-top: 4px;
        }
        .ts-meta-list li {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .ts-meta-label {
          font-size: 0.8rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.3);
        }
        .ts-meta-value {
          font-size: 0.9rem;
          font-weight: 500;
          color: rgba(255,255,255,0.65);
        }

        /* ── Player widget column ──────────────────────────────── */
        .ts-player-widget {
          flex-shrink: 0;
          animation: ts-fadeUp 0.8s ease 0.25s both;
          /* subtle glow ring around the phone */
          filter: drop-shadow(0 0 40px rgba(13,148,136,0.2));
        }

        /* Apply border directly to the phone mockup container */
        .ts-player-widget .map-device {
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        /* ── Responsive ────────────────────────────────────────── */
        @media (max-width: 900px) {
          .ts-player-container {
            flex-direction: column-reverse;
            gap: 48px;
          }
          .ts-player-copy {
            align-items: center;
            text-align: center;
          }
          .ts-description { max-width: 100%; }
          .ts-meta-list { max-width: 360px; width: 100%; }
          .ts-artist { justify-content: center; }
        }

        @media (max-width: 480px) {
          .ts-hero { padding: 70px 0 60px; }
          .ts-track-name { font-size: 2rem; }
        }
      `}</style>
    </main>
  );
}
