'use client';

import { useEffect, useRef, useState } from 'react';
import { subscribeLoading } from '@/lib/api';

/**
 * Thin global progress bar pinned to the top of the viewport. It animates
 * (NProgress-style) whenever API requests are in flight, giving continuous
 * loading feedback instead of briefly showing empty 0 €/0 streams figures.
 * Uses the accent token so it follows the selected theme colour.
 */
export default function TopProgressBar() {
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const clearTrickle = () => {
      if (trickle.current) { clearInterval(trickle.current); trickle.current = null; }
    };

    const unsub = subscribeLoading((loading) => {
      if (loading) {
        if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
        setVisible(true);
        setWidth((w) => (w < 8 ? 8 : w));
        if (!trickle.current) {
          // creep toward 90% so the bar always feels alive without ever finishing early
          trickle.current = setInterval(() => {
            setWidth((w) => (w >= 90 ? w : w + Math.max(0.5, (90 - w) * 0.08)));
          }, 200);
        }
      } else {
        clearTrickle();
        setWidth(100);
        hideTimer.current = setTimeout(() => {
          setVisible(false);
          setWidth(0);
        }, 320);
      }
    });

    return () => {
      unsub();
      clearTrickle();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-[120] h-[3px] pointer-events-none transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div
        className="h-full bg-accent transition-[width] duration-200 ease-out"
        style={{ width: `${width}%`, boxShadow: '0 0 8px var(--accent), 0 0 4px var(--accent)' }}
      />
    </div>
  );
}
