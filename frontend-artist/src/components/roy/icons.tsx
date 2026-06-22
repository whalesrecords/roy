'use client';

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 18, strokeWidth = 1.8, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth as number}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: IconProps) => base({ ...p, children: <path d="M3 10.5L12 3l9 7.5M5 9.5V20a1 1 0 001 1h12a1 1 0 001-1V9.5" /> });

export const IconChart = (p: IconProps) => base({ ...p, children: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> });

export const IconMusic = (p: IconProps) => base({ ...p, children: <><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /><path d="M9 18V5l12-2v11" /></> });

export const IconFile = (p: IconProps) => base({ ...p, children: <><path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" /><path d="M13 3v6h6M9 14h6M9 17h4" /></> });

export const IconCard = (p: IconProps) => base({ ...p, children: <><rect x="2" y="5" width="20" height="14" rx="3" /><path d="M2 10h20" /></> });

export const IconContract = (p: IconProps) => base({ ...p, children: <path d="M9 12l2 2 4-4M7.5 4h9l4 4v12a1 1 0 01-1 1H4.5a1 1 0 01-1-1V8z" /> });

export const IconSettings = (p: IconProps) => base({ ...p, children: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" /></> });

export const IconBell = (p: IconProps) => base({ ...p, children: <><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></> });

export const IconArrowDown = (p: IconProps) => base({ strokeWidth: 2, ...p, children: <path d="M12 5v14M5 12l7 7 7-7" /> });

export const IconArrowUp = (p: IconProps) => base({ strokeWidth: 2, ...p, children: <path d="M12 19V5M5 12l7 7 7-7" /> });

export const IconInflow = (p: IconProps) => base({ strokeWidth: 2, ...p, children: <path d="M12 19V5M5 12l7 7 7-7" /> });

export const IconOutflow = (p: IconProps) => base({ strokeWidth: 2, ...p, children: <path d="M12 5v14M19 12l-7-7-7 7" /> });

export const IconSearch = (p: IconProps) => base({ strokeWidth: 1.9, ...p, children: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></> });

export const IconChevronRight = (p: IconProps) => base({ strokeWidth: 2, ...p, children: <path d="M9 6l6 6-6 6" /> });

export const IconChevronLeft = (p: IconProps) => base({ strokeWidth: 2.2, ...p, children: <path d="M15 18l-6-6 6-6" /> });

export const IconDownload = (p: IconProps) => base({ strokeWidth: 1.9, ...p, children: <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /> });

export const IconCheck = (p: IconProps) => base({ strokeWidth: 2.4, ...p, children: <path d="M5 13l4 4L19 7" /> });

export const IconCalendar = (p: IconProps) => base({ ...p, children: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></> });

export const IconTrendUp = (p: IconProps) => base({ strokeWidth: 3, ...p, children: <path d="M7 17L17 7M17 7H9M17 7v8" /> });

export const IconUser = (p: IconProps) => base({ ...p, children: <><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" /></> });

export const IconMegaphone = (p: IconProps) => base({ ...p, children: <path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /> });

export const IconSupport = (p: IconProps) => base({ ...p, children: <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" /> });
