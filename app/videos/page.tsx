'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────
export interface VideoItem {
  id: string;
  title: string;
  embedUrl: string;
  thumbnail: string;
}

// ─── Complete Published Channel Videos (Latest / Newest First) ────────────────
export const PUBLISHED_VIDEOS: VideoItem[] = [
  {
    "id": "H9RX7m120WU",
    "title": "UTC Mall Ice Rink",
    "embedUrl": "https://www.youtube.com/embed/H9RX7m120WU",
    "thumbnail": "https://img.youtube.com/vi/H9RX7m120WU/hqdefault.jpg"
  },
  {
    "id": "EqLry4nVV4k",
    "title": "Del Mar Dog Beach",
    "embedUrl": "https://www.youtube.com/embed/EqLry4nVV4k",
    "thumbnail": "https://img.youtube.com/vi/EqLry4nVV4k/hqdefault.jpg"
  },
  {
    "id": "hfCdX5l5j-Q",
    "title": "Promo Keepin It Real",
    "embedUrl": "https://www.youtube.com/embed/hfCdX5l5j-Q",
    "thumbnail": "https://img.youtube.com/vi/hfCdX5l5j-Q/hqdefault.jpg"
  },
  {
    "id": "WB5QKDzjc-4",
    "title": "Mira Mesa Farmers Market",
    "embedUrl": "https://www.youtube.com/embed/WB5QKDzjc-4",
    "thumbnail": "https://img.youtube.com/vi/WB5QKDzjc-4/hqdefault.jpg"
  },
  {
    "id": "y0OTN_Q1WTc",
    "title": "San Diego Automotive Museum",
    "embedUrl": "https://www.youtube.com/embed/y0OTN_Q1WTc",
    "thumbnail": "https://img.youtube.com/vi/y0OTN_Q1WTc/hqdefault.jpg"
  },
  {
    "id": "Ql0YH3LRXB4",
    "title": "San Diego Comic-Con",
    "embedUrl": "https://www.youtube.com/embed/Ql0YH3LRXB4",
    "thumbnail": "https://img.youtube.com/vi/Ql0YH3LRXB4/hqdefault.jpg"
  },
  {
    "id": "4n7Pws27Z9g",
    "title": "Save Kit Carson Park",
    "embedUrl": "https://www.youtube.com/embed/4n7Pws27Z9g",
    "thumbnail": "https://img.youtube.com/vi/4n7Pws27Z9g/hqdefault.jpg"
  },
  {
    "id": "91ZYgdCrpQM",
    "title": "\"Markets for Makers\"",
    "embedUrl": "https://www.youtube.com/embed/91ZYgdCrpQM",
    "thumbnail": "https://img.youtube.com/vi/91ZYgdCrpQM/hqdefault.jpg"
  },
  {
    "id": "OC8xpN3EKpI",
    "title": "FOX5 TV Interview",
    "embedUrl": "https://www.youtube.com/embed/OC8xpN3EKpI",
    "thumbnail": "https://img.youtube.com/vi/OC8xpN3EKpI/hqdefault.jpg"
  },
  {
    "id": "91EQuPQdYus",
    "title": "Birch Aquarium La Jolla",
    "embedUrl": "https://www.youtube.com/embed/91EQuPQdYus",
    "thumbnail": "https://img.youtube.com/vi/91EQuPQdYus/hqdefault.jpg"
  },
  {
    "id": "F84T2MVbL00",
    "title": "Excerpts \"Best Of\" Oct-June",
    "embedUrl": "https://www.youtube.com/embed/F84T2MVbL00",
    "thumbnail": "https://img.youtube.com/vi/F84T2MVbL00/hqdefault.jpg"
  },
  {
    "id": "olv_vtKxY74",
    "title": "San Diego County Fair",
    "embedUrl": "https://www.youtube.com/embed/olv_vtKxY74",
    "thumbnail": "https://img.youtube.com/vi/olv_vtKxY74/hqdefault.jpg"
  },
  {
    "id": "QnFo9MLtOzk",
    "title": "\"Museum of Us\" Balboa Park",
    "embedUrl": "https://www.youtube.com/embed/QnFo9MLtOzk",
    "thumbnail": "https://img.youtube.com/vi/QnFo9MLtOzk/hqdefault.jpg"
  },
  {
    "id": "F5ZEmPwk6G4",
    "title": "A Taste of Little Italy",
    "embedUrl": "https://www.youtube.com/embed/F5ZEmPwk6G4",
    "thumbnail": "https://img.youtube.com/vi/F5ZEmPwk6G4/hqdefault.jpg"
  },
  {
    "id": "8a90pQfgYsg",
    "title": "Centennial Park with Refugio",
    "embedUrl": "https://www.youtube.com/embed/8a90pQfgYsg",
    "thumbnail": "https://img.youtube.com/vi/8a90pQfgYsg/hqdefault.jpg"
  },
  {
    "id": "l1O2WwtAF5w",
    "title": "Congrats to the Grads!",
    "embedUrl": "https://www.youtube.com/embed/l1O2WwtAF5w",
    "thumbnail": "https://img.youtube.com/vi/l1O2WwtAF5w/hqdefault.jpg"
  },
  {
    "id": "v1mUxPF3X30",
    "title": "Reflections with Wayne",
    "embedUrl": "https://www.youtube.com/embed/v1mUxPF3X30",
    "thumbnail": "https://img.youtube.com/vi/v1mUxPF3X30/hqdefault.jpg"
  },
  {
    "id": "m-WdBjoFWGE",
    "title": "Vista Strawberry Festival",
    "embedUrl": "https://www.youtube.com/embed/m-WdBjoFWGE",
    "thumbnail": "https://img.youtube.com/vi/m-WdBjoFWGE/hqdefault.jpg"
  },
  {
    "id": "h8FMVcSXL5c",
    "title": "Seaport Village",
    "embedUrl": "https://www.youtube.com/embed/h8FMVcSXL5c",
    "thumbnail": "https://img.youtube.com/vi/h8FMVcSXL5c/hqdefault.jpg"
  },
  {
    "id": "bQUCAro-1TA",
    "title": "Cabrillo National Monument",
    "embedUrl": "https://www.youtube.com/embed/bQUCAro-1TA",
    "thumbnail": "https://img.youtube.com/vi/bQUCAro-1TA/hqdefault.jpg"
  },
  {
    "id": "yvxkbyUtfRY",
    "title": "Balboa Park May 2026",
    "embedUrl": "https://www.youtube.com/embed/yvxkbyUtfRY",
    "thumbnail": "https://img.youtube.com/vi/yvxkbyUtfRY/hqdefault.jpg"
  },
  {
    "id": "k_M3txU0FP0",
    "title": "Slideshow Music Video",
    "embedUrl": "https://www.youtube.com/embed/k_M3txU0FP0",
    "thumbnail": "https://img.youtube.com/vi/k_M3txU0FP0/hqdefault.jpg"
  },
  {
    "id": "J3MTChBTndQ",
    "title": "Torrey Pines State Park",
    "embedUrl": "https://www.youtube.com/embed/J3MTChBTndQ",
    "thumbnail": "https://img.youtube.com/vi/J3MTChBTndQ/hqdefault.jpg"
  },
  {
    "id": "Yqf-O9ICAJ8",
    "title": "Torrey Pines Gliderport",
    "embedUrl": "https://www.youtube.com/embed/Yqf-O9ICAJ8",
    "thumbnail": "https://img.youtube.com/vi/Yqf-O9ICAJ8/hqdefault.jpg"
  },
  {
    "id": "SRNpy4XVXN0",
    "title": "Oceanside Pier",
    "embedUrl": "https://www.youtube.com/embed/SRNpy4XVXN0",
    "thumbnail": "https://img.youtube.com/vi/SRNpy4XVXN0/hqdefault.jpg"
  },
  {
    "id": "mDJ_0txNh9s",
    "title": "Balboa Park",
    "embedUrl": "https://www.youtube.com/embed/mDJ_0txNh9s",
    "thumbnail": "https://img.youtube.com/vi/mDJ_0txNh9s/hqdefault.jpg"
  },
  {
    "id": "ZBOb7ZfNqzM",
    "title": "Little Italy",
    "embedUrl": "https://www.youtube.com/embed/ZBOb7ZfNqzM",
    "thumbnail": "https://img.youtube.com/vi/ZBOb7ZfNqzM/hqdefault.jpg"
  },
  {
    "id": "gMPHbPPBBBk",
    "title": "Pacific Beach Boardwalk",
    "embedUrl": "https://www.youtube.com/embed/gMPHbPPBBBk",
    "thumbnail": "https://img.youtube.com/vi/gMPHbPPBBBk/hqdefault.jpg"
  },
  {
    "id": "SueUqzJ7hoU",
    "title": "La Jolla Shores Beach",
    "embedUrl": "https://www.youtube.com/embed/SueUqzJ7hoU",
    "thumbnail": "https://img.youtube.com/vi/SueUqzJ7hoU/hqdefault.jpg"
  },
  {
    "id": "ZSUAwl-nUWk",
    "title": "Nautical History Gallery & Museum",
    "embedUrl": "https://www.youtube.com/embed/ZSUAwl-nUWk",
    "thumbnail": "https://img.youtube.com/vi/ZSUAwl-nUWk/hqdefault.jpg"
  },
  {
    "id": "yItF4DkFc24",
    "title": "Coronado Dog Beach",
    "embedUrl": "https://www.youtube.com/embed/yItF4DkFc24",
    "thumbnail": "https://img.youtube.com/vi/yItF4DkFc24/hqdefault.jpg"
  },
  {
    "id": "8hbj8MtecP0",
    "title": "CFA San Diego Cat Show",
    "embedUrl": "https://www.youtube.com/embed/8hbj8MtecP0",
    "thumbnail": "https://img.youtube.com/vi/8hbj8MtecP0/hqdefault.jpg"
  },
  {
    "id": "xTDoCtR2qdo",
    "title": "Mission Beach Belmont Park",
    "embedUrl": "https://www.youtube.com/embed/xTDoCtR2qdo",
    "thumbnail": "https://img.youtube.com/vi/xTDoCtR2qdo/hqdefault.jpg"
  },
  {
    "id": "eU4Irp0Smd8",
    "title": "Embarcadero USS Midway",
    "embedUrl": "https://www.youtube.com/embed/eU4Irp0Smd8",
    "thumbnail": "https://img.youtube.com/vi/eU4Irp0Smd8/hqdefault.jpg"
  },
  {
    "id": "uUQ0lumq_kg",
    "title": "Liberty Station Pisano Artistry",
    "embedUrl": "https://www.youtube.com/embed/uUQ0lumq_kg",
    "thumbnail": "https://img.youtube.com/vi/uUQ0lumq_kg/hqdefault.jpg"
  },
  {
    "id": "oY5rBLjX-aA",
    "title": "Old Town San Diego",
    "embedUrl": "https://www.youtube.com/embed/oY5rBLjX-aA",
    "thumbnail": "https://img.youtube.com/vi/oY5rBLjX-aA/hqdefault.jpg"
  },
  {
    "id": "cu8L51Uc4xQ",
    "title": "December Nights Balboa Park",
    "embedUrl": "https://www.youtube.com/embed/cu8L51Uc4xQ",
    "thumbnail": "https://img.youtube.com/vi/cu8L51Uc4xQ/hqdefault.jpg"
  },
  {
    "id": "WtqEqFF6cq4",
    "title": "Ocean Beach",
    "embedUrl": "https://www.youtube.com/embed/WtqEqFF6cq4",
    "thumbnail": "https://img.youtube.com/vi/WtqEqFF6cq4/hqdefault.jpg"
  },
  {
    "id": "fNETcHkAGdE",
    "title": "Archival Clips Not Yet Seen",
    "embedUrl": "https://www.youtube.com/embed/fNETcHkAGdE",
    "thumbnail": "https://img.youtube.com/vi/fNETcHkAGdE/hqdefault.jpg"
  },
  {
    "id": "4AGAkz1oaq0",
    "title": "Coronado with Refugio",
    "embedUrl": "https://www.youtube.com/embed/4AGAkz1oaq0",
    "thumbnail": "https://img.youtube.com/vi/4AGAkz1oaq0/hqdefault.jpg"
  },
  {
    "id": "UPF4PwlaENc",
    "title": "La Jolla",
    "embedUrl": "https://www.youtube.com/embed/UPF4PwlaENc",
    "thumbnail": "https://img.youtube.com/vi/UPF4PwlaENc/hqdefault.jpg"
  },
  {
    "id": "_Eh7H5pFHGw",
    "title": "Balboa Park Art Center",
    "embedUrl": "https://www.youtube.com/embed/_Eh7H5pFHGw",
    "thumbnail": "https://img.youtube.com/vi/_Eh7H5pFHGw/hqdefault.jpg"
  },
  {
    "id": "dsSRghMmItY",
    "title": "Pacific Beach Boardwalk",
    "embedUrl": "https://www.youtube.com/embed/dsSRghMmItY",
    "thumbnail": "https://img.youtube.com/vi/dsSRghMmItY/hqdefault.jpg"
  }
];

