'use client';
import { useEffect, useState } from 'react';

export default function HitCounter() {
  const [hits, setHits] = useState<string>('---');

  useEffect(() => {
    const fetchHits = async () => {
      try {
        const res = await fetch('/counter.php?t=' + Date.now());
        if (!res.ok) throw new Error("Network response was not ok");
        
        const data = await res.json();
        setHits(data.count.toLocaleString());
      } catch (err) {
        console.warn("Failed to fetch from backend:", err);
      }
    };

    fetchHits();
  }, []);

  return (
    <div className="flex justify-center mt-6">
      <div className="inline-flex items-center gap-4 px-6 py-3 bg-slate-900/50 rounded-full border border-slate-700/50 backdrop-blur-sm">
        
        {/* Teal Circular Icon with Glow */}
        <div className="flex items-center justify-center w-10 h-10 bg-teal-600 rounded-full text-white shadow-[0_0_15px_rgba(13,148,136,0.3)]">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        </div>

        {/* Text Area */}
        <div className="flex flex-col items-start leading-tight">
          <span className="text-xs uppercase text-slate-400 font-bold tracking-widest">
            Total Visitors
          </span>
          <span className="text-lg font-bold text-white">
            {hits}
          </span>
        </div>

      </div>
    </div>
  );
}
