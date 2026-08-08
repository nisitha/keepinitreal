'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Video {
  id: string;
  url: string;
  title: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getYouTubeId(url: string): string | null {
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function getThumbnailUrl(url: string): string {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : '';
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 9; // videos revealed per page

// ─── Component ────────────────────────────────────────────────────────────────
export default function VideosPage() {
  // All videos fetched once from the static JSON file
  const [allVideos, setAllVideos] = useState<Video[]>([]);
  // How many videos are currently visible (grows by PAGE_SIZE)
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  // Which video card is "playing" (clicked)
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sentinel div ref for Intersection Observer (infinite scroll)
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ── Fetch all data once, entirely client-side from the static JSON ─────────
  useEffect(() => {
    fetch('/videos.json')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load videos (${res.status})`);
        return res.json();
      })
      .then((data: Video[]) => {
        setAllVideos(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading videos:', err);
        setError('Could not load videos. Please refresh the page.');
        setLoading(false);
      });
  }, []);

  // ── Derived slice: only the visible portion of the in-memory array ─────────
  const visibleVideos = allVideos.slice(0, visibleCount);
  const hasMore = visibleCount < allVideos.length;

  // ── Load-more handler: purely in-memory, zero network calls ───────────────
  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, allVideos.length));
  }, [allVideos.length]);

  // ── Intersection Observer drives the infinite scroll ──────────────────────
  useEffect(() => {
    if (loading || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [loading, hasMore, loadMore]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <main>
      {/* Page Header */}
      <header className="page-header">
        <div className="container">
          <h1>All Episodes</h1>
          <p>New videos uploaded weekly. Catch up on all our San Diego stories.</p>

        </div>
      </header>

      {/* Video Gallery */}
      <section className="videos-section">
        <div className="container">

          {/* Loading skeleton */}
          {loading && (
            <div className="vg-loading" aria-live="polite" aria-busy="true">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                <div key={i} className="vg-skeleton">
                  <div className="vg-skeleton-thumb" />
                  <div className="vg-skeleton-title" />
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="vg-error" role="alert">
              <span style={{ fontSize: '2rem' }}>⚠️</span>
              <p>{error}</p>
            </div>
          )}

          {/* Video grid — sliced from in-memory array, no API calls */}
          {!loading && !error && (
            <>
              <div className="video-grid">
                {visibleVideos.map((video) => {
                  const videoId = getYouTubeId(video.url);
                  const embedUrl = videoId
                    ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`
                    : video.url;
                  const thumbUrl = getThumbnailUrl(video.url);
                  const isActive = activeId === video.id;

                  return (
                    <div key={video.id} className="video-card vg-card">
                      <div className="video-wrapper">
                        {isActive ? (
                          /* Render iframe only when the user clicks — avoids 30+ iframes loading simultaneously */
                          <iframe
                            src={embedUrl}
                            title={video.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          /* Thumbnail overlay — click to activate */
                          <button
                            className="vg-thumb-btn"
                            onClick={() => setActiveId(video.id)}
                            aria-label={`Play ${video.title}`}
                            style={{ backgroundImage: `url(${thumbUrl})` }}
                          >
                            <span className="vg-play-icon" aria-hidden="true">
                              <svg viewBox="0 0 68 48" width="68" height="48" focusable="false">
                                <path
                                  className="vg-play-bg"
                                  d="M66.52 7.74c-.78-2.93-2.49-5.41-5.42-6.19C55.79.13 34 0 34 0S12.21.13 6.9 1.55c-2.93.78-4.63 3.26-5.42 6.19C.06 13.05 0 24 0 24s.06 10.95 1.48 16.26c.78 2.93 2.49 5.41 5.42 6.19C12.21 47.87 34 48 34 48s21.79-.13 27.1-1.55c2.93-.78 4.64-3.26 5.42-6.19C67.94 34.95 68 24 68 24s-.06-10.95-1.48-16.26z"
                                />
                                <path className="vg-play-arrow" d="M45 24 27 14v20z" />
                              </svg>
                            </span>
                          </button>
                        )}
                      </div>
                      <div className="video-info vg-info">
                        <h3 className="vg-title" title={video.title}>
                          {video.title}
                        </h3>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sentinel: when this div enters the viewport, IntersectionObserver calls loadMore() */}
              {hasMore && (
                <div ref={sentinelRef} className="vg-sentinel" aria-hidden="true">
                  <div className="vg-load-indicator">
                    <div className="vg-spinner" />
                    <span>Loading more episodes…</span>
                  </div>
                </div>
              )}

              {/* All-caught-up footer */}
              {!hasMore && allVideos.length > 0 && (
                <div className="vg-end">
                  <span>✓ You&apos;ve seen all {allVideos.length} episodes</span>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {/* Scoped component styles */}
      <style>{`
        /* ── Skeleton Loader ─────────────────────────────────────────────── */
        .vg-loading {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 30px;
        }
        .vg-skeleton {
          border-radius: 15px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 10px 30px rgba(0,0,0,0.05);
        }
        .vg-skeleton-thumb {
          aspect-ratio: 16/9;
          background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
          background-size: 200% 100%;
          animation: vg-shimmer 1.4s infinite;
        }
        .vg-skeleton-title {
          height: 18px;
          margin: 16px;
          border-radius: 4px;
          background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
          background-size: 200% 100%;
          animation: vg-shimmer 1.4s infinite 0.2s;
          width: 70%;
        }
        @keyframes vg-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        /* ── Error state ──────────────────────────────────────────────────── */
        .vg-error {
          text-align: center;
          padding: 60px 20px;
          color: #ef4444;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          font-size: 1.1rem;
        }

        /* ── Card fade-in ─────────────────────────────────────────────────── */
        .vg-card {
          animation: vg-fadeIn 0.4s ease both;
        }
        @keyframes vg-fadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Thumbnail play button ───────────────────────────────────────── */
        .vg-thumb-btn {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: none;
          cursor: pointer;
          background-size: cover;
          background-position: center;
          background-color: #0F172A;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: filter 0.25s ease;
          padding: 0;
        }
        .vg-thumb-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.35) 0%, transparent 60%);
        }
        .vg-thumb-btn:hover { filter: brightness(1.1); }
        .vg-play-icon {
          position: relative;
          z-index: 1;
          filter: drop-shadow(0 4px 16px rgba(0,0,0,0.6));
          transition: transform 0.2s ease;
        }
        .vg-thumb-btn:hover .vg-play-icon { transform: scale(1.12); }
        .vg-play-bg {
          fill: #212121;
          fill-opacity: 0.82;
          transition: fill 0.2s ease, fill-opacity 0.2s ease;
        }
        .vg-thumb-btn:hover .vg-play-bg { fill: #ff0000; fill-opacity: 1; }
        .vg-play-arrow { fill: #fff; }

        /* ── Video info row ──────────────────────────────────────────────── */
        .vg-info {
          padding: 14px 16px;
        }
        .vg-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--color-navy);
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          width: 100%;
        }

        /* ── Sentinel / load indicator ───────────────────────────────────── */
        .vg-sentinel {
          display: flex;
          justify-content: center;
          padding: 40px 0 10px;
        }
        .vg-load-indicator {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--color-text-muted);
          font-size: 0.95rem;
        }
        .vg-spinner {
          width: 22px;
          height: 22px;
          border: 3px solid rgba(13, 148, 136, 0.2);
          border-top-color: var(--color-teal);
          border-radius: 50%;
          animation: vg-spin 0.8s linear infinite;
        }
        @keyframes vg-spin { to { transform: rotate(360deg); } }

        /* ── End-of-list message ─────────────────────────────────────────── */
        .vg-end {
          text-align: center;
          padding: 40px 0 10px;
        }
        .vg-end span {
          display: inline-block;
          background: rgba(13, 148, 136, 0.08);
          border: 1px solid rgba(13, 148, 136, 0.2);
          border-radius: 30px;
          padding: 8px 20px;
          color: var(--color-teal-dark);
          font-weight: 500;
          font-size: 0.9rem;
        }
      `}</style>
    </main>
  );
}
