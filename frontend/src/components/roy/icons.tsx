'use client';

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, strokeWidth = 1.8, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth as number} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {children}
    </svg>
  );
}

export const IconGrid = (p: IconProps) => base({ strokeWidth: 1.9, ...p, children: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></> });

export const IconRoyalty = (p: IconProps) => base({ ...p, children: <path d="M12 3v18M7 7h7a3 3 0 010 6H7m0 0h8" /> });

export const IconUsers = (p: IconProps) => base({ ...p, children: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.5a3.2 3.2 0 010 6.4M21 20c0-2.6-1.4-4.4-3.5-5.2" /></> });

export const IconChart = (p: IconProps) => base({ ...p, children: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> });

export const IconContract = (p: IconProps) => base({ ...p, children: <path d="M9 12l2 2 4-4M7.5 4h9l4 4v12a1 1 0 01-1 1H4.5a1 1 0 01-1-1V8z" /> });

export const IconImport = (p: IconProps) => base({ ...p, children: <path d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" /> });

export const IconTicket = (p: IconProps) => base({ ...p, children: <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /> });

export const IconSettings = (p: IconProps) => base({ ...p, children: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></> });

export const IconBox = (p: IconProps) => base({ ...p, children: <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /> });

export const IconMusic = (p: IconProps) => base({ ...p, children: <><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /><path d="M9 18V5l12-2v11" /></> });

export const IconMegaphone = (p: IconProps) => base({ ...p, children: <path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /> });

export const IconSparkles = (p: IconProps) => base({ ...p, children: <path d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /> });

export const IconPlus = (p: IconProps) => base({ strokeWidth: 2.2, ...p, children: <path d="M12 5v14M5 12h14" /> });

export const IconCheck = (p: IconProps) => base({ strokeWidth: 2.4, ...p, children: <path d="M5 13l4 4L19 7" /> });

export const IconChevronRight = (p: IconProps) => base({ strokeWidth: 2, ...p, children: <path d="M9 6l6 6-6 6" /> });

export const IconDownload = (p: IconProps) => base({ strokeWidth: 1.9, ...p, children: <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /> });

export const IconBell = (p: IconProps) => base({ ...p, children: <><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></> });

export const IconLogout = (p: IconProps) => base({ strokeWidth: 2, ...p, children: <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /> });
