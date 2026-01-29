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
  const [error, setError] = useState(false);

  useEffect(() => {
    loadLabelSettings();
  }, []);

  const loadLabelSettings = async () => {
    try {
      const settings = await getLabelSettings();
      setLabelSettings(settings);
    } catch (err) {
      console.error('Error loading label settings:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Show fallback immediately if loading takes too long or errors
  if (loading) {
    // Return fallback after a short delay to avoid blocking
    return (
      <img
        src={fallbackSrc}
        alt="Portal"
        className={className}
      />
    );
  }

  if (error) {
    return (
      <img
        src={fallbackSrc}
        alt="Portal"
        className={className}
      />
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
        onError={(e) => {
          // Fallback to default icon if image fails to load
          (e.target as HTMLImageElement).src = fallbackSrc;
        }}
      />
      {showName && labelSettings?.label_name && (
        <span className="text-sm font-medium text-foreground hidden sm:inline">
          {labelSettings.label_name}
        </span>
      )}
    </div>
  );
}
