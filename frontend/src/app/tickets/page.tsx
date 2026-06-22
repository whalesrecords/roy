'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Spinner } from '@heroui/react';
import { Ticket, TicketStats, getTickets, getTicketStats } from '@/lib/api';
import { Card, Pill, Avatar, AccentButton } from '@/components/roy/ui';
import { IconPlus, IconChevronRight } from '@/components/roy/icons';

const CATEGORY_LABELS = {
  payment: { label: 'Paiements', icon: '💰', color: '#10b981' },
  profile: { label: 'Profil', icon: '👤', color: '#3b82f6' },
  technical: { label: 'Technique', icon: '⚙️', color: '#6366f1' },
  royalties: { label: 'Royalties', icon: '📊', color: '#8b5cf6' },
  contracts: { label: 'Contrats', icon: '📄', color: '#ec4899' },
  catalog: { label: 'Catalogue', icon: '🎵', color: '#f59e0b' },
  general: { label: 'Général', icon: '💬', color: '#6b7280' },
  other: { label: 'Autre', icon: '❓', color: '#9ca3af' },
};

// Open/in-progress show accent emphasis; resolved/closed are neutral.
const ACCENT_STATUSES = new Set(['open', 'in_progress']);

export default function TicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  useEffect(() => {
    loadData();
  }, [statusFilter, categoryFilter, priorityFilter, searchQuery]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ticketsData, statsData] = await Promise.all([
        getTickets({
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
          priority: priorityFilter || undefined,
          search: searchQuery || undefined,
        }),
        getTicketStats(),
      ]);
      setTickets(ticketsData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins}min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR');
  };

  const inputClass =
    'h-[38px] px-3 rounded-[10px] border border-line bg-surface text-[12.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors';

  if (loading && !tickets.length) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <div>
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Support</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">
            {stats ? `${stats.total} ticket${stats.total > 1 ? 's' : ''} · ${stats.open} ouvert${stats.open > 1 ? 's' : ''}` : 'Tickets et conversations'}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/tickets/new">
            <AccentButton>
              <IconPlus size={14} /> Nouveau ticket
            </AccentButton>
          </Link>
        </div>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
            <Card>
              <span className="roy-eyebrow text-[9.5px]">Total</span>
              <div className="roy-num text-[26px] font-bold mt-2 text-ink">{stats.total}</div>
            </Card>
            <Card hero>
              <span className="roy-eyebrow text-[9.5px]">Ouverts</span>
              <div className="roy-num text-[26px] font-bold mt-2 text-accent">{stats.open}</div>
            </Card>
            <Card>
              <span className="roy-eyebrow text-[9.5px]">En cours</span>
              <div className="roy-num text-[26px] font-bold mt-2 text-ink">{stats.in_progress}</div>
            </Card>
            <Card>
              <span className="roy-eyebrow text-[9.5px]">Résolus</span>
              <div className="roy-num text-[26px] font-bold mt-2 text-ink">{stats.resolved}</div>
            </Card>
            <Card>
              <span className="roy-eyebrow text-[9.5px]">Fermés</span>
              <div className="roy-num text-[26px] font-bold mt-2 text-ink-muted">{stats.closed}</div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              placeholder="Rechercher (numéro, sujet…)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${inputClass} w-full pl-9`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${inputClass} min-w-[170px]`}
          >
            <option value="">Tous les statuts</option>
            <option value="open">Ouvert</option>
            <option value="in_progress">En cours</option>
            <option value="resolved">Résolu</option>
            <option value="closed">Fermé</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className={`${inputClass} min-w-[170px]`}
          >
            <option value="">Toutes les catégories</option>
            <option value="payment">Paiements</option>
            <option value="profile">Profil</option>
            <option value="technical">Technique</option>
            <option value="royalties">Royalties</option>
            <option value="contracts">Contrats</option>
            <option value="catalog">Catalogue</option>
            <option value="general">Général</option>
            <option value="other">Autre</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className={`${inputClass} min-w-[170px]`}
          >
            <option value="">Toutes les priorités</option>
            <option value="low">Basse</option>
            <option value="medium">Moyenne</option>
            <option value="high">Haute</option>
            <option value="urgent">Urgente</option>
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[13px] text-neg">
            {error}
          </div>
        )}

        {/* Tickets List */}
        <Card padded={false} className="overflow-hidden">
          {tickets.length === 0 ? (
            <div className="px-[22px] py-16 text-center text-ink-faint text-[13px]">
              Aucun ticket trouvé
            </div>
          ) : (
            tickets.map((ticket, i) => {
              const categoryInfo = CATEGORY_LABELS[ticket.category as keyof typeof CATEGORY_LABELS];
              const accentStatus = ACCENT_STATUSES.has(ticket.status);
              return (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className={`flex items-center gap-3.5 px-[22px] py-3.5 hover:bg-surface-2 transition-colors ${i < tickets.length - 1 ? 'border-b border-line' : ''}`}
                >
                  {/* Category Icon */}
                  <div className="w-10 h-10 rounded-[12px] bg-surface-2 flex items-center justify-center text-[18px] shrink-0">
                    {categoryInfo?.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-mono text-[11px] text-ink-faint">{ticket.ticket_number}</span>
                      <Pill tone={accentStatus ? 'accent' : 'neutral'}>{ticket.status_label}</Pill>
                      {ticket.unread_count > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full text-[10.5px] font-bold bg-accent text-accent-ink">
                          {ticket.unread_count}
                        </span>
                      )}
                    </div>
                    <h3 className="text-[13.5px] font-semibold text-ink truncate">{ticket.subject}</h3>
                    <div className="flex items-center gap-2 text-[12px] text-ink-faint mt-0.5 flex-wrap">
                      <span>{ticket.category_label}</span>
                      {ticket.artist_names && ticket.artist_names.length > 0 && (
                        <>
                          <span className="text-ink-faint/60">·</span>
                          <span className="inline-flex items-center gap-1.5">
                            <Avatar name={ticket.artist_names[0]} size={18} />
                            {ticket.artist_names.join(', ')}
                          </span>
                        </>
                      )}
                      <span className="text-ink-faint/60">·</span>
                      <span>{formatTimeAgo(ticket.last_message_at)}</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <IconChevronRight size={18} className="text-ink-faint shrink-0" />
                </Link>
              );
            })
          )}
        </Card>
      </div>
    </div>
  );
}