// ─── Pagination Settings ──────────────────────────────────────────────────────
const PAGE_SIZE = 9; // Number of episodes revealed per scroll step

export default function VideosPage() {
  // Driven by the full published list, with dynamic re-hydration from /videos.json
  const [allVideos, setAllVideos] = useState<VideoItem[]>(PUBLISHED_VIDEOS);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sentinel div ref for Intersection Observer (infinite scroll)
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // ── Sync directly with Firestore collection: site_videos (ordered by order asc) ──
  useEffect(() => {
    try {
      const q = query(collection(db, 'site_videos'), orderBy('order', 'asc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: VideoItem[] = snapshot.docs.map((d) => {
              const data = d.data();
              const youtubeId = data.youtubeId || d.id;
              return {
                id: youtubeId,
                title: data.title || "Keepin' It Real Episode",
                embedUrl: `https://www.youtube.com/embed/${youtubeId}`,
                thumbnail: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`,
              };
            });
            setAllVideos(list);
          }
        },
        (err) => {
          console.warn('Firestore site_videos listener fallback to static:', err);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.warn('Firestore site_videos connection error:', err);
    }
  }, []);

  const visibleVideos = allVideos.slice(0, visibleCount);
  const hasMore = visibleCount < allVideos.length;

  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, allVideos.length));
  }, [allVideos.length]);

  useEffect(() => {
    if (!hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '250px' }
    );

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, loadMore]);

  return (
    <main>
      {/* Page Header matching original brand presentation */}
      <header className="page-header">
        <div className="container">
          <h1>All Episodes</h1>
          <p>New videos uploaded weekly. Catch up on all our San Diego stories.</p>
        </div>
      </header>

      {/* Video Gallery Section */}
      <section className="videos-section">
        <div className="container">
          
          <div className="video-grid">
            {visibleVideos.map((video) => {
              const isActive = activeId === video.id;
              const playUrl = video.embedUrl.includes('?') 
                ? `${video.embedUrl}&autoplay=1&rel=0` 
                : `${video.embedUrl}?autoplay=1&rel=0`;

              return (
                <div key={video.id} className="video-card vg-card">
                  <div className="video-wrapper">
                    {isActive ? (
                      /* In-place high-performance iframe playback */
                      <iframe
                        src={playUrl}
                        title={video.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      /* Bright, crisp, vibrant thumbnail (NO dark overlays or muted filters) */
                      <button
                        className="vg-thumb-btn"
                        onClick={() => setActiveId(video.id)}
                        aria-label={`Watch ${video.title}`}
                        style={{ backgroundImage: `url(${video.thumbnail})` }}
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

          {/* Sentinel loader for infinite scroll */}
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

        </div>
      </section>

      {/* Scoped CSS matching original styling and bright thumbnail aesthetics */}
      <style>{`
        /* ── Card animation ──────────────────────────────────────────────── */
        .vg-card {
          animation: vg-fadeIn 0.35s ease both;
        }
        @keyframes vg-fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Bright & Crisp Thumbnail Button (NO dark overlays) ───────────── */
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
          transition: filter 0.25s ease, transform 0.25s ease;
          padding: 0;
          opacity: 1;
        }
        .vg-thumb-btn:hover {
          filter: brightness(1.05);
        }
        .vg-play-icon {
          position: relative;
          z-index: 2;
          filter: drop-shadow(0 4px 14px rgba(0,0,0,0.5));
          transition: transform 0.2s ease;
        }
        .vg-thumb-btn:hover .vg-play-icon {
          transform: scale(1.12);
        }
        .vg-play-bg {
          fill: #212121;
          fill-opacity: 0.85;
          transition: fill 0.2s ease, fill-opacity 0.2s ease;
        }
        .vg-thumb-btn:hover .vg-play-bg {
          fill: #ff0000;
          fill-opacity: 1;
        }
        .vg-play-arrow {
          fill: #fff;
        }

        /* ── Video Title & Info ──────────────────────────────────────────── */
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
          margin: 0;
        }

        /* ── Sentinel / Load indicator ───────────────────────────────────── */
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

        /* ── All Caught Up Notice ────────────────────────────────────────── */
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
