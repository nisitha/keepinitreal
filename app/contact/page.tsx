'use client';

import { useEffect, useState } from 'react';
import ParticleBackground from '@/components/ParticleBackground';

export default function ContactPage() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay so the CSS transition triggers after mount
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="contact-page">
      {/* Interactive particle canvas — renders behind everything */}
      <ParticleBackground />

      {/* Full-bleed background image */}
      <div className="contact-bg">
        <img
          src="https://images.unsplash.com/photo-1516387938699-a93567ec168e?auto=format&fit=crop&w=1920&q=80"
          alt="Journey background – open road at golden hour"
          className="contact-bg-img"
        />
        <div className="contact-bg-overlay" />
      </div>

      {/* Content wrapper */}
      <div className={`contact-wrapper ${visible ? 'is-visible' : ''}`}>
        {/* Left column — decorative image card */}
        <div className="contact-image-col">
          <div className="contact-image-card">
            <img
              src="https://images.unsplash.com/photo-1516387938699-a93567ec168e?auto=format&fit=crop&w=800&q=80"
              alt="Bicycles on a sunny California road"
              className="contact-card-img"
            />
            <div className="contact-image-badge">
              <span className="contact-badge-dot" />
              San Diego, CA
            </div>
          </div>
        </div>

        {/* Right column — glass card */}
        <div className="contact-info-col">
          <div className="contact-glass-card">
            {/* Decorative accent line */}
            <div className="contact-accent" />

            <p className="contact-label">Get In Touch</p>
            <h1 className="contact-title">Keepin It Real</h1>
            <p className="contact-subtitle">Gary and Chris Stoefen</p>

            <p className="contact-description">
              A father-and-son bicycle team pedalling through San Diego,
              capturing real stories from real people. Want to share your story
              or collaborate? We&apos;d love to hear from you.
            </p>

            {/* Email CTA */}
            <a
              href="mailto:gary@keepinitreal.us"
              className="contact-email-btn"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              gary@keepinitreal.us
            </a>

            {/* Divider */}
            <div className="contact-divider" />

            {/* Social links */}
            <p className="contact-social-label">Follow the Journey</p>
            <div className="contact-socials">
              <a
                href="https://web.facebook.com/Poppastoef"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-social-icon"
                aria-label="Facebook"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
              </a>
              <a
                href="https://www.youtube.com/@keepinitrealsd"
                target="_blank"
                rel="noopener noreferrer"
                className="contact-social-icon"
                aria-label="YouTube"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" /><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" /></svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
