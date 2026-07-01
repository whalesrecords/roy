'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Spinner, Textarea, Checkbox } from '@heroui/react';
import {
  TicketDetail,
  getTicketDetail,
  updateTicket,
  addTicketMessage,
  deleteTicket,
} from '@/lib/api';
import { Card, Pill, AccentButton, OutlineButton } from '@/components/roy/ui';
import { useConfirm } from '@/components/roy/useConfirm';
import { IconChevronRight, IconCheck } from '@/components/roy/icons';

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

const ACCENT_STATUSES = new Set(['open', 'in_progress']);

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadTicket();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadTicket, 30000);
    return () => clearInterval(interval);
  }, [ticketId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const loadTicket = async () => {
    try {
      const data = await getTicketDetail(ticketId);
      setTicket(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      await addTicketMessage(ticketId, {
        message: newMessage,
        is_internal: isInternal,
      });
      setNewMessage('');
      setIsInternal(false);
      await loadTicket();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur d\'envoi');
    } finally {
      setSending(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    try {
      await updateTicket(ticketId, { status: newStatus });
      await loadTicket();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de mise à jour');
    } finally {
      setUpdating(false);
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    setUpdating(true);
    try {
      await updateTicket(ticketId, { priority: newPriority });
      await loadTicket();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de mise à jour');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirm({ title: 'Supprimer ce ticket ?', message: 'Cette action est irréversible.', danger: true, confirmLabel: 'Supprimer' }))) return;

    try {
      await deleteTicket(ticketId);
      router.push('/tickets');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression');
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const selectClass =
    'w-full h-10 px-3 bg-surface border border-line rounded-[10px] text-[13px] text-ink focus:outline-none focus:border-line-strong transition-colors disabled:opacity-50';
  const labelClass = 'roy-eyebrow text-[9.5px] mb-1.5 block';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-full bg-app">
        <div className="px-5 lg:px-7 py-5 lg:py-6 max-w-[1200px]">
          <div className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[13px] text-neg">
            Ticket non trouvé
          </div>
        </div>
      </div>
    );
  }

  const categoryInfo = CATEGORY_LABELS[ticket.category as keyof typeof CATEGORY_LABELS];
  const isResolvedOrClosed = ticket.status === 'resolved' || ticket.status === 'closed';

  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <div className="min-w-0">
          <Link
            href="/tickets"
            className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors mb-2"
          >
            <IconChevronRight size={14} className="rotate-180" /> Retour aux tickets
          </Link>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[18px]">{categoryInfo?.icon}</span>
            <span className="font-mono text-[12px] text-ink-faint">{ticket.ticket_number}</span>
            <Pill tone={ACCENT_STATUSES.has(ticket.status) ? 'accent' : 'neutral'}>{ticket.status_label}</Pill>
          </div>
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">{ticket.subject}</h1>
          <div className="flex items-center gap-2 text-[12.5px] text-ink-faint mt-1 flex-wrap">
            <span>{ticket.category_label}</span>
            <span className="text-ink-faint/60">·</span>
            <span>Créé le {formatTime(ticket.created_at)}</span>
            {ticket.participants.length > 0 && (
              <>
                <span className="text-ink-faint/60">·</span>
                <span>{ticket.participants.join(', ')}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          {!isResolvedOrClosed ? (
            <AccentButton onClick={() => handleStatusChange('resolved')} disabled={updating}>
              <IconCheck size={14} /> Marquer résolu
            </AccentButton>
          ) : (
            <OutlineButton onClick={() => handleStatusChange('open')}>
              Rouvrir
            </OutlineButton>
          )}
          <OutlineButton onClick={handleDelete} className="text-neg">
            Supprimer
          </OutlineButton>
        </div>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {/* Status & Priority Controls */}
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Statut</label>
              <select
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={updating}
                className={selectClass}
              >
                <option value="open">Ouvert</option>
                <option value="in_progress">En cours</option>
                <option value="resolved">Résolu</option>
                <option value="closed">Fermé</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Priorité</label>
              <select
                value={ticket.priority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                disabled={updating}
                className={selectClass}
              >
                <option value="low">Basse</option>
                <option value="medium">Moyenne</option>
                <option value="high">Haute</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Error */}
        {error && (
          <div className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[13px] text-neg">
            {error}
          </div>
        )}

        {/* Messages Thread */}
        <Card padded={false} className="overflow-hidden">
          <div className="px-[22px] py-4 border-b border-line">
            <span className="text-[13.5px] font-semibold text-ink">Conversation</span>
          </div>
          <div className="px-[22px] py-5 space-y-3 max-h-[600px] overflow-y-auto">
            {ticket.messages.map((message) => {
              const isArtist = message.sender_type === 'artist';
              const isSystem = message.sender_type === 'system';
              // Admin (own) messages align right with accent; artist/others align left.
              const isOwn = !isArtist && !isSystem;

              if (isSystem) {
                return (
                  <div key={message.id} className="flex justify-center">
                    <div className="rounded-full bg-surface-2 px-3.5 py-1.5 text-[11.5px] text-ink-faint">
                      {message.message}
                    </div>
                  </div>
                );
              }

              return (
                <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-[14px] px-4 py-3 ${
                      message.is_internal
                        ? 'bg-surface-2 border border-line-strong'
                        : isOwn
                        ? 'bg-accent-soft'
                        : 'bg-surface-2'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className={`text-[12px] font-semibold ${isOwn ? 'text-accent' : 'text-ink'}`}>
                        {message.sender_name || 'Système'}
                      </span>
                      {message.is_internal && <Pill tone="neutral">Note interne</Pill>}
                    </div>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">{message.message}</p>
                    <p className={`text-[11px] mt-2 ${isOwn ? 'text-accent/70' : 'text-ink-faint'}`}>
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </Card>

        {/* Reply Form */}
        <Card>
          <span className="text-[13.5px] font-semibold text-ink">Répondre</span>
          <div className="mt-3">
            <Textarea
              placeholder="Votre message…"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              minRows={4}
            />
          </div>
          <div className="flex items-center justify-between gap-4 mt-4 flex-wrap">
            <Checkbox
              isSelected={isInternal}
              onValueChange={setIsInternal}
              classNames={{ label: 'text-[12.5px] text-ink-muted' }}
            >
              Note interne (invisible pour l&apos;artiste)
            </Checkbox>
            <AccentButton
              onClick={handleSendMessage}
              disabled={sending || !newMessage.trim()}
            >
              {sending && <Spinner size="sm" color="white" />}
              Envoyer
            </AccentButton>
          </div>
        </Card>
      </div>

      {confirmDialog}
    </div>
  );
}
