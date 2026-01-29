'use client';

import { useEffect, useState } from 'react';
import { getLabelSettings, LabelSettings } from '@/lib/api';

interface LabelLogoProps {
  className?: string;
  fallbackSrc?: string;
  showName?: boolean;
}

export default function LabelLogo({
  className = "h-8 w-auto max-w-[120px] object-contain",
  fallbackSrc = "/icon.svg",
  showName = false
}: LabelLogoProps) {
  const [labelSettings, setLabelSettings] = useState<LabelSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLabelSettings();
  }, []);

  const loadLabelSettings = async () => {
    try {
      const settings = await getLabelSettings();
      setLabelSettings(settings);
    } catch (err) {
      console.error('Error loading label settings:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={className}>
        <div className="animate-pulse bg-content2 rounded h-full w-20" />
      </div>
    );
  }

  const logoSrc = labelSettings?.logo_base64 || labelSettings?.logo_url || fallbackSrc;
  const labelName = labelSettings?.label_name || 'Artist Portal';

  return (
    <div className="flex items-center gap-2">
      <img
        src={logoSrc}
        alt={labelName}
        className={className}
      />
      {showName && labelSettings?.label_name && (
        <span className="text-sm font-medium text-foreground hidden sm:inline">
          {labelSettings.label_name}
        </span>
      )}
    </div>
  );
}
