import React from 'react';
import Svg, { Path } from 'react-native-svg';

export interface IconProps { size?: number; color?: string }

const S = ({ size = 22, color = 'currentColor', d, fill = false }: IconProps & { d: string; fill?: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24"
    fill={fill ? color : 'none'} stroke={fill ? 'none' : color}
    strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <Path d={d} />
  </Svg>
);

export const IconHome = (p: IconProps) => <S {...p} d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />;
export const IconChart = (p: IconProps) => <S {...p} d="M4 20V10M10 20V4M16 20v-7M22 20H2" />;
export const IconUsers = (p: IconProps) => <S {...p} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" />;
export const IconCoins = (p: IconProps) => <S {...p} d="M8 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-2.82 2.82" />;
export const IconMegaphone = (p: IconProps) => <S {...p} d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1ZM15 8a4 4 0 0 1 0 8M18 5a8 8 0 0 1 0 14" />;
export const IconGrid = (p: IconProps) => <S {...p} d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />;
export const IconFile = (p: IconProps) => <S {...p} d="M14 3v5h5M14 3H6v18h12V8l-4-5ZM9 13h6M9 17h6" />;
export const IconWallet = (p: IconProps) => <S {...p} d="M3 7a2 2 0 0 1 2-2h12v4M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H7M16 13h.01" />;
export const IconBox = (p: IconProps) => <S {...p} d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" />;
export const IconLayers = (p: IconProps) => <S {...p} d="m12 2 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 17l9 5 9-5" />;
export const IconSupport = (p: IconProps) => <S {...p} d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />;
export const IconBell = (p: IconProps) => <S {...p} d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />;
export const IconSearch = (p: IconProps) => <S {...p} d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.35-4.35" />;
export const IconChevronRight = (p: IconProps) => <S {...p} d="M9 6l6 6-6 6" />;
export const IconArrowDown = (p: IconProps) => <S {...p} d="M12 5v14M5 12l7 7 7-7" />;
export const IconInflow = (p: IconProps) => <S {...p} d="M12 19V5M5 12l7 7 7-7" />;
export const IconOutflow = (p: IconProps) => <S {...p} d="M12 5v14M19 12l-7-7-7 7" />;
export const IconUser = (p: IconProps) => <S {...p} d="M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />;
export const IconSettings = (p: IconProps) => <S {...p} d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 7 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v0Z" />;
export const IconLogout = (p: IconProps) => <S {...p} d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />;
export const IconCheck = (p: IconProps) => <S {...p} d="M20 6 9 17l-5-5" />;
export const IconLink = (p: IconProps) => <S {...p} d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.71-1.71" />;
export const IconFolder = (p: IconProps) => <S {...p} d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />;
export const IconLock = (p: IconProps) => <S {...p} d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" />;
export const IconSpotify = ({ size = 22, color = '#1DB954' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
    <Path d="M12 2a10 10 0 100 20 10 10 0 000-20zm4.586 14.424a.622.622 0 01-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.622.622 0 11-.277-1.215c3.809-.87 7.077-.496 9.712 1.115a.623.623 0 01.207.857zm1.223-2.722a.78.78 0 01-1.072.257c-2.687-1.652-6.785-2.131-9.965-1.166a.78.78 0 11-.452-1.493c3.632-1.102 8.147-.568 11.234 1.33a.78.78 0 01.255 1.072zm.105-2.835C14.692 8.95 9.375 8.775 6.297 9.71a.935.935 0 11-.543-1.79c3.532-1.072 9.404-.865 13.115 1.338a.936.936 0 01-.958 1.607z" />
  </Svg>
);
