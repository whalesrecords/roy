'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner, Button, Textarea } from '@heroui/react';
import Link from 'next/link';
import { getMyTicketDetail, addMyTicketMessage, closeMyTicket, TicketDetail } from '@/lib/api';
import LabelLogo from '@/components/layout/LabelLogo';

const CATEGORY_OPTIONS = [
  { key: 'payment', label: 'Payments', icon: '💰' },
  { key: 'profile', label: 'Profile', icon: '👤' },
  { key: 'technical', label: 'Technical', icon: '⚙️' },
  { key: 'royalties', label: 'Royalties', icon: '📊' },
  { key: 'contracts', label: 'Contracts', icon: '📄' },
  { key: 'catalog', label: 'Catalog', icon: '🎵' },
  { key: 'general', label: 'General', icon: '💬' },
  { key: 'other', label: 'Other', icon: '❓' },
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

  useEffect(() => {
    if (artist) {
      loadTicket();
      // Auto-refresh every 30 seconds
      const interval = setInterval(loadTicket, 30000);
      return () => clearInterval(interval);
    }
  }, [artist, ticketId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket?.messages]);

  const loadTicket = async () => {
    try {
      setLoading(true);
      const data = await getMyTicketDetail(ticketId);
      setTicket(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Loading error');
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
      setError(err instanceof Error ? err.message : 'Error sending message');
    } finally {
      setSending(false);
    }
  };

  const handleCloseTicket = async () => {
    if (!confirm('Are you sure you want to close this ticket?')) return;

    setClosing(true);
    setError(null);

    try {
      await closeMyTicket(ticketId);
      await loadTicket();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error closing ticket');
    } finally {
      setClosing(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
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
          <p className="text-danger">Ticket not found</p>
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
          <Link href="/support" className="p-2 -ml-2 hover:bg-content2 rounded-lg transition-colors">
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
              <p className="text-xs text-secondary-500">Created {formatTime(ticket.created_at)}</p>
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
            <p className="text-secondary-500 text-sm">This ticket is closed</p>
          </div>
        ) : (
          <div className="bg-background border border-divider rounded-2xl p-4">
            <h3 className="font-semibold mb-3 text-sm">Reply</h3>
            <Textarea
              placeholder="Your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              minRows={3}
              className="mb-3"
            />
            <div className="flex items-center justify-between gap-3">
              {ticket.status === 'resolved' && (
                <Button
                  color="success"
                  variant="flat"
                  size="sm"
                  onClick={handleCloseTicket}
                  isLoading={closing}
                >
                  Close Ticket
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
                Send
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
