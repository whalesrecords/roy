'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner, Button, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Input, Textarea, Select, SelectItem, useDisclosure } from '@heroui/react';
import Link from 'next/link';
import { getMyTickets, createMyTicket, Ticket, CreateTicketRequest } from '@/lib/api';

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
      setError(err instanceof Error ? err.message : 'Loading error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      setError('Please fill in all fields');
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
      setError(err instanceof Error ? err.message : 'Error creating ticket');
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

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US');
  };

  if (authLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Support Tickets</h1>
        <Button color="primary" size="lg" onClick={onOpen}>
          + New Ticket
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-background rounded-lg p-4 shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            placeholder="Status"
            selectedKeys={statusFilter ? [statusFilter] : []}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <SelectItem key="">All</SelectItem>
            <SelectItem key="open">Open</SelectItem>
            <SelectItem key="in_progress">In Progress</SelectItem>
            <SelectItem key="resolved">Resolved</SelectItem>
            <SelectItem key="closed">Closed</SelectItem>
          </Select>
          <Select
            placeholder="Category"
            selectedKeys={categoryFilter ? [categoryFilter] : []}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <SelectItem key="">All</SelectItem>
            {CATEGORY_OPTIONS.map((cat) => (
              <SelectItem key={cat.key}>{cat.label}</SelectItem>
            ))}
          </Select>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-danger/10 border border-danger rounded-lg p-4 mb-6">
          <p className="text-danger">{error}</p>
        </div>
      )}

      {/* Tickets List */}
      <div className="space-y-4">
        {tickets.length === 0 ? (
          <div className="bg-background rounded-lg p-12 text-center text-secondary-500 shadow">
            No tickets found
          </div>
        ) : (
          tickets.map((ticket) => {
            const categoryInfo = CATEGORY_OPTIONS.find((c) => c.key === ticket.category);
            return (
              <Link
                key={ticket.id}
                href={`/support/${ticket.id}`}
                className="block bg-background rounded-lg p-4 shadow hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Category Icon */}
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl flex-shrink-0">
                    {categoryInfo?.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-secondary-500">
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
                        <span className="px-2 py-0.5 rounded-full text-xs bg-danger text-white">
                          {ticket.unread_count} new
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-lg mb-1 truncate">
                      {ticket.subject}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-secondary-500">
                      <span>{ticket.category_label}</span>
                      <span>{formatTimeAgo(ticket.last_message_at)}</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg
                    className="w-5 h-5 text-secondary-400 flex-shrink-0 mt-2"
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
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* Create Ticket Modal */}
      <Modal isOpen={isOpen} onClose={onClose} size="2xl">
        <ModalContent>
          <ModalHeader>Create New Ticket</ModalHeader>
          <ModalBody>
            {error && (
              <div className="bg-danger/10 border border-danger rounded-lg p-4 mb-4">
                <p className="text-danger text-sm">{error}</p>
              </div>
            )}
            <div className="space-y-4">
              <Select
                label="Category"
                selectedKeys={[category]}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORY_OPTIONS.map((cat) => (
                  <SelectItem key={cat.key}>
                    {cat.icon} {cat.label}
                  </SelectItem>
                ))}
              </Select>
              <Input
                label="Subject"
                placeholder="Brief description of your issue..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <Textarea
                label="Message"
                placeholder="Please describe your issue in detail..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                minRows={6}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onClick={onClose} isDisabled={creating}>
              Cancel
            </Button>
            <Button
              color="primary"
              onClick={handleCreateTicket}
              isLoading={creating}
              isDisabled={!subject.trim() || !message.trim()}
            >
              Create Ticket
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
