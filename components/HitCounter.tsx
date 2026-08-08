'use client';
import { useEffect, useState } from 'react';

export default function HitCounter() {
  const [hits, setHits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHits = async () => {
      try {
        const res = await fetch('/counter.php?t=' + Date.now());
        if (!res.ok) throw new Error("Network response was not ok");
        const data = await res.json();
        setHits(Number(data.count));
      } catch (err) {
        console.warn("Failed to fetch from backend:", err);
        setHits(null);
      } finally {
        setLoading(false);
      }
    };

    fetchHits();
  }, []);

  const displayValue = loading || hits === null || isNaN(hits!)
    ? 'Loading...'
    : hits!.toLocaleString();

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
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <span style={{
            fontSize: '10px',
            letterSpacing: '0.2em',
            color: '#9CA3AF',
            textTransform: 'uppercase',
            fontWeight: 500,
          }}>
            Total Visitors
          </span>
          <span style={{
            fontSize: '1.125rem',
            fontWeight: 700,
            background: 'linear-gradient(to right, #2DD4BF, #34D399)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            {displayValue}
          </span>
        </div>

      </div>
    </div>
  );
}
