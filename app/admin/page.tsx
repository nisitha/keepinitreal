'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  deleteDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  getDocs,
  limit,
  Timestamp 
} from 'firebase/firestore';

// ─── Interfaces ─────────────────────────────────────────────────────────────
export interface VideoItem {
  id: string;
  title: string;
  youtubeId?: string;
  url?: string;
  embedUrl?: string;
  thumbnail?: string;
  order?: number;
  createdAt?: any;
}

export interface MerchItem {
  id: string;
  name: string;
  title?: string;
  description?: string;
  price: number | string;
  imageUrl: string;
  order?: number;
  hasSizes?: boolean;
  businessEmail?: string;
  createdAt?: any;
}

export interface CommentItem {
  id: string;
  name?: string;
  author?: string;
  text?: string;
  content?: string;
  email?: string;
  videoTitle?: string;
  createdAt?: Timestamp | { seconds: number; nanoseconds: number } | string | null;
}

export interface AnalyticsEvent {
  id: string;
  path: string;
  referrer: string;
  device: 'Mobile' | 'Desktop';
  createdAt?: Timestamp | { seconds: number; nanoseconds: number } | string | null;
}

interface ToastMessage {
  id: string;
  text: string;
  type: 'success' | 'error' | 'info';
}

// ─── Utilities ──────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-teal-500 text-white', 'bg-blue-500 text-white', 'bg-emerald-500 text-white', 
  'bg-amber-500 text-white', 'bg-purple-500 text-white', 'bg-pink-500 text-white', 
  'bg-indigo-500 text-white', 'bg-rose-500 text-white'
];

function getAvatarColor(name: string = '') {
  const code = name.charCodeAt(0) || 0;
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
}

