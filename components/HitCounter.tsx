'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { recordVisitorTraffic } from '@/lib/trafficTracker';

export default function HitCounter() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    // 1. Read cached count from localStorage immediately on mount to prevent layout shift / flash
    try {
      const cached = localStorage.getItem('last_traffic_count');
      if (cached) {
        setDisplayCount(cached);
      }
    } catch {
      // Storage unavailable
    }

    // 2. Session tracking, daily rotation & peak calculation
    recordVisitorTraffic().catch((err) => {
      console.warn('Traffic tracking error:', err);
    });

    // 3. Real-time snapshot listener on site_stats/traffic
    try {
      const unsub = onSnapshot(
        doc(db, 'site_stats', 'traffic'),
        (docSnap) => {
          let visits = 0;
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (typeof data?.totalVisits === 'number') {
              visits = data.totalVisits;
            }
          }
          const formatted = (90156 + visits).toLocaleString();
          setDisplayCount(formatted);
          setLoading(false);

          try {
            localStorage.setItem('last_traffic_count', formatted);
          } catch {
            // Storage unavailable
          }
        },
        (err) => {
          console.warn('site_stats/traffic snapshot fallback:', err);
          setLoading(false);
        }
      );

      return () => unsub();
    } catch (err) {
      console.warn('Error setting up onSnapshot for traffic:', err);
      setLoading(false);
    }
  }, []);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '10px 20px',
        borderRadius: '9999px',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.3)',
      }}>

        {/* Eye Icon */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#2DD4BF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>

        {/* Label + Value inline */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', minHeight: '1.5rem' }}>
          <span style={{
            fontSize: '10px',
            letterSpacing: '0.2em',
            color: '#9CA3AF',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}>
            Total Visitors
          </span>

          {!mounted || (loading && !displayCount) ? (
            <span
              aria-label="Loading visitor count"
              className="inline-block w-16 h-5 bg-teal-500/20 animate-pulse rounded align-middle"
              style={{ minWidth: '60px' }}
            />
          ) : (
            <span
              suppressHydrationWarning
              className="transition-opacity duration-300 ease-in opacity-100"
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                background: 'linear-gradient(to right, #2DD4BF, #34D399)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              {displayCount}
            </span>
          )}
        </div>

      </div>
    </div>
  );
}
