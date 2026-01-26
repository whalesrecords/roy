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
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
            <div className="text-2xl font-bold">{stats.total}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="text-sm text-blue-500">Ouverts</div>
            <div className="text-2xl font-bold">{stats.open}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="text-sm text-orange-500">En cours</div>
            <div className="text-2xl font-bold">{stats.in_progress}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="text-sm text-green-500">Résolus</div>
            <div className="text-2xl font-bold">{stats.resolved}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
            <div className="text-sm text-gray-500 dark:text-gray-400">Fermés</div>
            <div className="text-2xl font-bold">{stats.closed}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow mb-6">
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
            {Object.entries(CATEGORY_LABELS).map(([key, { label }]) => (
              <SelectItem key={key}>{label}</SelectItem>
            ))}
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
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Tickets List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {tickets.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            Aucun ticket trouvé
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {tickets.map((ticket) => {
              const categoryInfo = CATEGORY_LABELS[ticket.category as keyof typeof CATEGORY_LABELS];
              return (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {/* Category Icon */}
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ backgroundColor: `${categoryInfo?.color}20` }}
                    >
                      {categoryInfo?.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-sm text-gray-500">
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
                          <span className="px-2 py-0.5 rounded-full text-xs bg-red-500 text-white">
                            {ticket.unread_count} nouveau{ticket.unread_count > 1 ? 'x' : ''}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg mb-1 truncate">
                        {ticket.subject}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{ticket.category_label}</span>
                        {ticket.artist_names && ticket.artist_names.length > 0 && (
                          <span>👤 {ticket.artist_names.join(', ')}</span>
                        )}
                        <span>{formatTimeAgo(ticket.last_message_at)}</span>
                      </div>
                    </div>

                    {/* Arrow */}
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0 mt-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
