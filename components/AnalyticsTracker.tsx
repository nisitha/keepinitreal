'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Lightweight, privacy-friendly visitor analytics tracker.
 * - Zero personal data / IP storage (GDPR friendly)
 * - Session-based deduplication per page (no refresh inflation)
 * - Excludes admin routes (/admin*)
 */
export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined' || !pathname) return;

    // Do NOT track admin or moderation control routes
    if (pathname.startsWith('/admin')) return;

    // Deduplicate within the same browsing session per page
    const sessionKey = `kir_viewed_${pathname}`;
    try {
      if (sessionStorage.getItem(sessionKey)) {
        return;
      }
    } catch {
      // Ignore sessionStorage access errors (e.g. strict private mode)
    }

    // Categorize referrer source
    const getNormalizedReferrer = (): string => {
      const ref = document.referrer;
      if (!ref) return 'Direct';
      try {
        const url = new URL(ref);
        const host = url.hostname.toLowerCase();
        
        // Internal page-to-page transitions
        if (host.includes(window.location.hostname.toLowerCase())) {
          return 'Internal';
        }
        
        // External sources
        if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube';
        if (host.includes('google.com') || host.includes('bing.com') || host.includes('duckduckgo.com') || host.includes('yahoo.com')) return 'Search Engine';
        if (host.includes('facebook.com') || host.includes('instagram.com') || host.includes('twitter.com') || host.includes('x.com') || host.includes('reddit.com') || host.includes('linkedin.com') || host.includes('t.co')) return 'Social Media';
        
        return host.replace(/^www\./, '');
      } catch {
        return 'Direct';
      }
    };

    // Detect device type without collecting personal data
    const getDeviceType = (): 'Mobile' | 'Desktop' => {
      const ua = navigator.userAgent || '';
      if (/Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
        return 'Mobile';
      }
      if (window.innerWidth <= 768) {
        return 'Mobile';
      }
      return 'Desktop';
    };

    const referrer = getNormalizedReferrer();
    const device = getDeviceType();

    try {
      sessionStorage.setItem(sessionKey, '1');
    } catch {
      // Storage unavailable
    }

    // Record detailed event to 'site_analytics' collection for breakdown stats
    addDoc(collection(db, 'site_analytics'), {
      path: pathname,
      referrer,
      device,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
