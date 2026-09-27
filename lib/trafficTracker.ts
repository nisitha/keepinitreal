'use client';

import { db } from '@/lib/firebase';
import { doc, runTransaction, setDoc, increment } from 'firebase/firestore';

export interface TrafficDocData {
  totalVisits: number;
  todayCount: number;
  currentDate: string;
  peakDailyCount: number;
  dailyHistory?: Record<string, number>;
  lastVisit?: any;
}

/**
 * Atomic visitor tracking with daily rotation & peak detection.
 * - Deduplicates per visitor session using sessionStorage('visited_session')
 * - Skips admin routes (/admin*)
 * - Rotates todayCount to dailyHistory when the date changes
 * - Automatically tracks peak daily traffic
 */
export async function recordVisitorTraffic(): Promise<void> {
  if (typeof window === 'undefined') return;

  // Do not record admin traffic as public visits
  if (window.location.pathname.startsWith('/admin')) return;

  // Deduplicate session
  try {
    if (sessionStorage.getItem('visited_session')) {
      return;
    }
    sessionStorage.setItem('visited_session', 'true');
  } catch (e) {
    // sessionStorage unavailable (e.g. strict private mode)
  }

  const todayStr = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  const trafficRef = doc(db, 'site_stats', 'traffic');

  try {
    await runTransaction(db, async (transaction) => {
      const trafficSnap = await transaction.get(trafficRef);

      if (!trafficSnap.exists()) {
        const initialData: TrafficDocData = {
          totalVisits: 1,
          todayCount: 1,
          currentDate: todayStr,
          peakDailyCount: 1420,
          dailyHistory: { [todayStr]: 1 },
          lastVisit: new Date(),
        };
        transaction.set(trafficRef, initialData);
        return;
      }

      const data = trafficSnap.data() as Partial<TrafficDocData>;
      const storedDate = data.currentDate || todayStr;
      const isNewDay = storedDate !== todayStr;

      const prevTodayCount = typeof data.todayCount === 'number' ? data.todayCount : 0;
      const newTodayCount = isNewDay ? 1 : prevTodayCount + 1;
      const newTotalVisits = (typeof data.totalVisits === 'number' ? data.totalVisits : 0) + 1;
      const currentPeak = typeof data.peakDailyCount === 'number' ? data.peakDailyCount : 1420;
      const newPeak = Math.max(currentPeak, newTodayCount);

      const history: Record<string, number> = data.dailyHistory ? { ...data.dailyHistory } : {};
      if (isNewDay && storedDate) {
        history[storedDate] = prevTodayCount;
      }
      history[todayStr] = newTodayCount;

      transaction.update(trafficRef, {
        totalVisits: newTotalVisits,
        todayCount: newTodayCount,
        currentDate: todayStr,
        peakDailyCount: newPeak,
        dailyHistory: history,
        lastVisit: new Date(),
      });
    });
  } catch (err) {
    console.warn('Traffic transaction failed, applying atomic increment fallback:', err);
    // Fallback atomic increment
    setDoc(trafficRef, {
      totalVisits: increment(1),
      todayCount: increment(1),
      currentDate: todayStr,
      lastVisit: new Date(),
    }, { merge: true }).catch(() => {});
  }
}