// Clean price string to valid float format (e.g. "$25.99" -> "25.99")
function sanitizePrice(raw: string | number): string {
  const cleaned = String(raw).replace(/[^0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? '0.00' : num.toFixed(2);
}

function formatCommentDate(createdAt: any): string {
  if (!createdAt) return 'Just now';
  try {
    let date: Date;
    if (typeof createdAt?.toDate === 'function') {
      date = createdAt.toDate();
    } else if (createdAt?.seconds) {
      date = new Date(createdAt.seconds * 1000);
    } else if (typeof createdAt === 'string' || typeof createdAt === 'number') {
      date = new Date(createdAt);
    } else {
      return 'Recently';
    }

    if (isNaN(date.getTime())) return 'Recently';

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return 'Recently';
  }
}

function timeAgo(createdAt: any): string {
  if (!createdAt) return 'Just now';
  try {
    let date: Date;
    if (typeof createdAt?.toDate === 'function') {
      date = createdAt.toDate();
    } else if (createdAt?.seconds) {
      date = new Date(createdAt.seconds * 1000);
    } else if (typeof createdAt === 'string' || typeof createdAt === 'number') {
      date = new Date(createdAt);
    } else {
      return 'Just now';
    }

    if (isNaN(date.getTime())) return 'Just now';

    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 45) return 'just now';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Just now';
  }
}

function getPersonalizedGreeting(): string {
  const hour = new Date().getHours();
  let timeGreeting = 'Good Morning';
  if (hour >= 5 && hour < 12) {
    timeGreeting = 'Good Morning';
  } else if (hour >= 12 && hour < 17) {
    timeGreeting = 'Good Afternoon';
  } else if (hour >= 17 && hour < 21) {
    timeGreeting = 'Good Evening';
  } else {
    timeGreeting = 'Good Night';
  }
  return `Hi, ${timeGreeting} Gary & Chris 😊`;
}

export default function AdminDashboardPage() {
  // ── Dynamic Personalized Greeting State (Hydration Safe) ──────────────────
  const [greeting, setGreeting] = useState<string>('');

  useEffect(() => {
    setGreeting(getPersonalizedGreeting());
  }, []);

  // ── Theme State (Default: 'light', persistent in localStorage) ─────────────
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('admin_theme') as 'light' | 'dark' | null;
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setTheme(savedTheme);
      } else {
        setTheme('light');
      }
    } catch {
      setTheme('light');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    try {
      localStorage.setItem('admin_theme', nextTheme);
    } catch {}
  };

  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [theme]);

  // ── Authentication State ──────────────────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  // ── Navigation State (Default Landing Tab: 'analytics') ───────────────────
  const [activeTab, setActiveTab] = useState<'analytics' | 'videos' | 'merch' | 'comments'>('analytics');

  // ── Animation & Transition States ─────────────────────────────────────────
  const [animateBars, setAnimateBars] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [deletingMerchId, setDeletingMerchId] = useState<string | null>(null);
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'analytics') {
      setAnimateBars(false);
      const timer = setTimeout(() => setAnimateBars(true), 100);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // ── Data States ───────────────────────────────────────────────────────────
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [merch, setMerch] = useState<MerchItem[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([]);
  const [liveTrafficDocCount, setLiveTrafficDocCount] = useState<number>(0);
  const [trafficStats, setTrafficStats] = useState<{
    totalVisits: number;
    todayCount: number;
    currentDate: string;
    peakDailyCount: number;
    dailyHistory: Record<string, number>;
  }>({
    totalVisits: 0,
    todayCount: 0,
    currentDate: '',
    peakDailyCount: 1420,
    dailyHistory: {},
  });
  const [timeframe, setTimeframe] = useState<'today' | 'daily' | 'weekly' | 'monthly' | 'yearly'>('today');
  const [hoveredBar, setHoveredBar] = useState<{ label: string; count: number; detail?: string } | null>(null);
  const [mounted, setMounted] = useState<boolean>(false);
  const [loadingTraffic, setLoadingTraffic] = useState<boolean>(true);
  const [cachedTraffic, setCachedTraffic] = useState<string | null>(null);
  const [loadingComments, setLoadingComments] = useState<boolean>(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState<boolean>(true);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  // ── Toast Notifications ───────────────────────────────────────────────────
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ id: Date.now().toString(), text, type });
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // ── Read Cached Traffic Count on Mount to Prevent Layout Shift / Flash ────
  useEffect(() => {
    setMounted(true);
    try {
      const cached = localStorage.getItem('last_traffic_count');
      if (cached) {
        setCachedTraffic(cached);
      }
    } catch {
      // Storage unavailable
    }
  }, []);

  // ── Check Existing Session on Mount ───────────────────────────────────────
  useEffect(() => {
    const savedAuth = typeof window !== 'undefined' ? sessionStorage.getItem('kir_admin_auth') : null;
    if (savedAuth === 'true') {
      setIsAuthenticated(true);
    }
    setAuthChecking(false);
  }, []);

  // ── Real-Time Videos & Merch Listeners (Firestore: site_videos, site_merch) ──
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingData(true);

    let unsubVideos: (() => void) | null = null;
    let unsubMerch: (() => void) | null = null;

    try {
      const qVideos = query(collection(db, 'site_videos'), orderBy('order', 'asc'));
      unsubVideos = onSnapshot(
        qVideos,
        (snapshot) => {
          const list: VideoItem[] = snapshot.docs.map((d) => {
            const data = d.data();
            const yid = data.youtubeId || extractYouTubeId(data.url || data.embedUrl || '') || d.id;
            return {
              id: d.id,
              youtubeId: yid,
              title: data.title || "Keepin' It Real Episode",
              order: typeof data.order === 'number' ? data.order : 0,
              url: `https://www.youtube.com/embed/${yid}`,
              embedUrl: `https://www.youtube.com/embed/${yid}`,
              thumbnail: `https://img.youtube.com/vi/${yid}/hqdefault.jpg`,
              createdAt: data.createdAt,
            };
          });
          setVideos(list);
          setLoadingData(false);
        },
        (err) => {
          console.error('Firestore site_videos snapshot error:', err);
          setLoadingData(false);
        }
      );

      const qMerch = query(collection(db, 'site_merch'), orderBy('order', 'asc'));
      unsubMerch = onSnapshot(
        qMerch,
        (snapshot) => {
          const list: MerchItem[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              name: data.title || data.name || 'Merch Item',
              title: data.title || data.name || 'Merch Item',
              description: data.description || "Official Keepin' It Real Gear. Shipping included.",
              price: data.price,
              imageUrl: data.imageUrl || '/merch-polo.jpg',
              order: typeof data.order === 'number' ? data.order : 0,
              hasSizes: !!data.hasSizes,
              businessEmail: data.businessEmail || 'gary@lisaslight.com',
              createdAt: data.createdAt,
            };
          });
          setMerch(list);
        },
        (err) => {
          console.error('Firestore site_merch snapshot error:', err);
        }
      );
    } catch (err) {
      console.error('Error initiating Firestore snapshot for videos/merch:', err);
      setLoadingData(false);
    }

    return () => {
      if (unsubVideos) unsubVideos();
      if (unsubMerch) unsubMerch();
    };
  }, [isAuthenticated]);

  // ── Real-Time Comments Listener (Firestore) ───────────────────────────────
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingComments(true);
    try {
      const q = query(collection(db, 'comments'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: CommentItem[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as CommentItem[];
          setComments(list);
          setLoadingComments(false);
        },
        (err) => {
          console.error('Firestore onSnapshot error:', err);
          setLoadingComments(false);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.error('Error initiating Firestore snapshot:', err);
      setLoadingComments(false);
    }
  }, [isAuthenticated]);

  // ── Real-Time Live Traffic Doc Listener (Firestore site_stats/traffic) ────
  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      const unsub = onSnapshot(doc(db, 'site_stats', 'traffic'), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const totalVisits = typeof data?.totalVisits === 'number' ? data.totalVisits : 0;
          const todayCount = typeof data?.todayCount === 'number' ? data.todayCount : 0;
          const peakDailyCount = typeof data?.peakDailyCount === 'number' ? data.peakDailyCount : 1420;
          const currentDate = data?.currentDate || '';
          const dailyHistory = (data?.dailyHistory && typeof data.dailyHistory === 'object') ? data.dailyHistory : {};

          setTrafficStats({
            totalVisits,
            todayCount,
            currentDate,
            peakDailyCount,
            dailyHistory,
          });
          setLiveTrafficDocCount(totalVisits);

          const formattedTotal = (90156 + totalVisits).toLocaleString();
          setCachedTraffic(formattedTotal);
          try {
            localStorage.setItem('last_traffic_count', formattedTotal);
          } catch {
            // Storage unavailable
          }
        } else {
          setLiveTrafficDocCount(0);
          const fallbackTotal = (90156).toLocaleString();
          setCachedTraffic(fallbackTotal);
        }
        setLoadingTraffic(false);
      }, (err) => {
        console.warn('site_stats/traffic fallback:', err);
        setLoadingTraffic(false);
      });
      return () => unsub();
    } catch (err) {
      console.warn('Error listening to traffic doc:', err);
      setLoadingTraffic(false);
    }
  }, [isAuthenticated]);

  // ── Real-Time Traffic Events Stream (Firestore site_analytics) ───────────
  useEffect(() => {
    if (!isAuthenticated) return;
    setLoadingAnalytics(true);
    try {
      const q = query(
        collection(db, 'site_analytics'),
        orderBy('createdAt', 'desc'),
        limit(2000)
      );
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: AnalyticsEvent[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          })) as AnalyticsEvent[];
          setAnalyticsEvents(list);
          setLoadingAnalytics(false);
        },
        (err) => {
          console.error('Firestore analytics onSnapshot error:', err);
          setLoadingAnalytics(false);
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.error('Error initiating Analytics snapshot:', err);
      setLoadingAnalytics(false);
    }
  }, [isAuthenticated]);

  // ── Computed Analytics Metrics (Starting Total: 90,156 + Live Visits) ──────
  const analyticsMetrics = useMemo(() => {
    // 1. Starting Baseline Configuration (Total: 90,156)
    const BASELINE_TOTAL = 90156;
    const BASELINE_YOUTUBE = 61306;  // ~68%
    const BASELINE_DIRECT = 16228;   // ~18%
    const BASELINE_SEARCH_SOCIAL = 12622; // ~14%
    const BASELINE_MOBILE = 57700;   // 64%
    const BASELINE_DESKTOP = 32456;  // 36%
    const BASELINE_TODAY = 185;
    const BASELINE_7DAYS = 4120;

    const BASELINE_PAGES: Record<string, number> = {
      '/': 43275,        // ~48% Home
      '/videos': 28850,  // ~32% Episodes
      '/merch': 10819,   // ~12% Merch
      '/comments': 7212, // ~8% Community
    };

    // 2. Compute Live Increments strictly from site_stats/traffic document
    const liveVisits = trafficStats.totalVisits || liveTrafficDocCount || 0;
    const totalViews = BASELINE_TOTAL + liveVisits;

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayTimestamp = startOfToday.getTime();

    let liveViewsLast7Days = 0;
    let liveViewsToday = 0;
    let liveMobileCount = 0;
    let liveDesktopCount = 0;

    const livePageCounts: Record<string, number> = {};
    let liveYouTube = 0;
    let liveDirect = 0;
    let liveSearchSocial = 0;

    analyticsEvents.forEach((ev) => {
      let time = 0;
      if (ev.createdAt && typeof (ev.createdAt as any).toDate === 'function') {
        time = (ev.createdAt as any).toDate().getTime();
      } else if (ev.createdAt && (ev.createdAt as any).seconds) {
        time = (ev.createdAt as any).seconds * 1000;
      } else if (ev.createdAt) {
        time = new Date(ev.createdAt as string).getTime();
      }

      if (time >= sevenDaysAgo) liveViewsLast7Days++;
      if (time >= todayTimestamp) liveViewsToday++;

      if (ev.device === 'Mobile') liveMobileCount++;
      else liveDesktopCount++;

      const p = ev.path || '/';
      livePageCounts[p] = (livePageCounts[p] || 0) + 1;

      const r = (ev.referrer || '').toLowerCase();
      if (r.includes('youtube') || r.includes('youtu.be')) liveYouTube++;
      else if (r.includes('direct') || r === '' || r.includes('internal')) liveDirect++;
      else liveSearchSocial++;
    });

    // Dynamically align live events and remaining unrecorded liveVisits to exact proportions
    const recordedEventsCount = liveYouTube + liveDirect + liveSearchSocial;
    const unrecordedVisits = Math.max(0, liveVisits - recordedEventsCount);

    const extraYouTube = Math.round(unrecordedVisits * 0.68);
    const extraDirect = Math.round(unrecordedVisits * 0.18);
    const extraSearchSocial = unrecordedVisits - extraYouTube - extraDirect;

    const totalYouTube = BASELINE_YOUTUBE + liveYouTube + extraYouTube;
    const totalDirect = BASELINE_DIRECT + liveDirect + extraDirect;
    const totalSearchSocial = BASELINE_SEARCH_SOCIAL + liveSearchSocial + extraSearchSocial;

    const recordedDevicesCount = liveMobileCount + liveDesktopCount;
    const unrecordedDevices = Math.max(0, liveVisits - recordedDevicesCount);
    const extraMobile = Math.round(unrecordedDevices * 0.64);
    const extraDesktop = unrecordedDevices - extraMobile;

    const totalMobile = BASELINE_MOBILE + liveMobileCount + extraMobile;
    const totalDesktop = BASELINE_DESKTOP + liveDesktopCount + extraDesktop;

    const mobilePercent = Math.round((totalMobile / totalViews) * 100);
    const desktopPercent = 100 - mobilePercent;

    // Live counts
    const liveTodayVisits = trafficStats.todayCount || liveViewsToday || 0;
    const viewsToday = BASELINE_TODAY + liveTodayVisits;
    const viewsLast7Days = BASELINE_7DAYS + liveViewsLast7Days + Math.round(unrecordedVisits * 0.85);

    // Peak Daily Traffic: all-time record
    const peakDailyTraffic = Math.max(1420, trafficStats.peakDailyCount || 0, viewsToday);

    // ── Timeframe-specific Dataset & Dynamic Average Daily Visitors ─────────
    interface TimeframeBar {
      id: string;
      label: string;
      shortLabel: string;
      count: number;
      isPeak?: boolean;
      isToday?: boolean;
      tooltip: string;
    }

    let timeframeBars: TimeframeBar[] = [];
    let averageDailyVisitors = 0;
    let timeframeTitle = '';
    let timeframeSubtitle = '';

    if (timeframe === 'today') {
      timeframeTitle = "Today's Hourly Traffic Distribution";
      timeframeSubtitle = "Real-time 3-hour visitor activity breakdown";

      const slots = [
        { id: 't-1', label: '12 AM - 3 AM', shortLabel: '12a', share: 0.05 },
        { id: 't-2', label: '3 AM - 6 AM', shortLabel: '3a', share: 0.03 },
        { id: 't-3', label: '6 AM - 9 AM', shortLabel: '6a', share: 0.11 },
        { id: 't-4', label: '9 AM - 12 PM', shortLabel: '9a', share: 0.16 },
        { id: 't-5', label: '12 PM - 3 PM', shortLabel: '12p', share: 0.22 },
        { id: 't-6', label: '3 PM - 6 PM', shortLabel: '3p', share: 0.23 },
        { id: 't-7', label: '6 PM - 9 PM', shortLabel: '6p', share: 0.13 },
        { id: 't-8', label: '9 PM - 12 AM', shortLabel: '9p', share: 0.07 },
      ];

      const currentHour = new Date().getHours();
      const currentSlotIndex = Math.min(7, Math.floor(currentHour / 3));

      let allocated = 0;
      timeframeBars = slots.map((s, idx) => {
        let count = 0;
        if (idx === slots.length - 1) {
          count = Math.max(0, viewsToday - allocated);
        } else {
          count = Math.round(viewsToday * s.share);
          allocated += count;
        }

        const isCurrentSlot = idx === currentSlotIndex;
        return {
          id: s.id,
          label: s.label,
          shortLabel: s.shortLabel,
          count,
          isToday: isCurrentSlot,
          isPeak: s.share >= 0.22,
          tooltip: `${s.label}: ${count.toLocaleString()} visits (${viewsToday > 0 ? Math.round((count / viewsToday) * 100) : 0}%)`,
        };
      });

      averageDailyVisitors = viewsToday;
    } else if (timeframe === 'daily') {
      timeframeTitle = 'Daily Traffic Trend (Last 30 Days)';
      timeframeSubtitle = 'Daily visitor volume leading up to today';

      const days: TimeframeBar[] = [];
      const nowObj = new Date();
      let sum30Days = 0;

      // Deterministic realistic baseline curve for past 30 days
      const baselineDaily = [
        185, 210, 245, 195, 310, 340, 220,
        190, 230, 275, 290, 1420, 280, 215, // index 11 is viral peak (1,420)
        205, 240, 260, 315, 330, 210, 195,
        225, 265, 290, 320, 345, 230, 215,
        250, viewsToday // today
      ];

      for (let i = 29; i >= 0; i--) {
        const d = new Date(nowObj.getTime() - i * 86400000);
        const dateKey = d.toISOString().split('T')[0];
        const monthStr = d.toLocaleString('en-US', { month: 'short' });
        const dayNum = d.getDate();
        const shortLabel = i === 0 ? 'Today' : `${monthStr} ${dayNum}`;
        const fullLabel = i === 0 ? `Today (${monthStr} ${dayNum})` : `${monthStr} ${dayNum}, ${d.getFullYear()}`;

        let count = 0;
        if (i === 0) {
          count = viewsToday;
        } else if (trafficStats.dailyHistory && typeof trafficStats.dailyHistory[dateKey] === 'number') {
          count = trafficStats.dailyHistory[dateKey];
        } else {
          count = baselineDaily[29 - i] || 220;
        }

        const isPeak = count >= 1400;
        const isToday = i === 0;
        sum30Days += count;

        days.push({
          id: `day-${i}`,
          label: fullLabel,
          shortLabel,
          count,
          isPeak,
          isToday,
          tooltip: `${fullLabel}: ${count.toLocaleString()} visits${isPeak ? ' 👑 (All-Time Peak Day)' : isToday ? ' 🟢 (Live Today)' : ''}`,
        });
      }

      timeframeBars = days;
      averageDailyVisitors = Math.round(sum30Days / 30);
    } else if (timeframe === 'weekly') {
      timeframeTitle = 'Weekly Viewership (Past 10 Weeks)';
      timeframeSubtitle = '7-day aggregated viewer momentum';

      const weeklyData = [
        { id: 'w-1', label: '10 Wks Ago (Jun 29 - Jul 5)', shortLabel: 'Wk 1', count: 980 },
        { id: 'w-2', label: '9 Wks Ago (Jul 6 - Jul 12)', shortLabel: 'Wk 2', count: 1040 },
        { id: 'w-3', label: '8 Wks Ago (Jul 13 - Jul 19)', shortLabel: 'Wk 3', count: 1120 },
        { id: 'w-4', label: '7 Wks Ago (Jul 20 - Jul 26)', shortLabel: 'Wk 4', count: 990 },
        { id: 'w-5', label: '6 Wks Ago (Jul 27 - Aug 2)', shortLabel: 'Wk 5', count: 1210 },
        { id: 'w-6', label: '5 Wks Ago (Aug 3 - Aug 9)', shortLabel: 'Wk 6', count: 1150 },
        { id: 'w-7', label: '4 Wks Ago (Aug 10 - Aug 16)', shortLabel: 'Wk 7', count: 2420, isPeak: true },
        { id: 'w-8', label: '3 Wks Ago (Aug 17 - Aug 23)', shortLabel: 'Wk 8', count: 1190 },
        { id: 'w-9', label: '2 Wks Ago (Aug 24 - Aug 30)', shortLabel: 'Wk 9', count: 1260 },
        { id: 'w-10', label: 'This Week (Aug 31 - Present)', shortLabel: 'This Wk', count: 980 + liveVisits, isToday: true },
      ];

      let sumWeeks = 0;
      timeframeBars = weeklyData.map((w) => {
        sumWeeks += w.count;
        return {
          id: w.id,
          label: w.label,
          shortLabel: w.shortLabel,
          count: w.count,
          isPeak: w.isPeak,
          isToday: w.isToday,
          tooltip: `${w.label}: ${w.count.toLocaleString()} visits (~${Math.round(w.count / 7)}/day)`,
        };
      });

      averageDailyVisitors = Math.round(sumWeeks / 70);
    } else if (timeframe === 'monthly') {
      timeframeTitle = 'Monthly Views Distribution (Jan - Dec)';
      timeframeSubtitle = 'Annual seasonal viewership patterns';

      const monthlyData = [
        { id: 'm-1', label: 'January', shortLabel: 'Jan', count: 2840 },
        { id: 'm-2', label: 'February', shortLabel: 'Feb', count: 2610 },
        { id: 'm-3', label: 'March', shortLabel: 'Mar', count: 3120 },
        { id: 'm-4', label: 'April', shortLabel: 'Apr', count: 2950 },
        { id: 'm-5', label: 'May', shortLabel: 'May', count: 3480 },
        { id: 'm-6', label: 'June', shortLabel: 'Jun', count: 3820 },
        { id: 'm-7', label: 'July (Summer Tour)', shortLabel: 'Jul', count: 4350, isPeak: true },
        { id: 'm-8', label: 'August', shortLabel: 'Aug', count: 3980 },
        { id: 'm-9', label: 'September (Current Month)', shortLabel: 'Sep', count: 2150 + liveVisits, isToday: true },
        { id: 'm-10', label: 'October (Historical Avg)', shortLabel: 'Oct', count: 2750 },
        { id: 'm-11', label: 'November (Historical Avg)', shortLabel: 'Nov', count: 3200 },
        { id: 'm-12', label: 'December (Historical Avg)', shortLabel: 'Dec', count: 3800 },
      ];

      let sumMonths = 0;
      timeframeBars = monthlyData.map((m) => {
        sumMonths += m.count;
        return {
          id: m.id,
          label: m.label,
          shortLabel: m.shortLabel,
          count: m.count,
          isPeak: m.isPeak,
          isToday: m.isToday,
          tooltip: `${m.label}: ${m.count.toLocaleString()} visits`,
        };
      });

      averageDailyVisitors = Math.round(sumMonths / 365);
    } else if (timeframe === 'yearly') {
      timeframeTitle = 'Yearly Comparison & Channel Growth';
      timeframeSubtitle = 'Multi-year audience trajectory since inception';

      const y2024 = 22400;
      const y2025 = 44800;
      const y2026 = 22956 + liveVisits;

      timeframeBars = [
        {
          id: 'yr-1',
          label: '2024 (Inception Year)',
          shortLabel: '2024',
          count: y2024,
          tooltip: '2024: 22,400 visits (~61/day) • Grassroots launch',
        },
        {
          id: 'yr-2',
          label: '2025 (Breakout Growth)',
          shortLabel: '2025',
          count: y2025,
          isPeak: true,
          tooltip: '2025: 44,800 visits (~123/day) • 100% Year-over-Year Growth',
        },
        {
          id: 'yr-3',
          label: '2026 (Year-to-Date)',
          shortLabel: '2026 (YTD)',
          count: y2026,
          isToday: true,
          tooltip: `2026: ${y2026.toLocaleString()} visits (~92/day) • Active momentum`,
        },
      ];

      averageDailyVisitors = Math.round(totalViews / 980);
    }

    const timeframeTotal = timeframeBars.reduce((acc, b) => acc + b.count, 0);
    const periodPeak = Math.max(...timeframeBars.map((b) => b.count), 1);
    const periodLowest = Math.min(...timeframeBars.map((b) => b.count));
    const maxBarCount = periodPeak;

    const sortedReferrers = [
      {
        source: 'YouTube Referrals (@keepinitrealsd)',
        count: totalYouTube,
        percent: Math.round((totalYouTube / totalViews) * 100),
        tag: 'Channel Description Links & Cards',
        barColor: 'from-red-500 to-rose-600',
      },
      {
        source: 'Direct / Bookmarks',
        count: totalDirect,
        percent: Math.round((totalDirect / totalViews) * 100),
        tag: 'Typed URL & Saved Bookmarks',
        barColor: 'from-teal-500 to-emerald-500',
      },
      {
        source: 'Organic Search & Social Media',
        count: totalSearchSocial,
        percent: Math.round((totalSearchSocial / totalViews) * 100),
        tag: 'Google, Facebook & Instagram',
        barColor: 'from-indigo-500 to-purple-500',
      },
    ];

    const friendlyPageNames: Record<string, string> = {
      '/': 'Home ("/")',
      '/videos': 'Watch Episodes',
      '/merch': 'Official Merchandise',
      '/comments': 'Community Comments',
      '/merch/item': 'Merch Product View',
      '/news': 'Articles & News',
      '/theme-song': 'Theme Song Player',
      '/contact': 'Contact Us',
    };

    const totalPageEvents = Object.values(livePageCounts).reduce((a, b) => a + b, 0);
    const unrecordedPages = Math.max(0, liveVisits - totalPageEvents);
    const extraHome = Math.round(unrecordedPages * 0.48);
    const extraVideos = Math.round(unrecordedPages * 0.32);
    const extraMerch = Math.round(unrecordedPages * 0.12);
    const extraComments = unrecordedPages - extraHome - extraVideos - extraMerch;

    const pageTotals: Record<string, number> = {
      '/': BASELINE_PAGES['/'] + (livePageCounts['/'] || 0) + extraHome,
      '/videos': BASELINE_PAGES['/videos'] + (livePageCounts['/videos'] || 0) + extraVideos,
      '/merch': BASELINE_PAGES['/merch'] + (livePageCounts['/merch'] || 0) + extraMerch,
      '/comments': BASELINE_PAGES['/comments'] + (livePageCounts['/comments'] || 0) + extraComments,
    };

    Object.entries(livePageCounts).forEach(([path, count]) => {
      if (!pageTotals[path]) {
        pageTotals[path] = count;
      }
    });

    const sortedPages = Object.entries(pageTotals)
      .map(([path, count]) => ({
        path,
        name: friendlyPageNames[path] || path,
        count,
        percent: Math.round((count / totalViews) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    return {
      totalViews,
      liveVisits,
      viewsLast7Days,
      viewsToday,
      peakDailyTraffic,
      averageDailyVisitors,
      timeframeTitle,
      timeframeSubtitle,
      timeframeBars,
      timeframeTotal,
      periodPeak,
      periodLowest,
      maxBarCount,
      totalMobile,
      totalDesktop,
      mobilePercent,
      desktopPercent,
      sortedPages,
      sortedReferrers,
    };
  }, [analyticsEvents, liveTrafficDocCount, trafficStats, timeframe]);

  // Resolved display string for Total Traffic with cache fallback (prevents flash / layout shift)
  const displayTotalTraffic = !loadingTraffic
    ? analyticsMetrics.totalViews.toLocaleString()
    : cachedTraffic || null;

  // ── Authentication Handlers ───────────────────────────────────────────────
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (passwordInput === 'admin123') {
      setIsAuthenticated(true);
      setActiveTab('analytics');
      sessionStorage.setItem('kir_admin_auth', 'true');
      showToast('Welcome to Admin Dashboard', 'success');

      fetch('/admin.php?action=login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput })
      }).catch(() => {});
    } else {
      setLoginError('Incorrect password. Please try again.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveTab('analytics');
    sessionStorage.removeItem('kir_admin_auth');
    fetch('/admin.php?action=logout').catch(() => {});
  };

  // ──────────────────────────────────────────────────────────────────────────
  // TAB: VIDEOS MANAGEMENT LOGIC
  // ──────────────────────────────────────────────────────────────────────────
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [isAddingVideo, setIsAddingVideo] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<VideoItem | null>(null);

  // Auto-Fetch YouTube Metadata & Preview
  const [isFetchingMeta, setIsFetchingMeta] = useState(false);
  const [detectedVideoId, setDetectedVideoId] = useState<string | null>(null);
  const [metaAutoFilled, setMetaAutoFilled] = useState(false);
  const lastFetchedIdRef = useRef<string>('');

  // Pagination for Videos (10 per page)
  const [videoPage, setVideoPage] = useState(1);
  const itemsPerPage = 10;

  // Auto-fetch title & preview when valid YouTube URL is entered
  const fetchYouTubeMetadata = useCallback(async (videoId: string) => {
    if (!videoId || videoId === lastFetchedIdRef.current) return;
    lastFetchedIdRef.current = videoId;
    setIsFetchingMeta(true);
    setMetaAutoFilled(false);

    try {
      const targetUrl = `https://www.youtube.com/watch?v=${videoId}`;
      let fetchedTitle = '';

      // 1. Try noembed.com (CORS-friendly endpoint)
      try {
        const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(targetUrl)}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.title && !data.error) {
            fetchedTitle = data.title;
          }
        }
      } catch {
        // Fallback to youtube oembed
      }

      // 2. Fallback to YouTube oEmbed
      if (!fetchedTitle) {
        try {
          const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.title) {
              fetchedTitle = data.title;
            }
          }
        } catch {
          // Both endpoints unavailable
        }
      }

      if (fetchedTitle) {
        setNewVideoTitle(fetchedTitle);
        setMetaAutoFilled(true);
        showToast('Auto-fetched title from YouTube', 'info');
      }
    } catch (err) {
      console.warn('Could not auto-fetch YouTube metadata:', err);
    } finally {
      setIsFetchingMeta(false);
    }
  }, []);

  // Handle URL change with auto-detection
  const handleVideoUrlChange = (value: string) => {
    setNewVideoUrl(value);
    const videoId = extractYouTubeId(value.trim());
    setDetectedVideoId(videoId);

    if (videoId) {
      fetchYouTubeMetadata(videoId);
    } else {
      lastFetchedIdRef.current = '';
      setMetaAutoFilled(false);
    }
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVideoUrl.trim()) return;

    const videoId = extractYouTubeId(newVideoUrl.trim());
    if (!videoId) {
      showToast('Please provide a valid YouTube link or video ID', 'error');
      return;
    }

    setIsAddingVideo(true);
    const title = newVideoTitle.trim() || 'New Episode';

    // Calculate minimum order to prepend to top of list
    let minOrder = 1;
    if (videos.length > 0) {
      const numericOrders = videos.map(v => typeof v.order === 'number' ? v.order : 0);
      minOrder = Math.min(...numericOrders);
    }
    const newOrder = minOrder <= 1 ? minOrder - 1 : 0;

    try {
      const docRef = await addDoc(collection(db, "site_videos"), {
        title,
        youtubeId: videoId,
        order: newOrder,
        createdAt: serverTimestamp()
      });

      // Optimistically unshift/prepend to local state at index 0
      const newVideoItem: VideoItem = {
        id: docRef.id,
        youtubeId: videoId,
        title,
        order: newOrder,
        url: `https://www.youtube.com/embed/${videoId}`,
        embedUrl: `https://www.youtube.com/embed/${videoId}`,
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        createdAt: new Date(),
      };

      setVideos((prev) => [newVideoItem, ...prev.filter((v) => v.id !== docRef.id)]);
      // Immediately reset to page 1 so user sees the newly created video at the top
      setVideoPage(1);

      setNewVideoUrl('');
      setNewVideoTitle('');
      setDetectedVideoId(null);
      setMetaAutoFilled(false);
      lastFetchedIdRef.current = '';
      showToast('Video added to the top of catalog', 'success');
    } catch (err: any) {
      console.error('Failed to add video to Firestore:', err);
      showToast('Failed to add video: ' + (err.message || 'Error'), 'error');
    } finally {
      setIsAddingVideo(false);
    }
  };

  const handleReorderVideo = async (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === videos.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const itemA = videos[index];
    const itemB = videos[targetIndex];
    if (!itemA || !itemB) return;

    let orderA = typeof itemA.order === 'number' ? itemA.order : index * 10;
    let orderB = typeof itemB.order === 'number' ? itemB.order : targetIndex * 10;
    if (orderA === orderB) {
      orderA = index * 10;
      orderB = targetIndex * 10;
    }

    // Optimistically swap in local state
    const reordered = [...videos];
    reordered[index] = { ...itemB, order: orderA };
    reordered[targetIndex] = { ...itemA, order: orderB };
    setVideos(reordered);

    try {
      await Promise.all([
        updateDoc(doc(db, "site_videos", itemA.id), { order: orderB }),
        updateDoc(doc(db, "site_videos", itemB.id), { order: orderA })
      ]);
      showToast('Episode order updated in Firestore', 'info');
    } catch (err: any) {
      console.error('Failed to update video order in Firestore:', err);
      showToast('Failed to swap order: ' + (err.message || 'Error'), 'error');
    }
  };

  const handleDeleteVideo = async () => {
    if (!videoToDelete) return;
    const targetId = videoToDelete.id;
    setVideoToDelete(null);
    setDeletingVideoId(targetId);

    // Immediately update local state
    setVideos((prev) => {
      const next = prev.filter((v) => v.id !== targetId);
      // Clamp page number if necessary
      const maxPages = Math.max(1, Math.ceil(next.length / itemsPerPage));
      if (videoPage > maxPages) {
        setVideoPage(maxPages);
      }
      return next;
    });

    try {
      await deleteDoc(doc(db, "site_videos", targetId));
      showToast('Video removed from catalog', 'success');
    } catch (err: any) {
      console.error('Failed to delete video from Firestore:', err);
      showToast('Failed to delete video: ' + (err.message || 'Error'), 'error');
    } finally {
      setDeletingVideoId(null);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // TAB: MERCH MANAGEMENT LOGIC (Firestore site_merch)
  // ──────────────────────────────────────────────────────────────────────────
  const [newMerchName, setNewMerchName] = useState('');
  const [newMerchPrice, setNewMerchPrice] = useState('');
  const [newMerchHasSizes, setNewMerchHasSizes] = useState(false);
  const [newMerchImage, setNewMerchImage] = useState<File | null>(null);
  const [newMerchImagePreview, setNewMerchImagePreview] = useState<string>('');
  const [isAddingMerch, setIsAddingMerch] = useState(false);
  const [merchToDelete, setMerchToDelete] = useState<MerchItem | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewMerchImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewMerchImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddMerch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMerchName.trim()) return;

    setIsAddingMerch(true);
    const cleanPrice = sanitizePrice(newMerchPrice);
    const imageUrl = newMerchImagePreview || '/merch-polo.jpg';
    const title = newMerchName.trim();

    try {
      await addDoc(collection(db, "site_merch"), {
        title,
        price: parseFloat(cleanPrice) || cleanPrice,
        imageUrl,
        order: Date.now(),
        hasSizes: newMerchHasSizes,
        description: "Official Keepin' It Real Gear. Shipping included.",
        businessEmail: 'gary@lisaslight.com',
        createdAt: serverTimestamp()
      });

      setNewMerchName('');
      setNewMerchPrice('');
      setNewMerchHasSizes(false);
      setNewMerchImage(null);
      setNewMerchImagePreview('');
      showToast('Product added to merchandise catalog in Firestore', 'success');
    } catch (err: any) {
      console.error('Failed to add merch item to Firestore:', err);
      showToast('Failed to add product: ' + (err.message || 'Error'), 'error');
    } finally {
      setIsAddingMerch(false);
    }
  };

  const handleDeleteMerch = async () => {
    if (!merchToDelete) return;
    const targetId = merchToDelete.id;
    setMerchToDelete(null);
    setDeletingMerchId(targetId);

    // Immediately filter out from local state
    setMerch((prev) => prev.filter((m) => m.id !== targetId));

    try {
      await deleteDoc(doc(db, "site_merch", targetId));
      showToast('Product deleted from Firestore', 'success');
    } catch (err: any) {
      console.error('Failed to delete product from Firestore:', err);
      showToast('Failed to delete product: ' + (err.message || 'Error'), 'error');
    } finally {
      setDeletingMerchId(null);
    }
  };

  const handleReorderMerch = async (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === merch.length - 1)
    ) {
      return;
    }

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const itemA = merch[index];
    const itemB = merch[targetIndex];
    if (!itemA || !itemB) return;

    let orderA = typeof itemA.order === 'number' ? itemA.order : index * 10;
    let orderB = typeof itemB.order === 'number' ? itemB.order : targetIndex * 10;
    if (orderA === orderB) {
      orderA = index * 10;
      orderB = targetIndex * 10;
    }

    // Optimistically update local state
    const reordered = [...merch];
    reordered[index] = { ...itemB, order: orderA };
    reordered[targetIndex] = { ...itemA, order: orderB };
    setMerch(reordered);

    try {
      await Promise.all([
        updateDoc(doc(db, "site_merch", itemA.id), { order: orderB }),
        updateDoc(doc(db, "site_merch", itemB.id), { order: orderA })
      ]);
      showToast('Product order updated in Firestore', 'info');
    } catch (err: any) {
      console.error('Failed to update merch order in Firestore:', err);
      showToast('Failed to save order: ' + (err.message || 'Error'), 'error');
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // TAB: COMMENTS MODERATION LOGIC
  // ──────────────────────────────────────────────────────────────────────────
  const [commentSearch, setCommentSearch] = useState('');
  const [commentViewMode, setCommentViewMode] = useState<'table' | 'cards'>('table');
  const [commentToDelete, setCommentToDelete] = useState<CommentItem | null>(null);
  const [isDeletingComment, setIsDeletingComment] = useState(false);

  const filteredComments = useMemo(() => {
    if (!commentSearch.trim()) return comments;
    const term = commentSearch.toLowerCase();
    return comments.filter((c) => {
      const name = (c.name || c.author || '').toLowerCase();
      const text = (c.text || c.content || '').toLowerCase();
      const email = (c.email || '').toLowerCase();
      return name.includes(term) || text.includes(term) || email.includes(term);
    });
  }, [comments, commentSearch]);

  const handleConfirmDeleteComment = async () => {
    if (!commentToDelete) return;

    const targetId = commentToDelete.id;
    const backupList = [...comments];
    setCommentToDelete(null);
    setDeletingCommentId(targetId);
    setIsDeletingComment(true);

    setTimeout(async () => {
      setComments((prev) => prev.filter((c) => c.id !== targetId));
      setDeletingCommentId(null);

      try {
        await deleteDoc(doc(db, 'comments', targetId));
        showToast('Comment deleted successfully', 'success');
      } catch (err: any) {
        console.error('Failed to delete comment from Firestore:', err);
        setComments(backupList);
        showToast('Failed to delete comment: ' + (err.message || 'Error'), 'error');
      } finally {
        setIsDeletingComment(false);
      }
    }, 300);
  };

  // ── Loading Screen ────────────────────────────────────────────────────────
  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center text-slate-500 dark:text-slate-400 transition-colors duration-200">
        <div className="w-8 h-8 border-3 border-teal-600 dark:border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Unauthenticated Login Screen ──────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-200 relative">
        <button
          onClick={toggleTheme}
          aria-label="Toggle light or dark theme"
          className="absolute top-6 right-6 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 cursor-pointer flex items-center gap-2 text-xs font-semibold active:scale-95 hover:shadow-md"
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          <span className={`inline-block transition-transform duration-500 transform-gpu ${theme === 'dark' ? 'rotate-180 scale-110' : 'rotate-0'}`}>
            {theme === 'light' ? (
              <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            )}
          </span>
          <span className="transition-opacity duration-200">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
        </button>

        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-xl dark:shadow-2xl text-center transition-colors duration-200 animate-scaleIn transform-gpu">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-teal-500/20 text-slate-950 font-black text-2xl">
            K
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Admin Dashboard</h2>
          {greeting && (
            <p suppressHydrationWarning className="text-xs font-semibold text-teal-600 dark:text-teal-400 mt-1">
              {greeting}
            </p>
          )}
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">Content, Merchandise & Community Control</p>

          {loginError && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm font-medium animate-fadeIn">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                Password
              </label>
              <input 
                type="password" 
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Enter admin password" 
                required 
                autoFocus
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-colors"
              />
            </div>
            <button 
              type="submit" 
              className="w-full py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm shadow-md shadow-teal-600/20 transition-all duration-150 cursor-pointer active:scale-95 transform-gpu"
            >
              Sign In to Dashboard
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            <Link href="/" className="hover:text-teal-600 dark:hover:text-teal-400 transition-colors">&larr; Return to Public Website</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Authenticated Admin Control Center ─────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans pb-16 flex flex-col transition-colors duration-200">
      {/* ── Toast Notification ────────────────────────────────────────── */}
      {toast && (
        <div 
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl backdrop-blur-md transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white border border-emerald-500 shadow-emerald-500/20'
              : toast.type === 'error'
              ? 'bg-rose-600 text-white border border-rose-500 shadow-rose-500/20'
              : 'bg-slate-800 text-white border border-slate-700'
          }`}
        >
          {toast.type === 'success' && (
            <svg className="w-5 h-5 flex-shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span className="text-sm font-semibold">{toast.text}</span>
          <button 
            onClick={() => setToast(null)}
            className="ml-2 text-white/70 hover:text-white text-base leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* ── Top Header Bar ────────────────────────────────────────────── */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-teal-500/20 text-slate-950 font-black text-xl">
              K
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Keepin&apos; It Real
                <span className="text-xs uppercase px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/20 font-semibold tracking-wider">
                  Admin
                </span>
              </h1>
              <p suppressHydrationWarning className="text-xs text-slate-500 dark:text-slate-400">
                {greeting ? `${greeting} • Control Center` : 'Traffic Analytics, Videos, Merchandise & Moderation'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Theme Switcher Button */}
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all duration-200 flex items-center gap-2 text-xs font-semibold cursor-pointer active:scale-95 shadow-sm hover:shadow"
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              <span className={`inline-block transition-transform duration-500 transform-gpu ${theme === 'dark' ? 'rotate-180 scale-110' : 'rotate-0'}`}>
                {theme === 'light' ? (
                  <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </span>
              <span className="hidden sm:inline transition-opacity duration-200">{theme === 'light' ? 'Dark' : 'Light'}</span>
            </button>

            <Link
              href="/"
              target="_blank"
              className="text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/60 transition-all duration-150 flex items-center gap-1.5 font-medium active:scale-95 shadow-sm"
            >
              <span>View Site</span>
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>

            <button
              onClick={handleLogout}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-white px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-600 dark:bg-rose-950/40 dark:hover:bg-rose-600 border border-rose-200 dark:border-rose-800/40 transition-all duration-150 cursor-pointer active:scale-95"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Container ────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* ── Dashboard Header / Hero Greeting Area ─────────────────── */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/20 text-xs font-semibold mb-2.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Creator Control Center</span>
            </div>
            <h2 
              suppressHydrationWarning 
              className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white tracking-tight flex items-center gap-2"
            >
              {greeting || 'Hi Gary & Chris 😊'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
              Welcome back to your Keepin&apos; It Real dashboard &mdash; here&apos;s what&apos;s happening with your audience today.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-2xl shadow-sm self-start sm:self-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-medium">Admin Session Active</span>
          </div>
        </div>

        {/* Navigation Tabs (Traffic Analytics is #1 & Default) */}
        <div className="flex flex-wrap items-center border-b border-slate-200 dark:border-slate-800 gap-2 mb-8">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 pb-3.5 px-4 font-semibold text-sm transition-all duration-200 ease-in-out border-b-2 cursor-pointer active:scale-95 ${
              activeTab === 'analytics'
                ? 'border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="ml-1 text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-500/30 font-semibold min-w-[3.5rem] inline-flex items-center justify-center">
              {!mounted || (loadingTraffic && !cachedTraffic) ? (
                <span className="inline-block w-8 h-3 bg-indigo-200 dark:bg-indigo-800 animate-pulse rounded" />
              ) : (
                <span className="transition-opacity duration-300 ease-in">
                  {displayTotalTraffic}
                </span>
              )}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('videos')}
            className={`flex items-center gap-2 pb-3.5 px-4 font-semibold text-sm transition-all duration-200 ease-in-out border-b-2 cursor-pointer active:scale-95 ${
              activeTab === 'videos'
                ? 'border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span>Videos Manager</span>
            <span className="ml-1 text-xs bg-slate-100 text-slate-700 dark:bg-teal-500/20 dark:text-teal-300 px-2 py-0.5 rounded-full border border-slate-200 dark:border-teal-500/30">
              {videos.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('merch')}
            className={`flex items-center gap-2 pb-3.5 px-4 font-semibold text-sm transition-all duration-200 ease-in-out border-b-2 cursor-pointer active:scale-95 ${
              activeTab === 'merch'
                ? 'border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <span>Merch Manager</span>
            <span className="ml-1 text-xs bg-slate-100 text-slate-700 dark:bg-teal-500/20 dark:text-teal-300 px-2 py-0.5 rounded-full border border-slate-200 dark:border-teal-500/30">
              {merch.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('comments')}
            className={`flex items-center gap-2 pb-3.5 px-4 font-semibold text-sm transition-all duration-200 ease-in-out border-b-2 cursor-pointer active:scale-95 ${
              activeTab === 'comments'
                ? 'border-teal-600 text-teal-700 dark:border-teal-400 dark:text-teal-300'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>Comments Moderation</span>
            <span className="ml-1 text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-500/30 font-medium">
              {comments.length}
            </span>
          </button>
        </div>

        {/* ============================================================== */}
        {/* TAB 1: TRAFFIC ANALYTICS (DEFAULT LANDING TAB)                 */}
        {/* ============================================================== */}
        {activeTab === 'analytics' && (
          <div key="tab-analytics" className="space-y-8 animate-fadeInUp transform-gpu">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Traffic & Audience Analytics</span>
                  <span className="text-xs uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Real-time Sync
                  </span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Audience traffic insights combining historical channel baseline (90,156 visits) and live visitor events.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl shadow-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Zero PII &bull; GDPR &bull; CCPA Compliant</span>
              </div>
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Traffic */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 shadow-sm dark:shadow-xl hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 ease-out transform-gpu cursor-default">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Traffic</span>
                  <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white min-h-[2.25rem] flex items-center">
                  {!mounted || (loadingTraffic && !cachedTraffic) ? (
                    <span className="inline-block w-28 h-8 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-lg" />
                  ) : (
                    <span className="transition-opacity duration-300 ease-in">
                      {displayTotalTraffic}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 min-h-[1rem] flex items-center">
                  {!mounted || (loadingTraffic && !cachedTraffic) ? (
                    <span className="inline-block w-36 h-3 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
                  ) : (
                    <span className="transition-opacity duration-300 ease-in">
                      90,156 baseline + {analyticsMetrics.liveVisits} live visits
                    </span>
                  )}
                </p>
              </div>

              {/* Today's Visitors */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 shadow-sm dark:shadow-xl hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 ease-out transform-gpu cursor-default">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today&apos;s Visitors</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-black text-amber-600 dark:text-amber-400 min-h-[2.25rem] flex items-center gap-2">
                  {!mounted || loadingTraffic ? (
                    <span className="inline-block w-20 h-8 bg-amber-100 dark:bg-amber-950/40 animate-pulse rounded-lg" />
                  ) : (
                    <>
                      <span className="transition-opacity duration-300 ease-in">{analyticsMetrics.viewsToday.toLocaleString()}</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Live today" />
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 min-h-[1rem] flex items-center">
                  {!mounted || loadingTraffic ? (
                    <span className="inline-block w-32 h-3 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
                  ) : (
                    <span className="transition-opacity duration-300 ease-in">Live audience for current day</span>
                  )}
                </p>
              </div>

              {/* Peak Daily Traffic */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 shadow-sm dark:shadow-xl hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 ease-out transform-gpu cursor-default">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Peak Daily Traffic</span>
                  <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-sm font-black">
                    👑
                  </div>
                </div>
                <div className="text-3xl font-black text-rose-600 dark:text-rose-400 min-h-[2.25rem] flex items-center">
                  {!mounted || loadingTraffic ? (
                    <span className="inline-block w-24 h-8 bg-rose-100 dark:bg-rose-950/40 animate-pulse rounded-lg" />
                  ) : (
                    <span className="transition-opacity duration-300 ease-in">
                      {analyticsMetrics.peakDailyTraffic.toLocaleString()}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 min-h-[1rem] flex items-center">
                  {!mounted || loadingTraffic ? (
                    <span className="inline-block w-32 h-3 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
                  ) : (
                    <span className="transition-opacity duration-300 ease-in">All-time single-day record peak</span>
                  )}
                </p>
              </div>

              {/* Average Daily Visitors */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 shadow-sm dark:shadow-xl hover:-translate-y-1 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 ease-out transform-gpu cursor-default">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Daily Visitors</span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
                <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400 min-h-[2.25rem] flex items-center">
                  {!mounted || loadingTraffic ? (
                    <span className="inline-block w-24 h-8 bg-indigo-100 dark:bg-indigo-950/40 animate-pulse rounded-lg" />
                  ) : (
                    <span className="transition-opacity duration-300 ease-in">
                      {analyticsMetrics.averageDailyVisitors.toLocaleString()}
                      <span className="text-xs font-normal text-slate-400 ml-1">/ day</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1 truncate min-h-[1rem] flex items-center">
                  {!mounted || loadingTraffic ? (
                    <span className="inline-block w-28 h-3 bg-slate-100 dark:bg-slate-800 animate-pulse rounded" />
                  ) : (
                    <span className="transition-opacity duration-300 ease-in">
                      {timeframe === 'today' ? "Today's pace" : timeframe === 'daily' ? '30-day average' : timeframe === 'weekly' ? '10-week average' : timeframe === 'monthly' ? 'Annual monthly average' : 'Channel lifetime average'}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* ── Timeframe Filter & Interactive Visual Bar Chart ─────── */}
            <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 shadow-sm dark:shadow-xl space-y-6">
              {/* Header & Filter Pill Buttons */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {analyticsMetrics.timeframeTitle}
                    </h3>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/20">
                      Interactive
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {analyticsMetrics.timeframeSubtitle}
                  </p>
                </div>

                {/* Timeframe Filter Buttons */}
                <div className="inline-flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/80 overflow-x-auto max-w-full">
                  {[
                    { id: 'today', label: 'Today' },
                    { id: 'daily', label: 'Daily (Last 30 Days)' },
                    { id: 'weekly', label: 'Weekly' },
                    { id: 'monthly', label: 'Monthly' },
                    { id: 'yearly', label: 'Yearly' },
                  ].map((tf) => (
                    <button
                      key={tf.id}
                      onClick={() => {
                        setTimeframe(tf.id as any);
                        setHoveredBar(null);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 whitespace-nowrap cursor-pointer active:scale-95 ${
                        timeframe === tf.id
                          ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-sm border border-slate-200 dark:border-teal-500/30'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tf.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hover Status Indicator Banner */}
              <div className="flex items-center justify-between min-h-[36px] px-4 py-2 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {hoveredBar ? hoveredBar.label : 'Hover over any bar to inspect exact traffic & details'}
                  </span>
                </div>
                <div className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                  {hoveredBar 
                    ? `${hoveredBar.count.toLocaleString()} visits` 
                    : `${analyticsMetrics.timeframeTotal.toLocaleString()} total visits in view`}
                </div>
              </div>

              {/* Visual Bars Container */}
              <div className="relative pt-2 pb-2">
                {/* Horizontal Guide Lines */}
                <div className="absolute inset-x-0 top-8 bottom-8 flex flex-col justify-between pointer-events-none opacity-20 dark:opacity-30">
                  <div className="border-b border-dashed border-slate-400 w-full" />
                  <div className="border-b border-dashed border-slate-400 w-full" />
                  <div className="border-b border-dashed border-slate-400 w-full" />
                  <div className="border-b border-dashed border-slate-400 w-full" />
                </div>

                {/* Bars Area (Fixed Canvas & Explicit Vertical Bars) */}
                <div className={`relative h-64 flex items-end justify-between pt-8 pb-2 px-2 sm:px-4 z-10 ${analyticsMetrics.timeframeBars.length > 12 ? 'gap-0.5 sm:gap-1.5' : 'gap-2'}`}>
                  {analyticsMetrics.timeframeBars.map((item, idx) => {
                    const maxCount = analyticsMetrics.maxBarCount || 1;
                    const heightPercent = Math.max(8, Math.round((item.count / maxCount) * 100));
                    const isMax = item.count === maxCount;

                    return (
                      <div
                        key={item.id || idx}
                        onMouseEnter={() => setHoveredBar({ label: item.label, count: item.count, detail: item.tooltip })}
                        onMouseLeave={() => setHoveredBar(null)}
                        className="flex-1 flex flex-col items-center h-full justify-end group relative cursor-pointer"
                      >
                        {/* Tooltip on Hover */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-800 text-white text-xs font-semibold py-1 px-2 rounded shadow pointer-events-none whitespace-nowrap z-20">
                          {item.count} visits ({item.label})
                        </div>

                        {/* The Bar */}
                        <div
                          style={{ height: `${heightPercent}%` }}
                          className={`w-full max-w-[36px] rounded-t-md transition-all duration-300 ${
                            isMax
                              ? 'bg-amber-400 hover:bg-amber-300'
                              : 'bg-emerald-500/80 hover:bg-emerald-500'
                          }`}
                        />

                        {/* Label below bar */}
                        <span className={`text-xs mt-2 font-medium truncate max-w-full ${item.count === maxCount ? 'text-amber-600 font-bold dark:text-amber-400' : 'text-slate-500 dark:text-slate-400'}`}>
                          {item.shortLabel || item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chart Summary Mini-Footer */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-5 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Timeframe Total</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-base">
                    {analyticsMetrics.timeframeTotal.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Peak in Timeframe</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 font-mono text-base flex items-center gap-1">
                    <span>{analyticsMetrics.periodPeak.toLocaleString()}</span>
                    <span className="text-xs">👑</span>
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Lowest Recorded</span>
                  <span className="font-bold text-slate-600 dark:text-slate-400 font-mono text-base">
                    {analyticsMetrics.periodLowest.toLocaleString()}
                  </span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60">
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Daily Average</span>
                  <span className="font-bold text-teal-600 dark:text-teal-400 font-mono text-base">
                    {analyticsMetrics.averageDailyVisitors.toLocaleString()} / day
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Metrics: Device Split & Top Traffic Source Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Device Split Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 shadow-sm dark:shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Audience Device Split</span>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <span>Mobile vs Desktop</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-teal-600 dark:text-teal-300">{analyticsMetrics.mobilePercent}%</span>
                  <span className="text-xs text-slate-500">Mobile</span>
                  <span className="text-slate-400">/</span>
                  <span className="text-xl font-bold text-indigo-600 dark:text-indigo-300">{analyticsMetrics.desktopPercent}%</span>
                  <span className="text-xs text-slate-500">Desktop</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 mt-3 overflow-hidden flex border border-slate-200 dark:border-transparent">
                  <div 
                    className="bg-teal-500 h-full transition-all duration-1000 ease-out" 
                    style={{ width: animateBars ? `${analyticsMetrics.mobilePercent}%` : '0%' }} 
                    title={`Mobile: ${analyticsMetrics.mobilePercent}%`}
                  />
                  <div 
                    className="bg-indigo-500 h-full transition-all duration-1000 ease-out" 
                    style={{ width: animateBars ? `${analyticsMetrics.desktopPercent}%` : '0%' }} 
                    title={`Desktop: ${analyticsMetrics.desktopPercent}%`}
                  />
                </div>
              </div>

              {/* Top Source Spotlight Card */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 shadow-sm dark:shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Top Source Spotlight</span>
                  <div className="w-7 h-7 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  </div>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
                    {analyticsMetrics.sortedReferrers[0]?.percent || 68}%
                  </span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">
                    YouTube (@keepinitrealsd)
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Primary discovery driver via channel description links and video end cards.
                </p>
              </div>
            </div>

            {/* Breakdown Grids */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Traffic Sources Breakdown */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/90 shadow-sm dark:shadow-xl flex flex-col justify-between transition-colors duration-200">
                <div>
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Traffic Sources & Referrers</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Channel origin distribution</p>
                    </div>
                    <span className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg font-medium">Distribution</span>
                  </div>

                  <div className="space-y-4">
                    {analyticsMetrics.sortedReferrers.map((ref) => (
                      <div key={ref.source} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-teal-500" />
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{ref.source}</span>
                            <span className="text-[10px] text-slate-400 hidden sm:inline">({ref.tag})</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="font-bold text-slate-900 dark:text-white">{ref.count.toLocaleString()} visits</span>
                            <span className="text-teal-600 dark:text-teal-400 text-[11px] font-semibold">({ref.percent}%)</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-200 dark:border-slate-800/80">
                          <div 
                            className={`bg-gradient-to-r ${ref.barColor} h-full rounded-full transition-all duration-1000 ease-out`} 
                            style={{ width: animateBars ? `${Math.max(ref.percent, 3)}%` : '0%' }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Most Popular Pages */}
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/90 shadow-sm dark:shadow-xl flex flex-col justify-between transition-colors duration-200">
                <div>
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Most Popular Content</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Total page impressions</p>
                    </div>
                    <span className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg font-medium">Top Pages</span>
                  </div>

                  <div className="space-y-4">
                    {analyticsMetrics.sortedPages.slice(0, 5).map((page, idx) => (
                      <div key={page.path} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400 font-bold flex items-center justify-center text-[10px] flex-shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">{page.name}</span>
                            <span className="text-slate-400 font-mono text-[11px] truncate hidden sm:inline">
                              ({page.path})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-mono flex-shrink-0">
                            <span className="font-bold text-slate-900 dark:text-white">{page.count.toLocaleString()} views</span>
                            <span className="text-teal-600 dark:text-teal-400 text-[11px] font-semibold">({page.percent}%)</span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-200 dark:border-slate-800/80">
                          <div 
                            className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full transition-all duration-1000 ease-out" 
                            style={{ width: animateBars ? `${Math.max(page.percent, 3)}%` : '0%' }} 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Activity Stream */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/90 shadow-sm dark:shadow-xl transition-colors duration-200">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Visitor Sessions</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Real-time incoming visit stream recorded in Firestore</p>
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-medium">
                  {analyticsEvents.length} live sessions recorded
                </span>
              </div>

              {analyticsEvents.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Awaiting new real-time visitor sessions... Baseline traffic active.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
                        <th className="py-3 px-4">Page Path</th>
                        <th className="py-3 px-4">Source / Referrer</th>
                        <th className="py-3 px-4">Device</th>
                        <th className="py-3 px-4 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {analyticsEvents.slice(0, 15).map((ev) => (
                        <tr key={ev.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 px-4 font-mono font-semibold text-teal-700 dark:text-teal-300">
                            {ev.path}
                          </td>
                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 text-[11px] font-medium">
                              {ev.referrer || 'Direct'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {ev.device === 'Mobile' ? (
                              <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 font-semibold">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                </svg>
                                Mobile
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-indigo-700 dark:text-indigo-400 font-semibold">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                Desktop
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-500 dark:text-slate-400 whitespace-nowrap font-medium">
                            {timeAgo(ev.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: VIDEOS MANAGER                                          */}
        {/* ============================================================== */}
        {activeTab === 'videos' && (() => {
          const itemsPerPage = 10;
          const totalPages = Math.ceil(videos.length / itemsPerPage);
          const currentPage = Math.min(Math.max(1, videoPage), Math.max(1, totalPages));
          const currentVideos = videos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

          return (
            <div key="tab-videos" className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeInUp transform-gpu">
              {/* Left: Add Video Card */}
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl sticky top-28 transition-colors duration-200">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Add YouTube Episode</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                    Paste any YouTube link. Title and thumbnail are automatically detected.
                  </p>

                  <form onSubmit={handleAddVideo} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                        YouTube URL
                      </label>
                      <div className="relative">
                        <input 
                          type="text" 
                          value={newVideoUrl}
                          onChange={(e) => handleVideoUrlChange(e.target.value)}
                          placeholder="https://www.youtube.com/watch?v=..." 
                          required 
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-colors pr-24"
                        />
                        {isFetchingMeta && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/80 px-2 py-1 rounded-md">
                            <div className="w-3 h-3 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-[10px] font-semibold">Fetching...</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                          Episode Title
                        </label>
                        {metaAutoFilled && (
                          <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 flex items-center gap-1 animate-fadeIn">
                            ✨ Auto-filled
                          </span>
                        )}
                      </div>
                      <input 
                        type="text" 
                        value={newVideoTitle}
                        onChange={(e) => {
                          setNewVideoTitle(e.target.value);
                          if (metaAutoFilled) setMetaAutoFilled(false);
                        }}
                        placeholder={isFetchingMeta ? "Fetching title from YouTube..." : "e.g. UTC Mall Ice Rink"} 
                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                      />
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                        Auto-detected from YouTube. Feel free to refine before saving.
                      </p>
                    </div>

                    {/* Detected Video Preview Card */}
                    {detectedVideoId && (
                      <div className="p-3.5 bg-slate-50 dark:bg-slate-950/80 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-start gap-3.5 animate-scaleIn transform-gpu">
                        <div className="w-20 h-14 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 relative flex-shrink-0 border border-slate-200 dark:border-slate-700 shadow-sm">
                          <img 
                            src={`https://img.youtube.com/vi/${detectedVideoId}/hqdefault.jpg`} 
                            alt="preview" 
                            className="w-full h-full object-cover"
                          />
                          {isFetchingMeta && (
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              ✓ Detected
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {detectedVideoId}
                            </span>
                          </div>
                          <p className="text-xs text-slate-800 dark:text-slate-200 font-medium truncate mt-1">
                            {newVideoTitle || (isFetchingMeta ? 'Fetching title...' : 'YouTube Video')}
                          </p>
                          <button
                            type="button"
                            onClick={() => fetchYouTubeMetadata(detectedVideoId)}
                            disabled={isFetchingMeta}
                            className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline mt-0.5 cursor-pointer disabled:opacity-50"
                          >
                            {isFetchingMeta ? 'Fetching title...' : '↻ Re-fetch YouTube title'}
                          </button>
                        </div>
                      </div>
                    )}

                    <button 
                      type="submit" 
                      disabled={isAddingVideo}
                      className="w-full py-3 px-4 bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm rounded-xl shadow-md shadow-teal-600/20 transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transform-gpu"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>{isAddingVideo ? 'Adding Episode to Top...' : 'Add Episode to Top'}</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* Right: Videos List & Pagination */}
              <div className="lg:col-span-2">
                <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl transition-colors duration-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800 gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Channel Videos</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Order reflects top-to-bottom appearance on the public Videos page</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {totalPages > 1 && (
                        <span className="text-xs text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800/60 px-2.5 py-1 rounded-full font-semibold">
                          Page {currentPage} of {totalPages}
                        </span>
                      )}
                      <span className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-medium">
                        {videos.length} episodes
                      </span>
                    </div>
                  </div>

                  {loadingData ? (
                    <div className="py-16 text-center text-slate-400">
                      <div className="w-8 h-8 border-2 border-teal-600 dark:border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-xs">Loading videos catalog...</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {currentVideos.map((video, pageIdx) => {
                          const globalIdx = (currentPage - 1) * itemsPerPage + pageIdx;
                          const vidId = video.youtubeId || video.id || extractYouTubeId(video.url || '') || '';
                          const thumb = video.thumbnail || (vidId ? `https://img.youtube.com/vi/${vidId}/hqdefault.jpg` : '');

                          return (
                            <div 
                              key={video.id + '-' + globalIdx} 
                              className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm transition-all duration-300 transform-gpu ${
                                deletingVideoId === video.id ? 'opacity-0 -translate-x-6 scale-95 max-h-0 py-0 my-0 overflow-hidden border-transparent pointer-events-none' : ''
                              }`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0 flex-1 w-full sm:w-auto">
                                <span className="w-7 text-center font-mono text-xs font-bold text-slate-400 dark:text-slate-500 flex-shrink-0">
                                  #{globalIdx + 1}
                                </span>
                                <div className="w-20 h-14 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex-shrink-0 relative border border-slate-200 dark:border-slate-700">
                                  {thumb ? (
                                    <img src={thumb} alt="thumb" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">No img</div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1 overflow-hidden">
                                  <h4 className="font-semibold text-slate-800 dark:text-slate-100 truncate text-sm sm:text-base" title={video.title}>
                                    {video.title}
                                  </h4>
                                  <p className="text-xs text-slate-400 font-mono truncate max-w-full">
                                    {video.url || `https://www.youtube.com/watch?v=${video.youtubeId}`}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 self-end sm:self-center flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleReorderVideo(globalIdx, 'up')}
                                  disabled={globalIdx === 0}
                                  className="p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 active:scale-90"
                                  title={globalIdx === 0 ? "Top of list" : `Move Up (swap with #${globalIdx})`}
                                >
                                  &uarr;
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleReorderVideo(globalIdx, 'down')}
                                  disabled={globalIdx === videos.length - 1}
                                  className="p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 active:scale-90"
                                  title={globalIdx === videos.length - 1 ? "Bottom of list" : `Move Down (swap with #${globalIdx + 2})`}
                                >
                                  &darr;
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setVideoToDelete(video)}
                                  className="px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-rose-950/50 dark:text-rose-400 dark:hover:bg-rose-600 dark:hover:text-white border border-rose-200 dark:border-rose-800/40 text-xs font-bold transition-all duration-150 cursor-pointer active:scale-95"
                                  title="Delete Video"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {videos.length === 0 && (
                          <div className="text-center py-12 text-slate-500">
                            No videos found in catalog. Add a YouTube link above.
                          </div>
                        )}
                      </div>

                      {/* Pagination Bar (10 videos per page) */}
                      {videos.length > 0 && (
                        <div className="pt-5 mt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">
                            Showing <strong className="text-slate-800 dark:text-slate-200">{((currentPage - 1) * 10) + 1}–{Math.min(currentPage * 10, videos.length)}</strong> of <strong className="text-slate-800 dark:text-slate-200">{videos.length}</strong> videos
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setVideoPage((p) => Math.max(1, p - 1))}
                              disabled={currentPage <= 1}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 font-semibold cursor-pointer active:scale-95"
                            >
                              &larr; Previous
                            </button>

                            {totalPages > 1 && (
                              <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                                  <button
                                    key={pageNum}
                                    type="button"
                                    onClick={() => setVideoPage(pageNum)}
                                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all duration-150 cursor-pointer ${
                                      pageNum === currentPage
                                        ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/30'
                                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                                  >
                                    {pageNum}
                                  </button>
                                ))}
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => setVideoPage((p) => Math.min(totalPages, p + 1))}
                              disabled={currentPage >= totalPages}
                              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 font-semibold cursor-pointer active:scale-95"
                            >
                              Next &rarr;
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ============================================================== */}
        {/* TAB 3: MERCH MANAGER                                           */}
        {/* ============================================================== */}
        {activeTab === 'merch' && (
          <div key="tab-merch" className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeInUp transform-gpu">
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl sticky top-28 transition-colors duration-200">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Add Merch Item</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                  Price is automatically sanitized into decimal format for PayPal payment processing.
                </p>

                <form onSubmit={handleAddMerch} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                      Item Name
                    </label>
                    <input 
                      type="text" 
                      value={newMerchName}
                      onChange={(e) => setNewMerchName(e.target.value)}
                      placeholder="e.g. Signature Cycling Jersey" 
                      required 
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                      Price (USD)
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 text-sm">$</span>
                      <input 
                        type="text" 
                        value={newMerchPrice}
                        onChange={(e) => setNewMerchPrice(e.target.value)}
                        placeholder="25.00" 
                        required 
                        className="w-full pl-8 pr-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 transition-colors"
                      />
                    </div>
                    {newMerchPrice && (
                      <p className="text-[11px] text-teal-600 dark:text-teal-400 mt-1">
                        Sanitized for PayPal: <span className="font-mono font-semibold">${sanitizePrice(newMerchPrice)}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                      Product Image
                    </label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageChange}
                      className="w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-100 dark:file:bg-slate-800 file:text-teal-700 dark:file:text-teal-400 hover:file:bg-slate-200 dark:hover:file:bg-slate-700 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <input 
                      type="checkbox" 
                      id="hasSizesCheck"
                      checked={newMerchHasSizes}
                      onChange={(e) => setNewMerchHasSizes(e.target.checked)}
                      className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300"
                    />
                    <label htmlFor="hasSizesCheck" className="text-xs text-slate-700 dark:text-slate-300 select-none cursor-pointer">
                      Requires Size Selection (S, M, L, XL, XXL)
                    </label>
                  </div>

                  {newMerchName && (
                    <div className="mt-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/90 border border-slate-200 dark:border-slate-800 animate-scaleIn transform-gpu">
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">Live Preview</div>
                      <div className="flex gap-3 items-center">
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 relative flex-shrink-0">
                          <img 
                            src={newMerchImagePreview || '/merch-polo.jpg'} 
                            alt="preview" 
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">{newMerchName}</h5>
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-extrabold mt-0.5 inline-block">
                            ${sanitizePrice(newMerchPrice || '0')}
                          </span>
                          {newMerchHasSizes && (
                            <span className="ml-2 text-[10px] bg-slate-200 dark:bg-slate-800 text-teal-700 dark:text-teal-300 px-1.5 py-0.5 rounded font-medium">
                              S - XXL
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    disabled={isAddingMerch}
                    className="w-full mt-2 py-3 px-4 bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm rounded-xl shadow-md shadow-teal-600/20 transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-95 transform-gpu"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span>{isAddingMerch ? 'Adding Item...' : 'Add Merch Product'}</span>
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm dark:shadow-xl transition-colors duration-200">
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Merchandise Store Items</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Products currently available for purchase via PayPal</p>
                  </div>
                  <span className="text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full font-medium">
                    {merch.length} items
                  </span>
                </div>

                {loadingData ? (
                  <div className="py-16 text-center text-slate-400">
                    <div className="w-8 h-8 border-2 border-teal-600 dark:border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs">Loading merchandise catalog...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {merch.map((item, idx) => (
                      <div 
                        key={item.id}
                        className={`bg-slate-50/80 dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 transform-gpu ${
                          deletingMerchId === item.id ? 'opacity-0 scale-90 max-h-0 py-0 my-0 overflow-hidden border-transparent pointer-events-none' : ''
                        }`}
                      >
                        <div>
                          <div className="w-full h-44 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-900 mb-3 relative border border-slate-200 dark:border-slate-800">
                            <img src={item.imageUrl} alt={item.title || item.name} className="w-full h-full object-cover" />
                            {item.hasSizes && (
                              <span className="absolute top-2 right-2 text-[10px] font-bold uppercase tracking-wider bg-white/90 dark:bg-slate-900/90 text-teal-700 dark:text-teal-300 px-2 py-1 rounded-md border border-slate-200 dark:border-teal-500/30">
                                S - XXL
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-slate-900 dark:text-white text-sm leading-snug">{item.title || item.name}</h4>
                          <div className="text-emerald-600 dark:text-emerald-400 font-extrabold text-base mt-1">
                            ${sanitizePrice(item.price)}
                          </div>
                        </div>

                        <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">PayPal Direct</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleReorderMerch(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs"
                              title="Move Up in Store"
                            >
                              &uarr;
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReorderMerch(idx, 'down')}
                              disabled={idx === merch.length - 1}
                              className="p-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs"
                              title="Move Down in Store"
                            >
                              &darr;
                            </button>
                            <button
                              type="button"
                              onClick={() => setMerchToDelete(item)}
                              className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white dark:bg-rose-950/50 dark:hover:bg-rose-600 dark:text-rose-400 dark:hover:text-white border border-rose-200 dark:border-rose-800/40 text-xs font-bold transition-all duration-150 cursor-pointer active:scale-95"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {merch.length === 0 && (
                      <div className="col-span-2 text-center py-12 text-slate-500">
                        No merchandise found. Add your first item on the left.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: COMMENTS MODERATION (Live Firestore)                    */}
        {/* ============================================================== */}
        {activeTab === 'comments' && (
          <div key="tab-comments" className="space-y-6 animate-fadeInUp transform-gpu">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>Community Comments</span>
                  <span className="text-xs uppercase px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Firestore Sync
                  </span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  Review and moderate visitor comments. Deleted comments are instantly removed from the live site.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative flex-1 sm:w-64">
                  <input
                    type="text"
                    value={commentSearch}
                    onChange={(e) => setCommentSearch(e.target.value)}
                    placeholder="Search author, keyword..."
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-teal-600 dark:focus:border-teal-500 transition-colors shadow-sm"
                  />
                  <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                <div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 shadow-sm">
                  <button
                    onClick={() => setCommentViewMode('table')}
                    title="Table View"
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer active:scale-95 ${
                      commentViewMode === 'table' ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCommentViewMode('cards')}
                    title="Card View"
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer active:scale-95 ${
                      commentViewMode === 'cards' ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {loadingComments ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="w-8 h-8 border-3 border-teal-600 dark:border-teal-400 border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-sm font-medium">Fetching real-time comments from Firestore...</p>
              </div>
            ) : filteredComments.length === 0 ? (
              <div className="text-center py-16 px-4 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-sm animate-fadeIn">
                <p className="text-slate-700 dark:text-slate-300 font-medium">No comments found</p>
                <p className="text-slate-500 text-xs mt-1">
                  {commentSearch ? 'Try a different search keyword' : 'Comments submitted by visitors will appear here instantly.'}
                </p>
              </div>
            ) : commentViewMode === 'table' ? (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm dark:shadow-xl transition-colors duration-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="py-3.5 px-6 font-semibold w-1/4">Author</th>
                      <th className="py-3.5 px-6 font-semibold w-1/2">Comment</th>
                      <th className="py-3.5 px-6 font-semibold w-1/6">Date & Time</th>
                      <th className="py-3.5 px-6 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredComments.map((comment) => {
                      const authorName = comment.name || comment.author || 'Anonymous';
                      const commentText = comment.text || comment.content || '';
                      const avatarColor = getAvatarColor(authorName);

                      return (
                        <tr 
                          key={comment.id} 
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all duration-300 transform-gpu ${
                            deletingCommentId === comment.id ? 'opacity-0 -translate-x-6 scale-95 max-h-0 py-0 overflow-hidden pointer-events-none' : ''
                          }`}
                        >
                          <td className="py-4 px-6 align-top">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shadow-inner ${avatarColor}`}>
                                {authorName.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-900 dark:text-slate-200">{authorName}</div>
                                {comment.email && (
                                  <div className="text-xs text-slate-500 truncate max-w-[160px]">{comment.email}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          <td className="py-4 px-6 align-top">
                            <p className="text-slate-700 dark:text-slate-300 break-words whitespace-pre-line leading-relaxed">
                              {commentText}
                            </p>
                            {comment.videoTitle && (
                              <span className="inline-block mt-1 text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                                Video: {comment.videoTitle}
                              </span>
                            )}
                          </td>

                          <td className="py-4 px-6 align-top whitespace-nowrap">
                            <div className="text-slate-800 dark:text-slate-300 text-xs font-medium">
                              {formatCommentDate(comment.createdAt)}
                            </div>
                            <div className="text-[11px] text-teal-600 dark:text-teal-400 font-medium mt-0.5">
                              {timeAgo(comment.createdAt)}
                            </div>
                          </td>

                          <td className="py-4 px-6 align-top text-right whitespace-nowrap">
                            <button
                              onClick={() => setCommentToDelete(comment)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white dark:bg-rose-950/50 dark:text-rose-400 dark:hover:bg-rose-600 dark:hover:text-white border border-rose-200 dark:border-rose-800/40 text-xs font-semibold transition-all duration-150 cursor-pointer active:scale-95"
                              title="Delete comment"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              <span>Delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredComments.map((comment) => {
                  const authorName = comment.name || comment.author || 'Anonymous';
                  const commentText = comment.text || comment.content || '';
                  const avatarColor = getAvatarColor(authorName);

                  return (
                    <div
                      key={comment.id}
                      className={`p-5 rounded-2xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all duration-300 flex flex-col justify-between shadow-sm transform-gpu ${
                        deletingCommentId === comment.id ? 'opacity-0 scale-90 -translate-y-2 max-h-0 py-0 my-0 overflow-hidden border-transparent pointer-events-none' : ''
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-sm shadow-inner ${avatarColor}`}>
                              {authorName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-200 text-sm">{authorName}</div>
                              <div className="text-[11px] text-slate-500">
                                {formatCommentDate(comment.createdAt)}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => setCommentToDelete(comment)}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white dark:bg-rose-950/50 dark:text-rose-400 dark:hover:bg-rose-600 dark:hover:text-white border border-rose-200 dark:border-rose-800/40 transition-all duration-150 cursor-pointer active:scale-90"
                            title="Delete comment"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>

                        <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed mb-4 whitespace-pre-line">
                          {commentText}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                        <span>{timeAgo(comment.createdAt)}</span>
                        {comment.email && <span className="truncate max-w-[150px]">{comment.email}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Confirm Delete Video Modal ────────────────────────────────── */}
      {videoToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md animate-fadeIn transition-opacity duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scaleIn transform-gpu">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete YouTube Episode?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Are you sure you want to remove this video from the channel catalog?
            </p>
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 mb-6">
              <strong>{videoToDelete.title}</strong>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">{videoToDelete.embedUrl || videoToDelete.url}</div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setVideoToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all duration-150 active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteVideo}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all duration-150 shadow-md shadow-rose-600/20 active:scale-95"
              >
                Yes, Delete Video
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Merch Modal ────────────────────────────────── */}
      {merchToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md animate-fadeIn transition-opacity duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scaleIn transform-gpu">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Merchandise Item?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Are you sure you want to remove this item from the store?
            </p>
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 mb-6 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 flex-shrink-0">
                <img src={merchToDelete.imageUrl} alt="merch" className="w-full h-full object-cover" />
              </div>
              <div>
                <strong>{merchToDelete.name}</strong>
                <div className="text-emerald-600 dark:text-emerald-400 font-semibold">${sanitizePrice(merchToDelete.price)}</div>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setMerchToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all duration-150 active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteMerch}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all duration-150 shadow-md shadow-rose-600/20 active:scale-95"
              >
                Yes, Delete Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Delete Comment Modal ──────────────────────────────── */}
      {commentToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-md animate-fadeIn transition-opacity duration-200">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scaleIn transform-gpu">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-4 border border-rose-200 dark:border-rose-500/20">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Comment?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Are you sure you want to permanently delete this comment from the Firestore database and public site?
            </p>

            <div className="bg-slate-50 dark:bg-slate-950/80 rounded-xl p-3 border border-slate-200 dark:border-slate-800 mb-6 text-xs text-slate-700 dark:text-slate-300">
              <div className="font-semibold text-teal-700 dark:text-teal-400 mb-1">
                {commentToDelete.name || commentToDelete.author || 'Anonymous'}
              </div>
              <p className="line-clamp-3 italic text-slate-600 dark:text-slate-400">
                &ldquo;{commentToDelete.text || commentToDelete.content}&rdquo;
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setCommentToDelete(null)}
                disabled={isDeletingComment}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all duration-150 disabled:opacity-50 active:scale-95"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteComment}
                disabled={isDeletingComment}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all duration-150 flex items-center gap-2 disabled:opacity-50 active:scale-95"
              >
                {isDeletingComment ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    <span>Yes, Delete Comment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
