'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import OurMission from '@/components/OurMission';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface Video {
  id: string;
  url: string;
  title: string;
}

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    try {
      const q = query(collection(db, 'site_videos'), orderBy('order', 'asc'), limit(3));
      unsub = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: Video[] = snapshot.docs.map((d) => {
              const data = d.data();
              const yid = data.youtubeId || d.id;
              return {
                id: d.id,
                title: data.title || "Keepin' It Real Episode",
                url: `https://www.youtube.com/embed/${yid}`
              };
            });
            setVideos(list);
            setLoading(false);
          } else {
            fetch('/videos.json?t=' + Date.now())
              .then((res) => res.json())
              .then((data: Video[]) => {
                setVideos(data.slice(0, 3));
              })
              .catch(() => {})
              .finally(() => setLoading(false));
          }
        },
        (err) => {
          console.warn('Firestore site_videos fallback:', err);
          fetch('/videos.json?t=' + Date.now())
            .then((res) => res.json())
            .then((data: Video[]) => setVideos(data.slice(0, 3)))
            .catch(() => {})
            .finally(() => setLoading(false));
        }
      );
    } catch (err) {
      console.warn('Firestore error in home page:', err);
      setLoading(false);
    }

    return () => {
      if (unsub) unsub();
    };
  }, []);

  return (
    <main>
      <header className="hero">
        <div className="hero-bg">
          <Image src="/bikesinob.jpg" alt="Bikes in Ocean Beach" fill style={{ objectFit: 'cover', objectPosition: 'center' }} priority />
        </div>
        <div className="hero-overlay"></div>
        <div className="container hero-content">
          <h1>Everyone is an <span>Open Book</span></h1>
          <p>Join Chris and Gary, a travelling father and son bicycle team, as they pedal around San Diego to interview folks who share their wisdom, humor, and incredible stories.</p>
          <Link href="/videos" className="btn btn-primary">Watch Episodes</Link>
        </div>
      </header>

      <OurMission />

      <section className="videos-section">
        <div className="container">
          {/* Modern Community Feedback Banner */}
          <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 p-6 md:p-8 backdrop-blur-sm shadow-sm transition-all hover:shadow-md mb-10">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              {/* Left Section (Icon + Text) */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
                    Enjoying the show? We&apos;d love to hear from you!
                  </h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 max-w-xl">
                    Share your thoughts, suggestions, or story ideas directly with Gary &amp; Chris on our Comments page.
                  </p>
                  <div className="mt-2.5 flex justify-center sm:justify-start">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 backdrop-blur-sm">
                      <svg
                        className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        />
                      </svg>
                      <span>(your email address will remain private)</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Section (Modern Action Button) */}
              <div className="shrink-0 w-full sm:w-auto flex justify-center md:justify-end">
                <Link
                  className="group inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/25 transition-all hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/35 active:scale-95"
                  href="/comments"
                >
                  <span>Leave a Comment</span>
                  <svg
                    className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>

          <h2 className="section-title">Latest Episodes</h2>

          {loading && (
            <div className="video-grid">
              {[1, 2, 3].map((i) => (
                <div key={i} className="video-card" style={{ height: '280px', background: '#f1f5f9' }} />
              ))}
            </div>
          )}

          {!loading && (
            <div className="video-grid">
              {videos.map((video) => {
                const videoId = getYouTubeId(video.url);
                const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : video.url;

                return (
                  <div key={video.id} className="video-card">
                    <div className="video-wrapper">
                      <iframe
                        src={embedUrl}
                        title={video.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    </div>
                    <div className="video-info" style={{ padding: '16px 20px' }}>
                      <h3 className="line-clamp-2" title={video.title} style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--color-navy)', margin: 0, lineHeight: 1.4 }}>
                        {video.title}
                      </h3>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <Link href="/videos" className="btn btn-primary">View All Videos</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
