'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner, Button, Textarea } from '@heroui/react';
import Link from 'next/link';
import { getMyTicketDetail, addMyTicketMessage, closeMyTicket, TicketDetail } from '@/lib/api';

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
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-danger/10 border border-danger rounded-lg p-4">
          <p className="text-danger">Ticket not found</p>
        </div>
      </div>
    );
  }

  const categoryInfo = CATEGORY_OPTIONS.find((c) => c.key === ticket.category);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/support" className="text-primary hover:underline mb-2 inline-block">
          ← Back to tickets
        </Link>
        <div className="flex items-start gap-4 mb-2">
          {/* Category Icon */}
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
            {categoryInfo?.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-sm text-secondary-500">{ticket.ticket_number}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs text-white ${
                  STATUS_COLORS[ticket.status as keyof typeof STATUS_COLORS]
                }`}
              >
                {ticket.status_label}
              </span>
              {ticket.priority_label && (
                <span className="px-2 py-0.5 rounded-full text-xs bg-secondary text-white">
                  {ticket.priority_label}
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold mb-2">{ticket.subject}</h1>
            <div className="flex items-center gap-4 text-sm text-secondary-500">
              <span>{ticket.category_label}</span>
              <span>Created {formatTime(ticket.created_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger/10 border border-danger rounded-lg p-4 mb-6">
          <p className="text-danger">{error}</p>
        </div>
      )}

      {/* Messages Thread */}
      <div className="bg-background rounded-lg shadow mb-6">
        <div className="p-4 border-b border-divider">
          <h2 className="font-semibold">Conversation</h2>
        </div>
        <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
          {ticket.messages.map((message) => {
            const isArtist = message.sender_type === 'artist';
            const isSystem = message.sender_type === 'system';

            return (
              <div
                key={message.id}
                className={`flex ${isArtist ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-4 ${
                    isSystem
                      ? 'bg-secondary/20 text-center w-full max-w-none text-sm'
                      : isArtist
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/30'
                  }`}
                >
                  {!isSystem && (
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-sm">
                        {message.sender_name || 'Support'}
                      </span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{message.message}</p>
                  <p
                    className={`text-xs mt-2 ${
                      isArtist ? 'text-primary-foreground/70' : 'text-secondary-500'
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
        <div className="bg-secondary/20 rounded-lg p-6 text-center">
          <p className="text-secondary-500">This ticket is closed</p>
        </div>
      ) : (
        <div className="bg-background rounded-lg shadow p-4">
          <h3 className="font-semibold mb-4">Reply</h3>
          <Textarea
            placeholder="Your message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            minRows={4}
            className="mb-4"
          />
          <div className="flex items-center justify-between gap-4">
            {ticket.status === 'resolved' && (
              <Button
                color="success"
                variant="flat"
                onClick={handleCloseTicket}
                isLoading={closing}
              >
                Close Ticket
              </Button>
            )}
            <Button
              color="primary"
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
    </div>
  );
}
