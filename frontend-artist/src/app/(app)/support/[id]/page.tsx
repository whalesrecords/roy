'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getMyTicketDetail, addMyTicketMessage, closeMyTicket, TicketDetail } from '@/lib/api';
import { Card, Pill, AccentButton } from '@/components/roy/ui';
import { IconChevronLeft } from '@/components/roy/icons';

function statusTone(status: string): 'accent' | 'neutral' {
  return status === 'open' || status === 'resolved' ? 'accent' : 'neutral';
}

export default function TicketDetailPage() {
  const params = useParams();
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
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi");
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

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString('fr-FR', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-app"><Spinner size="lg" color="primary" /></div>;
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-app px-4 py-8">
        <div className="rounded-2xl bg-neg/10 border border-neg/20 p-4 text-neg text-sm">Ticket introuvable</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-app safe-top">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-app/90 backdrop-blur-md border-b border-line">
        <div className="px-4 py-3 lg:px-7 lg:py-[18px] flex items-center gap-3 max-w-lg lg:max-w-none mx-auto">
          <Link href="/support" className="p-2 -ml-2 hover:bg-surface-2 rounded-xl transition-colors text-ink">
            <IconChevronLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] text-ink-faint">{ticket.ticket_number}</span>
              <Pill tone={statusTone(ticket.status)}>{ticket.status_label}</Pill>
            </div>
            <h1 className="text-[15px] font-semibold text-ink truncate mt-0.5">{ticket.subject}</h1>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 pb-28 lg:px-7 lg:py-6 lg:pb-10 max-w-lg lg:max-w-2xl mx-auto space-y-3">
        {error && (
          <div className="rounded-2xl bg-neg/10 border border-neg/20 p-3 text-neg text-sm">{error}</div>
        )}

        {/* Info card */}
        <Card className="flex items-center gap-3">
          <div>
            <p className="text-xs text-ink-muted">{ticket.category_label}</p>
            <p className="text-[10px] text-ink-faint mt-0.5">Créé le {formatTime(ticket.created_at)}</p>
          </div>
          {ticket.priority_label && (
            <span className="ml-auto"><Pill tone="neutral">{ticket.priority_label}</Pill></span>
          )}
        </Card>

        {/* Messages */}
        <Card padded={false} className="overflow-hidden">
          <div className="px-4 py-3 border-b border-line">
            <span className="roy-eyebrow text-[10px]">Conversation</span>
          </div>
          <div className="p-4 space-y-3 max-h-[55vh] overflow-y-auto">
            {ticket.messages.map(message => {
              const isArtist = message.sender_type === 'artist';
              const isSystem = message.sender_type === 'system';
              return (
                <div key={message.id} className={`flex ${isArtist ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-[14px] px-3.5 py-2.5 ${
                    isSystem
                      ? 'bg-surface-2 text-center w-full max-w-none text-xs text-ink-faint'
                      : isArtist
                      ? 'bg-accent-soft text-ink'
                      : 'bg-surface-2 text-ink'
                  }`}>
                    {!isSystem && (
                      <p className="text-[10px] font-semibold mb-1 text-ink-faint">{message.sender_name || 'Support'}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.message}</p>
                    <p className="text-[10px] mt-1 text-ink-faint">
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </Card>

        {/* Reply / Closed */}
        {ticket.status === 'closed' ? (
          <Card className="py-6 text-center">
            <p className="text-ink-muted text-sm">Ce ticket est fermé</p>
          </Card>
        ) : (
          <Card className="space-y-3">
            <textarea
              placeholder="Votre message…"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 bg-surface-2 border border-line rounded-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors text-sm resize-none"
            />
            <div className="flex items-center gap-2">
              {ticket.status === 'resolved' && (
                <button
                  onClick={() => setShowCloseConfirm(true)}
                  disabled={closing}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-neg bg-neg/10 hover:bg-neg/15 transition-colors"
                >
                  Fermer le ticket
                </button>
              )}
              <AccentButton
                onClick={handleSendMessage}
                disabled={sending || !newMessage.trim()}
                className="ml-auto"
              >
                {sending ? <Spinner size="sm" color="white" /> : (
                  <>
                    <span>Envoyer</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </>
                )}
              </AccentButton>
            </div>
          </Card>
        )}
      </main>

      {/* Close confirmation bottom sheet */}
      {showCloseConfirm && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowCloseConfirm(false)} />
          <div className="relative bg-surface rounded-t-3xl shadow-roy p-6 space-y-4 lg:max-w-md lg:mx-auto lg:rounded-3xl lg:mb-8">
            <div className="w-10 h-1 bg-surface-2 rounded-full mx-auto" />
            <h3 className="font-bold text-lg text-ink">Fermer le ticket</h3>
            <p className="text-ink-muted text-sm">
              Êtes-vous sûr de vouloir fermer ce ticket ? Vous ne pourrez plus envoyer de messages.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCloseConfirm(false)}
                disabled={closing}
                className="flex-1 py-3 rounded-xl text-sm font-medium bg-surface border border-line text-ink"
              >
                Annuler
              </button>
              <button
                onClick={handleCloseTicket}
                disabled={closing}
                className="flex-1 py-3 rounded-xl text-sm font-semibold bg-neg text-white disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {closing ? <Spinner size="sm" color="white" /> : 'Fermer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
