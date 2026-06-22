'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Spinner } from '@heroui/react';
import Link from 'next/link';
import { getMyTickets, createMyTicket, Ticket, CreateTicketRequest } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, Segmented, AccentButton } from '@/components/roy/ui';
import { IconSupport, IconChevronRight } from '@/components/roy/icons';

const STATUS_DOT: Record<string, string> = {
  open: 'bg-accent',
  in_progress: 'bg-amber-500',
  resolved: 'bg-accent',
  closed: 'bg-ink-faint',
};

export default function SupportPage() {
  const { artist, loading: authLoading } = useAuth();
  const { t } = useLanguage();
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

  const CATEGORY_OPTIONS = [
    { key: 'payment', label: t('support.cat.payment') },
    { key: 'profile', label: t('support.cat.profile') },
    { key: 'technical', label: t('support.cat.technical') },
    { key: 'royalties', label: t('support.cat.royalties') },
    { key: 'contracts', label: t('support.cat.contracts') },
    { key: 'catalog', label: t('support.cat.catalog') },
    { key: 'general', label: t('support.cat.general') },
    { key: 'other', label: t('support.cat.other') },
  ];

  const STATUS_OPTIONS = [
    { key: '', label: t('support.statusAll') },
    { key: 'open', label: t('support.open') },
    { key: 'in_progress', label: t('support.inProgress') },
    { key: 'resolved', label: t('support.resolved') },
    { key: 'closed', label: t('support.closed') },
  ];

  useEffect(() => {
    if (artist) loadTickets();
  }, [artist, statusFilter]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const data = await getMyTickets({ status: statusFilter || undefined });
      setTickets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('app.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!subject.trim() || !message.trim()) {
      setFormError(t('support.fillAllFields'));
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
      setFormError(err instanceof Error ? err.message : t('app.error'));
    } finally {
      setCreating(false);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (mins < 1) return "—";
    if (mins < 60) return `${mins}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString();
  };

  const statusOpts = STATUS_OPTIONS.map(o => ({ value: o.key, label: o.label }));

  return (
    <div className="min-h-screen bg-app safe-top">
      {/* Desktop topbar */}
      <div className="hidden lg:flex items-center justify-between px-7 py-[22px] border-b border-line">
        <div>
          <div className="text-[21px] font-bold tracking-[-0.02em] text-ink">Support</div>
          <div className="text-[12.5px] text-ink-faint mt-0.5">Vos demandes et conversations</div>
        </div>
        <AccentButton onClick={() => { setSheetOpen(true); setFormError(null); }}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          {t('support.new')}
        </AccentButton>
      </div>

      {/* Mobile filters + new ticket */}
      <div className="lg:hidden sticky top-14 z-40 bg-app/90 backdrop-blur-md border-b border-line">
        <div className="px-4 pt-3 pb-2 max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="flex-1 overflow-x-auto no-scrollbar">
            <Segmented options={statusOpts} value={statusFilter} onChange={setStatusFilter} />
          </div>
          <AccentButton
            onClick={() => { setSheetOpen(true); setFormError(null); }}
            className="shrink-0 px-3 py-1.5 rounded-xl text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t('support.new')}
          </AccentButton>
        </div>
      </div>

      <main className="px-4 py-4 pb-28 lg:px-7 lg:py-6 lg:pb-10 max-w-lg lg:max-w-none mx-auto space-y-2.5 lg:space-y-3">
        {/* Desktop status filter */}
        <div className="hidden lg:block">
          <Segmented options={statusOpts} value={statusFilter} onChange={setStatusFilter} />
        </div>

        {error && (
          <div className="p-3 rounded-2xl bg-neg/10 border border-neg/20 text-neg text-sm">{error}</div>
        )}

        {(authLoading || loading) && (
          <div className="flex items-center justify-center py-20">
            <Spinner size="lg" color="primary" />
          </div>
        )}

        {!authLoading && !loading && tickets.length === 0 && (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-surface border border-line rounded-[18px] flex items-center justify-center mx-auto mb-4 text-ink-faint">
              <IconSupport size={24} />
            </div>
            <p className="text-ink-muted text-sm">{t('support.noTickets')}</p>
            <p className="text-ink-faint text-xs mt-1">{t('support.subtitle')}</p>
          </div>
        )}

        {!authLoading && !loading && tickets.length > 0 && (
          <Card padded={false} className="overflow-hidden">
            {tickets.map((ticket, i) => (
              <Link
                key={ticket.id}
                href={`/support/${ticket.id}`}
                className={`flex items-center gap-3.5 px-4 py-3.5 hover:bg-surface-2 transition-colors ${i < tickets.length - 1 ? 'border-b border-line' : ''}`}
              >
                {/* Status dot */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[ticket.status] || 'bg-ink-faint'}`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-[10px] text-ink-faint">{ticket.ticket_number}</span>
                    <span className="text-[10px] text-ink-muted">{ticket.category_label}</span>
                    {ticket.unread_count > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] bg-accent text-accent-ink font-bold">
                        {ticket.unread_count > 9 ? '9+' : ticket.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-[13.5px] font-semibold text-ink truncate">{ticket.subject}</p>
                  <p className="text-[10px] text-ink-faint mt-0.5">{formatTimeAgo(ticket.last_message_at)}</p>
                </div>

                <IconChevronRight size={16} className="text-ink-faint shrink-0" />
              </Link>
            ))}
          </Card>
        )}
      </main>

      {/* Bottom Sheet — New Ticket */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !creating && setSheetOpen(false)}
          />
          <div className="relative bg-surface rounded-t-3xl shadow-roy max-h-[90vh] overflow-y-auto lg:max-w-lg lg:mx-auto lg:rounded-3xl lg:mb-8">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-surface-2 rounded-full" />
            </div>

            <div className="px-5 pb-8 pt-3 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-ink">{t('support.newTicket')}</h2>
                <button
                  onClick={() => !creating && setSheetOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-surface-2 transition-colors text-ink-faint"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-neg/10 border border-neg/20 text-neg text-sm">{formError}</div>
              )}

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink block">{t('support.category')}</label>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_OPTIONS.map(c => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => setCategory(c.key)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                        category === c.key
                          ? 'bg-accent text-accent-ink'
                          : 'bg-surface border border-line text-ink-muted hover:text-ink'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink block">{t('support.subject')}</label>
                <input
                  type="text"
                  placeholder={t('support.subjectPlaceholder')}
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full px-4 py-3 bg-surface-2 border border-line rounded-xl text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors text-sm"
                />
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-ink block">{t('support.send')}</label>
                <textarea
                  placeholder={t('support.detailPlaceholder')}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={5}
                  className="w-full px-4 py-3 bg-surface-2 border border-line rounded-xl text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors text-sm resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => !creating && setSheetOpen(false)}
                  disabled={creating}
                  className="flex-1 py-3 rounded-xl text-sm font-medium bg-surface border border-line text-ink-muted hover:text-ink transition-colors disabled:opacity-50"
                >
                  {t('app.cancel')}
                </button>
                <AccentButton
                  onClick={handleCreateTicket}
                  disabled={creating || !subject.trim() || !message.trim()}
                  className="flex-1 py-3"
                >
                  {creating ? <Spinner size="sm" color="white" /> : t('support.send')}
                </AccentButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
