'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getMyTickets, createMyTicket, Ticket, CreateTicketRequest } from '@/lib/api';

const CATEGORY_OPTIONS = [
  { key: 'payment', label: 'Paiement' },
  { key: 'profile', label: 'Profil' },
  { key: 'technical', label: 'Technique' },
  { key: 'royalties', label: 'Royalties' },
  { key: 'contracts', label: 'Contrats' },
  { key: 'catalog', label: 'Catalogue' },
  { key: 'general', label: 'Général' },
  { key: 'other', label: 'Autre' },
];

const STATUS_OPTIONS = [
  { key: '', label: 'Tous' },
  { key: 'open', label: 'Ouvert' },
  { key: 'in_progress', label: 'En cours' },
  { key: 'resolved', label: 'Résolu' },
  { key: 'closed', label: 'Fermé' },
];

const STATUS_DOT: Record<string, string> = {
  open: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  resolved: 'bg-emerald-500',
  closed: 'bg-default-400',
};

export default function SupportPage() {
  const { artist, loading: authLoading } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Bottom sheet state
  const [sheetOpen, setSheetOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (artist) loadTickets();
  }, [artist, statusFilter]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await getMyTickets({ status: statusFilter || undefined });
      setTickets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      setFormError('Veuillez remplir tous les champs');
      return;
    }
    setCreating(true);
    setFormError(null);
    try {
      const ticketData: CreateTicketRequest = { subject, category, message };
      await createMyTicket(ticketData);
      setSubject('');
      setMessage('');
      setCategory('general');
      setSheetOpen(false);
      await loadTickets();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `il y a ${mins}m`;
    if (hours < 24) return `il y a ${hours}h`;
    if (days < 7) return `il y a ${days}j`;
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><Spinner size="lg" color="primary" /></div>;

  return (
    <div className="min-h-screen bg-background safe-top">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-divider">
        <div className="px-4 pt-4 pb-3 max-w-lg mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">Support</h1>
          <button
            onClick={() => { setSheetOpen(true); setFormError(null); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-sm font-medium rounded-xl"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nouveau
          </button>
        </div>

        {/* Status filter pills */}
        <div className="px-4 pb-3 max-w-lg mx-auto">
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setStatusFilter(opt.key)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === opt.key
                    ? 'bg-primary text-white'
                    : 'bg-content1 border border-divider text-default-500 hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-28 max-w-lg mx-auto space-y-2">
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-2xl">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {loading && (
          <div className="flex justify-center py-10">
            <Spinner color="primary" />
          </div>
        )}

        {!loading && tickets.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-content1 border border-divider rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-default-500 text-sm">Aucun ticket</p>
            <p className="text-default-400 text-xs mt-1">Créez un nouveau ticket pour contacter le label</p>
          </div>
        )}

        {!loading && tickets.map(ticket => (
          <Link
            key={ticket.id}
            href={`/support/${ticket.id}`}
            className="flex items-center gap-3 p-4 bg-content1 border border-divider rounded-2xl hover:border-primary/30 transition-colors"
          >
            {/* Status dot */}
            <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[ticket.status] || 'bg-default-400'}`} />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-[10px] text-default-400">{ticket.ticket_number}</span>
                <span className="text-[10px] text-default-500">{ticket.category_label}</span>
                {ticket.unread_count > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-danger text-white font-bold">
                    {ticket.unread_count > 9 ? '9+' : ticket.unread_count}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-foreground truncate">{ticket.subject}</p>
              <p className="text-[10px] text-default-400 mt-0.5">{formatTimeAgo(ticket.last_message_at)}</p>
            </div>

            <svg className="w-4 h-4 text-default-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </main>

      {/* Bottom Sheet — New Ticket */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !creating && setSheetOpen(false)}
          />
          <div className="relative bg-background rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-default-200 rounded-full" />
            </div>

            <div className="px-5 pb-8 pt-3 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-foreground">Nouveau ticket</h2>
                <button
                  onClick={() => !creating && setSheetOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-content2 transition-colors"
                >
                  <svg className="w-5 h-5 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl">
                  <p className="text-danger text-sm">{formError}</p>
                </div>
              )}

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground block">Catégorie</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_OPTIONS.map(c => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCategory(c.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        category === c.key
                          ? 'bg-primary text-white'
                          : 'bg-content1 border border-divider text-default-500 hover:text-foreground'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground block">Sujet</label>
                <input
                  type="text"
                  placeholder="Résumé de votre demande"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full px-4 py-3 bg-content1 border border-divider rounded-xl text-foreground placeholder:text-default-400 focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground block">Message</label>
                <textarea
                  placeholder="Décrivez votre problème en détail…"
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 bg-content1 border border-divider rounded-xl text-foreground placeholder:text-default-400 focus:outline-none focus:border-primary transition-colors text-sm resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => !creating && setSheetOpen(false)}
                  disabled={creating}
                  className="flex-1 py-3 rounded-xl text-sm font-medium bg-content1 border border-divider text-default-500 hover:text-foreground transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleCreateTicket}
                  disabled={creating || !subject.trim() || !message.trim()}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold bg-primary text-white disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {creating ? <Spinner size="sm" color="white" /> : 'Envoyer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
