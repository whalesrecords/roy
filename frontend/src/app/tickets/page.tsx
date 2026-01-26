'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Spinner, Button, Input, Select, SelectItem } from '@heroui/react';
import { Ticket, TicketStats, getTickets, getTicketStats } from '@/lib/api';

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

const STATUS_COLORS = {
  open: 'bg-blue-500',
  in_progress: 'bg-orange-500',
  resolved: 'bg-green-500',
  closed: 'bg-gray-500',
};

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

  if (loading && !tickets.length) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Support Tickets</h1>
        <Link href="/tickets/new">
          <Button color="primary" size="lg">
            + Nouveau ticket
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl p-4 border border-blue-200 dark:border-blue-800">
            <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Ouverts</div>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.open}</div>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-2xl p-4 border border-orange-200 dark:border-orange-800">
            <div className="text-sm text-orange-600 dark:text-orange-400 mb-1">En cours</div>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{stats.in_progress}</div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-2xl p-4 border border-green-200 dark:border-green-800">
            <div className="text-sm text-green-600 dark:text-green-400 mb-1">Résolus</div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.resolved}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Fermés</div>
            <div className="text-2xl font-bold">{stats.closed}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Input
            placeholder="Rechercher (numéro, sujet...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startContent={
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
          <Select
            placeholder="Statut"
            selectedKeys={statusFilter ? [statusFilter] : []}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <SelectItem key="">Tous</SelectItem>
            <SelectItem key="open">Ouvert</SelectItem>
            <SelectItem key="in_progress">En cours</SelectItem>
            <SelectItem key="resolved">Résolu</SelectItem>
            <SelectItem key="closed">Fermé</SelectItem>
          </Select>
          <Select
            placeholder="Catégorie"
            selectedKeys={categoryFilter ? [categoryFilter] : []}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <SelectItem key="">Toutes</SelectItem>
            <SelectItem key="payment">Paiements</SelectItem>
            <SelectItem key="profile">Profil</SelectItem>
            <SelectItem key="technical">Technique</SelectItem>
            <SelectItem key="royalties">Royalties</SelectItem>
            <SelectItem key="contracts">Contrats</SelectItem>
            <SelectItem key="catalog">Catalogue</SelectItem>
            <SelectItem key="general">Général</SelectItem>
            <SelectItem key="other">Autre</SelectItem>
          </Select>
          <Select
            placeholder="Priorité"
            selectedKeys={priorityFilter ? [priorityFilter] : []}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <SelectItem key="">Toutes</SelectItem>
            <SelectItem key="low">Basse</SelectItem>
            <SelectItem key="medium">Moyenne</SelectItem>
            <SelectItem key="high">Haute</SelectItem>
            <SelectItem key="urgent">Urgente</SelectItem>
          </Select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-4 mb-6">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Tickets List */}
      <div className="space-y-3">
        {tickets.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-500">
            Aucun ticket trouvé
          </div>
        ) : (
          tickets.map((ticket) => {
            const categoryInfo = CATEGORY_LABELS[ticket.category as keyof typeof CATEGORY_LABELS];
            return (
              <Link
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all"
              >
                {/* Category Icon */}
                <div
                  className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: `${categoryInfo?.color}20` }}
                >
                  {categoryInfo?.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                      {ticket.ticket_number}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs text-white ${
                        STATUS_COLORS[ticket.status as keyof typeof STATUS_COLORS]
                      }`}
                    >
                      {ticket.status_label}
                    </span>
                    {ticket.unread_count > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-xs bg-red-500 text-white font-bold">
                        {ticket.unread_count}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-base mb-1 truncate dark:text-white">
                    {ticket.subject}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                    <span>{ticket.category_label}</span>
                    {ticket.artist_names && ticket.artist_names.length > 0 && (
                      <>
                        <span>•</span>
                        <span>👤 {ticket.artist_names.join(', ')}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{formatTimeAgo(ticket.last_message_at)}</span>
                  </div>
                </div>

                {/* Arrow */}
                <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
