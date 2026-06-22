'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import {
  getLabelSettings, LabelSettings,
  getNotifications, markNotificationRead, markAllNotificationsRead, Notification,
  getTicketStats, getPendingSuggestionsCount,
} from '@/lib/api';
import { useTheme, ACCENTS } from '@/contexts/ThemeContext';
import {
  IconGrid, IconRoyalty, IconUsers, IconChart, IconContract,
  IconImport, IconTicket, IconBox, IconMusic, IconMegaphone, IconSparkles,
  IconSettings, IconBell, IconLogout,
} from '@/components/roy/icons';

interface NavItem { href: string; label: string; Icon: (p: { size?: number; strokeWidth?: number }) => JSX.Element; badge?: 'tickets' | 'spotify'; }
interface NavGroup { label: string; items: NavItem[]; }

const navGroups: NavGroup[] = [
  {
    label: 'Label',
    items: [
      { href: '/', label: 'Tableau de bord', Icon: IconGrid },
      { href: '/royalties', label: 'Royalties', Icon: IconRoyalty },
      { href: '/artists', label: 'Artistes', Icon: IconUsers },
      { href: '/finances', label: 'Finances', Icon: IconChart },
      { href: '/contracts', label: 'Contrats', Icon: IconContract },
    ],
  },
  {
    label: 'Catalogue',
    items: [
      { href: '/catalog', label: 'Catalogue', Icon: IconMusic },
      { href: '/spotify-suggestions', label: 'Suggestions', Icon: IconSparkles, badge: 'spotify' },
      { href: '/inventory', label: 'Inventaire', Icon: IconBox },
    ],
  },
  {
    label: 'Outils',
    items: [
      { href: '/imports', label: 'Imports', Icon: IconImport },
      { href: '/analytics', label: 'Analytics', Icon: IconChart },
      { href: '/promo', label: 'Promo', Icon: IconMegaphone },
      { href: '/tickets', label: 'Support', Icon: IconTicket, badge: 'tickets' },
    ],
  },
];

interface SidebarProps { mobileOpen?: boolean; onMobileClose?: () => void; }

