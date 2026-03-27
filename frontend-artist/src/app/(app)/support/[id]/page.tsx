'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner, Button } from '@heroui/react';
import Link from 'next/link';
import { getMyTicketDetail, addMyTicketMessage, closeMyTicket, TicketDetail } from '@/lib/api';
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

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;
  const { artist, loading: authLoading } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  useEffect(() => {
    if (artist) {
      loadTicket();
      const interval = setInterval(loadTicket, 30000);
      return () => clearInterval(interval);
    }
  }, [artist, ticketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const loadTicket = async () => {
    try {
      setLoading(true);
      const data = await getMyTicketDetail(ticketId);
      setTicket(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    setError(null);

    try {
      await addMyTicketMessage(ticketId, newMessage);
      setNewMessage('');
      await loadTicket();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  const handleCloseTicket = async () => {
    setClosing(true);
    setError(null);
    setShowCloseConfirm(false);

    try {
      await closeMyTicket(ticketId);
      await loadTicket();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la fermeture');
    } finally {
      setClosing(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <div className="bg-danger/10 border border-danger/20 rounded-2xl p-4">
          <p className="text-danger">Ticket introuvable</p>
        </div>
      </div>
    );
  }

  const categoryInfo = CATEGORY_OPTIONS.find((c) => c.key === ticket.category);

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-divider">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link href="/support" className="p-2 -ml-2 hover:bg-content2 rounded-xl transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono text-secondary-500">{ticket.ticket_number}</p>
            <h1 className="text-lg font-bold truncate">{ticket.subject}</h1>
          </div>
          <LabelLogo className="h-7 w-auto max-w-[80px] object-contain" />
        </div>
      </header>

      <main className="px-4 py-6 space-y-6">
        {/* Ticket Info Card */}
        <div className="bg-background border border-divider rounded-2xl p-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
              {categoryInfo?.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs text-white ${
                    STATUS_COLORS[ticket.status as keyof typeof STATUS_COLORS]
                  }`}
                >
                  {ticket.status_label}
                </span>
                {ticket.priority_label && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-secondary/20 text-secondary-foreground">
                    {ticket.priority_label}
                  </span>
                )}
              </div>
              <p className="text-sm text-secondary-500 mb-1">{ticket.category_label}</p>
              <p className="text-xs text-secondary-500">Créé le {formatTime(ticket.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-danger/10 border border-danger/20 rounded-2xl p-4">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {/* Messages Thread */}
        <div className="bg-background border border-divider rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-divider">
            <h2 className="font-semibold">Conversation</h2>
          </div>
          <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
          {ticket.messages.map((message) => {
            const isArtist = message.sender_type === 'artist';
            const isSystem = message.sender_type === 'system';

            return (
              <div
                key={message.id}
                className={`flex ${isArtist ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-3 ${
                    isSystem
                      ? 'bg-content2 text-center w-full max-w-none text-xs'
                      : isArtist
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-content2'
                  }`}
                >
                  {!isSystem && (
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-xs">
                        {message.sender_name || 'Support'}
                      </span>
                    </div>
                  )}
                  <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                  <p
                    className={`text-xs mt-1 ${
                      isArtist ? 'text-primary-foreground/60' : 'text-secondary-500'
                    }`}
                  >
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Reply Form or Closed Notice */}
        {ticket.status === 'closed' ? (
          <div className="bg-content2 rounded-2xl p-6 text-center">
            <p className="text-secondary-500 text-sm">Ce ticket est fermé</p>
          </div>
        ) : (
          <div className="bg-background border border-divider rounded-2xl p-4">
            <h3 className="font-semibold mb-3 text-sm">Répondre</h3>
            <textarea
              placeholder="Votre message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-content2 border border-divider rounded-xl text-foreground placeholder:text-default-400 focus:outline-none focus:border-primary transition-colors text-sm resize-none mb-3"
            />
            <div className="flex items-center justify-between gap-3">
              {ticket.status === 'resolved' && (
                <Button
                  color="danger"
                  variant="flat"
                  size="sm"
                  onClick={() => setShowCloseConfirm(true)}
                  isLoading={closing}
                >
                  Fermer le ticket
                </Button>
              )}
              <Button
                color="primary"
                size="sm"
                onClick={handleSendMessage}
                isLoading={sending}
                isDisabled={!newMessage.trim()}
                className="ml-auto"
              >
                Envoyer
              </Button>
            </div>
          </div>
        )}
      </main>

      {/* Close Ticket Confirmation Dialog */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-background border border-divider rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-lg">Fermer le ticket</h3>
            <p className="text-secondary-500 text-sm">
              Êtes-vous sûr de vouloir fermer ce ticket ? Vous ne pourrez plus envoyer de messages.
            </p>
            <div className="flex gap-3">
              <Button
                variant="flat"
                className="flex-1"
                onClick={() => setShowCloseConfirm(false)}
                isDisabled={closing}
              >
                Annuler
              </Button>
              <Button
                color="danger"
                className="flex-1"
                onClick={handleCloseTicket}
                isLoading={closing}
              >
                Fermer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
