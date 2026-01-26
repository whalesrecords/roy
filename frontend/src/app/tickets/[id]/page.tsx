'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Spinner, Button, Textarea, Select, SelectItem, Checkbox } from '@heroui/react';
import {
  TicketDetail,
  getTicketDetail,
  updateTicket,
  addTicketMessage,
  deleteTicket,
} from '@/lib/api';

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

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
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
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce ticket ?')) return;

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

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">Ticket non trouvé</p>
        </div>
      </div>
    );
  }

  const categoryInfo = CATEGORY_LABELS[ticket.category as keyof typeof CATEGORY_LABELS];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link href="/tickets" className="text-blue-500 hover:underline mb-2 inline-block">
          ← Retour aux tickets
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{categoryInfo?.icon}</span>
              <span className="font-mono text-gray-500">{ticket.ticket_number}</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">{ticket.subject}</h1>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{ticket.category_label}</span>
              <span>Créé le {formatTime(ticket.created_at)}</span>
              {ticket.participants.length > 0 && (
                <span>👤 {ticket.participants.join(', ')}</span>
              )}
            </div>
          </div>
          <Button color="danger" variant="light" size="sm" onClick={handleDelete}>
            Supprimer
          </Button>
        </div>
      </div>

      {/* Status & Priority Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Statut</label>
            <Select
              selectedKeys={[ticket.status]}
              onChange={(e) => handleStatusChange(e.target.value)}
              isDisabled={updating}
            >
              <SelectItem key="open">Ouvert</SelectItem>
              <SelectItem key="in_progress">En cours</SelectItem>
              <SelectItem key="resolved">Résolu</SelectItem>
              <SelectItem key="closed">Fermé</SelectItem>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Priorité</label>
            <Select
              selectedKeys={[ticket.priority]}
              onChange={(e) => handlePriorityChange(e.target.value)}
              isDisabled={updating}
            >
              <SelectItem key="low">Basse</SelectItem>
              <SelectItem key="medium">Moyenne</SelectItem>
              <SelectItem key="high">Haute</SelectItem>
              <SelectItem key="urgent">Urgente</SelectItem>
            </Select>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Messages Thread */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold">Conversation</h2>
        </div>
        <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
          {ticket.messages.map((message) => {
            const isArtist = message.sender_type === 'artist';
            const isSystem = message.sender_type === 'system';
            const isAdmin = message.sender_type === 'admin';

            return (
              <div
                key={message.id}
                className={`flex ${isArtist ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[70%] rounded-lg p-4 ${
                    isSystem
                      ? 'bg-gray-100 dark:bg-gray-700 text-center w-full max-w-none'
                      : isArtist
                      ? 'bg-blue-500 text-white'
                      : message.is_internal
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-500'
                      : 'bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-sm">
                      {message.sender_name || 'Système'}
                    </span>
                    {message.is_internal && (
                      <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full">
                        Note interne
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{message.message}</p>
                  <p className={`text-xs mt-2 ${isArtist ? 'text-blue-100' : 'text-gray-500'}`}>
                    {formatTime(message.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Reply Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="font-semibold mb-4">Répondre</h3>
        <Textarea
          placeholder="Votre message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          minRows={4}
          className="mb-4"
        />
        <div className="flex items-center justify-between">
          <Checkbox
            isSelected={isInternal}
            onValueChange={setIsInternal}
          >
            Note interne (invisible pour l'artiste)
          </Checkbox>
          <Button
            color="primary"
            onClick={handleSendMessage}
            isLoading={sending}
            isDisabled={!newMessage.trim()}
          >
            Envoyer
          </Button>
        </div>
      </div>
    </div>
  );
}
