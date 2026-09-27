import Comments from "@/components/Comments";

export const metadata = {
  title: "Community Comments | Keepin' It Real",
  description: "Join the conversation and leave a comment.",
};

export default function CommentsPage() {
  return (
    <main>
      {/* ── Hero Header ──────────────────────────────────────────── */}
      <header className="cm-hero">
        <div className="cm-hero-glow cm-glow-left" aria-hidden="true" />
        <div className="cm-hero-glow cm-glow-right" aria-hidden="true" />
        <div className="container cm-hero-content">
          <span className="cm-eyebrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM9 11H7V9h2v2zm4 0h-2V9h2v2zm4 0h-2V9h2v2z" />
            </svg>
            Community Voices
          </span>
          <h1>
            Keepin&apos; It Real
            <span className="cm-title-accent"> Comments</span>
          </h1>
          <p className="cm-subtitle">
            Join the conversation. What&apos;s on your mind? Share your thoughts, questions, or just say hello to the community.
          </p>
        </div>
      </header>

      {/* ── Comments Section ───────────────────────────────────────── */}
      <section className="bg-gray-100 py-12 min-h-screen">
        <div className="container mx-auto px-4">
          <Comments />
        </div>
      </section>

      {/* ── Inline scoped styles ───────────────────────────────── */}
      <style>{`
        /* ── Hero ──────────────────────────────────────────────── */
        .cm-hero {
          margin-top: var(--nav-height);
          position: relative;
          background: var(--color-navy);
          padding: 90px 0 80px;
          text-align: center;
          overflow: hidden;
        }
        .cm-hero-glow {
          position: absolute;
          width: 500px;
          height: 500px;
          border-radius: 50%;
          filter: blur(120px);
          pointer-events: none;
          opacity: 0.25;
        }
        .cm-glow-left  { background: #0D9488; top: -100px; left: -150px; }
        .cm-glow-right { background: #F59E0B; bottom: -120px; right: -150px; }

        .cm-hero-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 18px;
        }

        .cm-eyebrow {
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

        .cm-hero h1 {
          color: #FFFFFF;
          font-size: clamp(2.4rem, 6vw, 4rem);
          font-weight: 800;
          line-height: 1.1;
          margin: 0;
          animation: cm-fadeUp 0.8s ease both;
        }
        .cm-title-accent { color: var(--color-gold); }

        .cm-subtitle {
          max-width: 560px;
          color: rgba(255,255,255,0.6);
          font-size: 1.1rem;
          line-height: 1.65;
          margin: 0;
          animation: cm-fadeUp 0.8s ease 0.2s both;
        }

        @keyframes cm-fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Responsive ────────────────────────────────────────── */
        @media (max-width: 480px) {
          .cm-hero { padding: 70px 0 60px; }
        }
      `}</style>
    </main>
  );
}
