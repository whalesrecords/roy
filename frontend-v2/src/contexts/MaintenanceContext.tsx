'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface MaintenanceContextType {
  isUnderMaintenance: boolean;
  lastCheckTime: Date | null;
}

const MaintenanceContext = createContext<MaintenanceContextType>({
  isUnderMaintenance: false,
  lastCheckTime: null,
});

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const [isUnderMaintenance, setIsUnderMaintenance] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(`${API_BASE}/health`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          setIsUnderMaintenance(false);
          setConsecutiveFailures(0);
        } else {
          setConsecutiveFailures(prev => prev + 1);
        }
      } catch {
        setConsecutiveFailures(prev => prev + 1);
      }
      setLastCheckTime(new Date());
    };

    // Initial check after a short delay
    const initialTimeout = setTimeout(checkHealth, 2000);

    // Check every 10 seconds
    const interval = setInterval(checkHealth, 10000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []);

  // Only show maintenance after 2 consecutive failures to avoid flashing
  useEffect(() => {
    if (consecutiveFailures >= 2) {
      setIsUnderMaintenance(true);
    }
  }, [consecutiveFailures]);

  return (
    <MaintenanceContext.Provider value={{ isUnderMaintenance, lastCheckTime }}>
      {children}
      {isUnderMaintenance && <MaintenanceOverlay />}
    </MaintenanceContext.Provider>
  );
}

function MaintenanceOverlay() {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center">
      <div className="text-center px-8 max-w-md">
        {/* Animated logo/icon */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 animate-pulse">
            <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-3">
          Mise a jour en cours{dots}
        </h1>

        <p className="text-default-500 mb-8">
          L'application est en cours de redemarrage. Cette page se rechargera automatiquement.
        </p>

        {/* Progress bar animation */}
        <div className="w-full h-2 bg-default-200 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full animate-progress" />
        </div>

        <p className="text-xs text-default-400 mt-6">
          Cela prend generalement moins d'une minute
        </p>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 60%;
            margin-left: 20%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
        .animate-progress {
          animation: progress 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export function useMaintenance() {
  return useContext(MaintenanceContext);
}
