'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from '@heroui/react';
import Link from 'next/link';
import { getMyTickets, createMyTicket, Ticket, CreateTicketRequest } from '@/lib/api';
import LabelLogo from '@/components/layout/LabelLogo';

const CATEGORY_OPTIONS = [
  { key: 'payment', label: 'Paiement', icon: '💰' },
  { key: 'profile', label: 'Profil', icon: '👤' },
  { key: 'technical', label: 'Technique', icon: '⚙️' },
  { key: 'royalties', label: 'Royalties', icon: '📊' },
  { key: 'contracts', label: 'Contrats', icon: '📄' },
  { key: 'catalog', label: 'Catalogue', icon: '🎵' },
  { key: 'general', label: 'Général', icon: '💬' },
  { key: 'other', label: 'Autre', icon: '❓' },
];

const STATUS_COLORS = {
  open: 'bg-blue-500',
  in_progress: 'bg-orange-500',
  resolved: 'bg-success',
  closed: 'bg-secondary',
};

export default function SupportPage() {
  const { artist, loading: authLoading } = useAuth();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Create ticket form
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (artist) {
      loadTickets();
    }
  }, [artist, statusFilter, categoryFilter]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await getMyTickets({
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      });
      setTickets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const ticketData: CreateTicketRequest = {
        subject,
        category,
        message,
      };
      await createMyTicket(ticketData);
      setSubject('');
      setMessage('');
      setCategory('general');
      onClose();
      await loadTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `il y a ${diffMins}m`;
    if (diffHours < 24) return `il y a ${diffHours}h`;
    if (diffDays < 7) return `il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LabelLogo className="h-8 w-auto max-w-[100px] object-contain" />
            <h1 className="text-xl font-bold">Support</h1>
          </div>
          <Button color="primary" size="md" onClick={onOpen}>
            + Nouveau ticket
          </Button>
        </div>
      </header>

      <main className="px-4 py-6 space-y-6">

        {/* Filters */}
        <div className="flex gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="flex-1 px-3 py-2.5 bg-content1 border border-divider rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
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
            className="flex-1 px-3 py-2.5 bg-content1 border border-divider rounded-xl text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          >
            <option value="">Toutes catégories</option>
            {CATEGORY_OPTIONS.map(c => (
              <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
            ))}
          </select>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-2xl p-4">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Tickets List */}
        <div className="space-y-3">
          {tickets.length === 0 ? (
            <div className="bg-background border border-divider rounded-2xl p-12 text-center">
              <p className="text-secondary-500">Aucun ticket trouvé</p>
            </div>
          ) : (
            tickets.map((ticket) => {
              const categoryInfo = CATEGORY_OPTIONS.find((c) => c.key === ticket.category);
              return (
                <Link
                  key={ticket.id}
                  href={`/support/${ticket.id}`}
                  className="flex items-center gap-4 p-4 bg-background border border-divider rounded-2xl hover:border-primary/50 transition-colors"
                >
                  {/* Category Icon */}
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                    {categoryInfo?.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs text-secondary-500">
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
                        <span className="px-2 py-0.5 rounded-full text-xs bg-danger text-white font-bold">
                          {ticket.unread_count}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground mb-1 truncate">
                      {ticket.subject}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-secondary-500">
                      <span>{ticket.category_label}</span>
                      <span>•</span>
                      <span>{formatTimeAgo(ticket.last_message_at)}</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg
                    className="w-5 h-5 text-secondary-400 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              );
            })
          )}
        </div>
      </main>

      {/* Create Ticket Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>Nouveau ticket</ModalHeader>
          <ModalBody>
            {error && (
              <div className="bg-danger/10 border border-danger rounded-2xl p-4 mb-4">
                <p className="text-danger text-sm">{error}</p>
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground block">Catégorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-content2 border-2 border-divider rounded-xl text-foreground focus:outline-none focus:border-primary transition-colors text-sm"
                >
                  {CATEGORY_OPTIONS.map(c => (
                    <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground block">Sujet</label>
                <input
                  type="text"
                  placeholder="Description courte du problème..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-3 bg-content2 border-2 border-divider rounded-xl text-foreground placeholder:text-default-400 focus:outline-none focus:border-primary transition-colors text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground block">Message</label>
                <textarea
                  placeholder="Décrivez votre problème en détail..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 bg-content2 border-2 border-divider rounded-xl text-foreground placeholder:text-default-400 focus:outline-none focus:border-primary transition-colors text-sm resize-none"
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onClick={onClose} isDisabled={creating}>
              Annuler
            </Button>
            <Button
              color="primary"
              onClick={handleCreateTicket}
              isLoading={creating}
              isDisabled={!subject.trim() || !message.trim()}
            >
              Créer le ticket
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
