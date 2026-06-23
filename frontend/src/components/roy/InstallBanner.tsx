'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const STORAGE_KEY = 'roy-install-banner-dismissed';

/**
 * Floating PWA install prompt — shows on browsers that fire
 * `beforeinstallprompt` (Chrome/Edge/Samsung). For iOS Safari we render
 * a static hint with the Share → "Sur l'écran d'accueil" instructions
 * since iOS doesn't expose a programmatic install API.
 *
 * Dismissal is sticky (localStorage) so we don't pester users after they
 * say no. Mount this once near the root layout.
 */
export function InstallBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Hide for ever if previously dismissed or already installed
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (isStandalone || localStorage.getItem(STORAGE_KEY) === '1') return;
    setDismissed(false);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // iOS Safari has no beforeinstallprompt — show a manual hint
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as { MSStream?: unknown }).MSStream;
    if (isIos) {
      // Delay slightly so it doesn't compete with page load
      const t = setTimeout(() => setShowIosHint(true), 4000);
      return () => {
        window.removeEventListener('beforeinstallprompt', onBeforeInstall);
        clearTimeout(t);
      };
    }
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setPromptEvent(null);
    setShowIosHint(false);
    setDismissed(true);
  };

  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      dismiss();
    } else {
      setPromptEvent(null);
    }
  };

  if (dismissed) return null;
  if (!promptEvent && !showIosHint) return null;

  return (
    <div
      className="fixed bottom-[88px] left-3 right-3 z-[55] rounded-[18px] border p-4 animate-[royFade_.3s_ease]"
      style={{
        background: 'var(--sheet, var(--surface))',
        borderColor: 'var(--border-strong)',
        boxShadow: '0 16px 40px -12px rgba(0,0,0,0.35)',
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-[12px] flex items-center justify-center flex-none"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
            <path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-semibold" style={{ color: 'var(--text)' }}>Installer l'app</div>
          {promptEvent ? (
            <p className="text-[12px] mt-0.5 leading-[1.4]" style={{ color: 'var(--text-2)' }}>
              Ajoute-la à ton écran d'accueil pour un accès rapide, plein écran, sans onglet.
            </p>
          ) : (
            <p className="text-[12px] mt-0.5 leading-[1.4]" style={{ color: 'var(--text-2)' }}>
              Sur iOS&nbsp;: bouton <span aria-hidden>⎙</span> Partager → « Sur l'écran d'accueil ».
            </p>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Fermer"
          className="w-7 h-7 -mt-1 -mr-1 flex items-center justify-center rounded-full flex-none"
          style={{ color: 'var(--text-3)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {promptEvent && (
        <button
          onClick={install}
          className="w-full mt-3 py-2.5 rounded-[12px] font-bold text-[12.5px]"
          style={{ background: 'var(--accent)', color: 'var(--accent-ink)' }}
        >
          Installer
        </button>
      )}
    </div>
  );
}