function getNotificationUrl(n: Notification): string | null {
  const data = n.data as Record<string, unknown> | null;
  switch (n.type) {
    case 'ticket_created': case 'ticket_message': case 'ticket_updated':
    case 'ticket_resolved': case 'ticket_closed': {
      const ticketId = data?.ticket_id as string | undefined;
      return ticketId ? `/tickets/${ticketId}` : '/tickets';
    }
    case 'payment_request': return n.artist_id ? `/royalties?artist=${n.artist_id}` : '/royalties';
    case 'profile_update': return n.artist_id ? `/artists/${n.artist_id}` : '/artists';
    case 'new_artist': return n.artist_id ? `/artists/${n.artist_id}` : '/artists';
    case 'spotify_suggestions': return '/spotify-suggestions';
    default: return null;
  }
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme, accent, setAccent } = useTheme();
  const [labelSettings, setLabelSettings] = useState<LabelSettings | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [pendingSpotifyCount, setPendingSpotifyCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const refreshCounts = () => {
    getNotifications().then(setNotifications).catch(() => {});
    getTicketStats().then((s) => setOpenTicketsCount(s.open)).catch(() => {});
    getPendingSuggestionsCount().then((r) => setPendingSpotifyCount(r.pending_count)).catch(() => {});
  };

  useEffect(() => {
    getLabelSettings().then(setLabelSettings).catch(() => {});
    refreshCounts();
    const interval = setInterval(refreshCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleNotificationClick = async (n: Notification) => {
    await markNotificationRead(n.id);
    setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    const url = getNotificationUrl(n);
    if (url) { setNotifOpen(false); onMobileClose?.(); router.push(url); }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const timeAgo = (s: string) => {
    const mins = Math.floor((Date.now() - new Date(s).getTime()) / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `${mins}min`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h`;
    return new Date(s).toLocaleDateString('fr-FR');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full px-3.5 py-5">
      {/* Logo */}
      <Link href="/" onClick={onMobileClose} className="flex items-center gap-2.5 px-2 mb-1">
        {labelSettings?.logo_base64 || labelSettings?.logo_dark_base64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(theme === 'dark' && labelSettings?.logo_dark_base64) ? labelSettings.logo_dark_base64 : (labelSettings?.logo_base64 || labelSettings?.logo_dark_base64)!}
            alt="Logo" className="h-6 w-auto max-w-[120px] object-contain"
          />
        ) : (
          <>
            <span className="w-[9px] h-[9px] rounded-[3px] bg-accent" />
            <span className="text-[18px] font-bold tracking-[-0.02em] text-ink">ROY</span>
          </>
        )}
      </Link>
      <div className="px-2 pb-4 pt-2">
        <span className="font-mono text-[11px] tracking-[0.08em] text-ink-faint">WHALES RECORDS</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="roy-eyebrow text-[9.5px] px-2 mb-1.5">{group.label}</p>
            <div className="flex flex-col gap-[3px]">
              {group.items.map((item) => {
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                const badgeCount = item.badge === 'spotify' ? pendingSpotifyCount : item.badge === 'tickets' ? openTicketsCount : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onMobileClose}
                    className={`flex items-center gap-[11px] px-[11px] py-2.5 rounded-[11px] text-[13.5px] transition-colors ${
                      active ? 'bg-accent-soft text-accent font-semibold' : 'text-ink-muted hover:bg-surface-2 hover:text-ink font-medium'
                    }`}
                  >
                    <item.Icon size={18} strokeWidth={active ? 1.9 : 1.8} />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && badgeCount > 0 && (
                      <span className="h-4 min-w-4 px-1 rounded-full bg-accent text-accent-ink text-[9px] font-bold flex items-center justify-center">
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="flex flex-col gap-2 pt-3 mt-3 border-t border-line">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className={`w-full flex items-center gap-[11px] px-[11px] py-2.5 rounded-[11px] text-[13.5px] font-medium transition-colors ${
              notifOpen ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
            }`}
          >
            <span className="relative"><IconBell size={18} />{unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent border border-surface" />}</span>
            <span className="flex-1 text-left">Notifications</span>
            {unreadCount > 0 && <span className="text-[10px] font-bold text-accent">{unreadCount}</span>}
          </button>
          {notifOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface rounded-2xl border border-line shadow-roy overflow-hidden z-50" style={{ maxHeight: 360 }}>
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-line">
                <span className="text-xs font-semibold text-ink">Notifications</span>
                {unreadCount > 0 && <button onClick={handleMarkAllRead} className="text-[10px] text-accent hover:underline">Tout lu</button>}
              </div>
              <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: 300 }}>
                {notifications.length === 0 ? (
                  <p className="p-4 text-xs text-ink-faint text-center">Aucune notification</p>
                ) : notifications.slice(0, 10).map((n) => (
                  <div key={n.id} onClick={() => handleNotificationClick(n)}
                    className={`flex items-start gap-2.5 px-3 py-2.5 border-b border-line last:border-0 cursor-pointer hover:bg-surface-2 transition-colors ${!n.is_read ? 'bg-accent-soft/40' : ''}`}>
                    <div className="w-6 h-6 rounded-full bg-accent-soft text-accent flex items-center justify-center shrink-0 mt-0.5"><IconBell size={12} /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-ink truncate">{n.artist_name || 'Système'}</p>
                      <p className="text-[11px] text-ink-muted mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-ink-faint mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0 mt-1.5" />}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <Link href="/settings" onClick={onMobileClose}
          className={`flex items-center gap-[11px] px-[11px] py-2.5 rounded-[11px] text-[13.5px] font-medium transition-colors ${
            pathname.startsWith('/settings') ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'
          }`}>
          <IconSettings size={18} /> Réglages
        </Link>

        {/* Theme + accent */}
        <div className="flex items-center justify-between px-[11px] py-1.5">
          <button onClick={toggleTheme} className="flex items-center gap-[11px] text-[13.5px] font-medium text-ink-muted hover:text-ink transition-colors">
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
            {theme === 'dark' ? 'Clair' : 'Sombre'}
          </button>
          <div className="flex items-center gap-1.5">
            {ACCENTS.map((a) => (
              <button key={a.id} onClick={() => setAccent(a.id)} aria-label={a.label}
                className="w-3.5 h-3.5 rounded-full transition-transform"
                style={{ backgroundColor: a.color, boxShadow: accent === a.id ? `0 0 0 2px var(--surface), 0 0 0 3px ${a.color}` : undefined }} />
            ))}
          </div>
        </div>

        {/* User */}
        {user && (
          <div className="flex items-center gap-2.5 px-[11px] py-2.5 rounded-[11px] bg-surface-2 border border-line">
            <div className="w-8 h-8 rounded-full bg-accent-soft text-accent flex items-center justify-center text-[12px] font-bold shrink-0 uppercase">
              {user.email?.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-ink truncate">Label Manager</div>
              <div className="text-[10.5px] text-ink-faint truncate">{user.email}</div>
            </div>
            <button onClick={() => signOut()} title="Déconnexion" className="p-1 rounded-lg text-ink-faint hover:text-neg hover:bg-neg/10 transition-colors">
              <IconLogout size={15} />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-[228px] bg-surface border-r border-line z-40">
        <SidebarContent />
      </aside>
      {mobileOpen && <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden" onClick={onMobileClose} />}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-surface border-r border-line z-50 lg:hidden flex flex-col transform transition-transform duration-300 ease-out ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <SidebarContent />
      </aside>
    </>
  );
}
