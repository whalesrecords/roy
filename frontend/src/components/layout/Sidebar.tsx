'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import {
  getLabelSettings, LabelSettings,
  getNotifications, markNotificationRead, markAllNotificationsRead, Notification,
  getTicketStats,
} from '@/lib/api';
import { useTheme } from '@/contexts/ThemeContext';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: boolean;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Musique',
    items: [
      { href: '/artists', label: 'Artistes', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
      { href: '/catalog', label: 'Catalogue', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
    ],
  },
  {
    label: 'Business',
    items: [
      { href: '/imports', label: 'Imports', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' },
      { href: '/contracts', label: 'Contrats', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { href: '/finances', label: 'Finances', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { href: '/royalties', label: 'Royalties', icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z' },
      { href: '/inventory', label: 'Inventaire', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
    ],
  },
  {
    label: 'Outils',
    items: [
      { href: '/analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
      { href: '/promo', label: 'Promo', icon: 'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5' },
      { href: '/tickets', label: 'Support', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z', badge: true },
    ],
  },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function getNotificationUrl(n: Notification): string | null {
  const data = n.data as Record<string, unknown> | null;
  switch (n.type) {
    case 'ticket_created':
    case 'ticket_message':
    case 'ticket_updated':
    case 'ticket_resolved':
    case 'ticket_closed': {
      const ticketId = data?.ticket_id as string | undefined;
      return ticketId ? `/tickets/${ticketId}` : '/tickets';
    }
    case 'payment_request':
      return n.artist_id ? `/royalties?artist=${n.artist_id}` : '/royalties';
    case 'profile_update':
      return n.artist_id ? `/artists/${n.artist_id}` : '/artists';
    case 'new_artist':
      return n.artist_id ? `/artists/${n.artist_id}` : '/artists';
    default:
      return null;
  }
}

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [labelSettings, setLabelSettings] = useState<LabelSettings | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    getLabelSettings().then(setLabelSettings).catch(() => {});
    getNotifications().then(setNotifications).catch(() => {});
    getTicketStats().then(stats => setOpenTicketsCount(stats.open)).catch(() => {});
    const interval = setInterval(() => {
      getNotifications().then(setNotifications).catch(() => {});
      getTicketStats().then(stats => setOpenTicketsCount(stats.open)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleMarkAsRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleNotificationClick = async (n: Notification) => {
    await handleMarkAsRead(n.id);
    const url = getNotificationUrl(n);
    if (url) {
      setNotifOpen(false);
      onMobileClose?.();
      router.push(url);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `${mins}min`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}j`;
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-divider flex-shrink-0">
        <Link href="/" className="flex items-center gap-2.5" onClick={onMobileClose}>
          {(labelSettings?.logo_base64 || labelSettings?.logo_dark_base64) ? (
            <img
              src={(theme === 'dark' && labelSettings?.logo_dark_base64) ? labelSettings.logo_dark_base64 : (labelSettings?.logo_base64 || labelSettings?.logo_dark_base64)!}
              alt="Logo"
              className="h-7 w-auto max-w-[120px] object-contain"
            />
          ) : (
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs">W</span>
            </div>
          )}
          <span className="font-semibold text-sm text-foreground">Royalties</span>
        </Link>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4 no-scrollbar">
        {navGroups.map((group) => (
          <div key={group.label}>
            {group.label && (
              <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-default-400 select-none">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                const showBadge = item.badge && openTicketsCount > 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onMobileClose}
                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all relative group ${
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-default-600 hover:bg-default-100 hover:text-foreground'
                    }`}
                  >
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2 : 1.5} d={item.icon} />
                    </svg>
                    <span className="flex-1 truncate">{item.label}</span>
                    {showBadge && (
                      <span className="flex-shrink-0 h-4 min-w-4 px-1 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center tabular-nums">
                        {openTicketsCount > 9 ? '9+' : openTicketsCount}
                      </span>
                    )}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary rounded-full" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom: notifications + settings + user */}
      <div className="flex-shrink-0 border-t border-divider p-2 space-y-0.5">
        {/* Notifications row */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all ${
              notifOpen ? 'bg-primary/10 text-primary' : 'text-default-600 hover:bg-default-100 hover:text-foreground'
            }`}
          >
            <div className="relative w-4 h-4 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-danger rounded-full border-2 border-content1" />
              )}
            </div>
            <span className="flex-1 text-left">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold text-danger">{unreadCount}</span>
            )}
          </button>

          {/* Notifications panel — floats above */}
          {notifOpen && (
            <div className="absolute bottom-full left-0 right-0 mb-1 bg-content1 rounded-2xl border border-divider shadow-2xl overflow-hidden z-50" style={{ maxHeight: '360px' }}>
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-divider">
                <span className="text-xs font-semibold text-foreground">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-[10px] text-primary hover:underline">
                    Tout lu
                  </button>
                )}
              </div>
              <div className="overflow-y-auto no-scrollbar" style={{ maxHeight: '300px' }}>
                {notifications.length === 0 ? (
                  <p className="p-4 text-xs text-default-400 text-center">Aucune notification</p>
                ) : (
                  notifications.slice(0, 10).map(n => (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex items-start gap-2.5 px-3 py-2.5 border-b border-divider last:border-0 cursor-pointer hover:bg-default-50 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${n.type === 'payment_request' ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary'}`}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={n.type === 'payment_request' ? 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1' : 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'} />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{n.artist_name || 'Système'}</p>
                        <p className="text-[11px] text-default-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-default-400 mt-1">{formatTimeAgo(n.created_at)}</p>
                      </div>
                      {!n.is_read && <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1.5" />}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Settings */}
        <Link
          href="/settings"
          onClick={onMobileClose}
          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium transition-all ${
            pathname.startsWith('/settings') ? 'bg-primary/10 text-primary' : 'text-default-600 hover:bg-default-100 hover:text-foreground'
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Paramètres
        </Link>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm font-medium text-default-600 hover:bg-default-100 hover:text-foreground transition-all"
        >
          {theme === 'dark' ? (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
          <span>{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
        </button>

        {/* User + logout */}
        {user && (
          <div className="flex items-center gap-2 px-2.5 py-2 mt-1 rounded-xl bg-default-100">
            <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[10px] font-bold text-primary uppercase">
                {user.email?.charAt(0)}
              </span>
            </div>
            <span className="flex-1 text-[11px] text-default-500 truncate">{user.email}</span>
            <button
              onClick={() => signOut()}
              className="flex-shrink-0 p-1 rounded-lg text-default-400 hover:text-danger hover:bg-danger/10 transition-colors"
              title="Déconnexion"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col fixed inset-y-0 left-0 w-56 bg-content1 border-r border-divider z-40">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile sidebar drawer */}
      <aside
        className={`fixed inset-y-0 left-0 w-64 bg-content1 border-r border-divider z-50 lg:hidden flex flex-col transform transition-transform duration-300 ease-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
