'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input, Textarea, Checkbox } from '@heroui/react';
import { Artist, getArtists, createTicket } from '@/lib/api';
import { Card, AccentButton, OutlineButton } from '@/components/roy/ui';
import { IconChevronRight } from '@/components/roy/icons';

const CATEGORY_OPTIONS = [
  { key: 'payment', label: 'Paiements', icon: '💰' },
  { key: 'profile', label: 'Profil', icon: '👤' },
  { key: 'technical', label: 'Technique', icon: '⚙️' },
  { key: 'royalties', label: 'Royalties', icon: '📊' },
  { key: 'contracts', label: 'Contrats', icon: '📄' },
  { key: 'catalog', label: 'Catalogue', icon: '🎵' },
  { key: 'general', label: 'Général', icon: '💬' },
  { key: 'other', label: 'Autre', icon: '❓' },
];

const PRIORITY_OPTIONS = [
  { key: 'low', label: 'Basse' },
  { key: 'medium', label: 'Moyenne' },
  { key: 'high', label: 'Haute' },
  { key: 'urgent', label: 'Urgente' },
];

export default function NewTicketPage() {
  const router = useRouter();

  const [artists, setArtists] = useState<Artist[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(true);
  const [selectedArtists, setSelectedArtists] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [message, setMessage] = useState('');
  const [artistSearch, setArtistSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadArtists();
  }, []);

  const loadArtists = async () => {
    try {
      const data = await getArtists();
      setArtists(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement des artistes');
    } finally {
      setLoadingArtists(false);
    }
  };

  const handleArtistToggle = (artistId: string) => {
    const newSelection = new Set(selectedArtists);
    if (newSelection.has(artistId)) {
      newSelection.delete(artistId);
    } else {
      newSelection.add(artistId);
    }
    setSelectedArtists(newSelection);
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim() || selectedArtists.size === 0) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const ticket = await createTicket({
        subject,
        category,
        message,
        artist_ids: Array.from(selectedArtists),
        priority,
      });
      router.push(`/tickets/${ticket.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de création');
      setCreating(false);
    }
  };

  const filteredArtists = artistSearch
    ? artists.filter((a) => a.name.toLowerCase().includes(artistSearch.toLowerCase()))
    : artists;

  const selectClass =
    'w-full h-10 px-3 bg-surface border border-line rounded-[10px] text-[13px] text-ink focus:outline-none focus:border-line-strong transition-colors';
  const labelClass = 'roy-eyebrow text-[9.5px] mb-1.5 block';

  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="px-5 lg:px-7 py-5 border-b border-line">
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-ink-muted hover:text-ink transition-colors mb-2"
        >
          <IconChevronRight size={14} className="rotate-180" /> Retour aux tickets
        </Link>
        <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Nouveau ticket</h1>
        <p className="text-[12.5px] text-ink-faint mt-0.5">Ouvrir une conversation de support</p>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 max-w-[760px]">
        <Card className="space-y-5">
          {/* Error */}
          {error && (
            <div className="rounded-[12px] border border-line bg-surface-2 px-4 py-3 text-[13px] text-neg">
              {error}
            </div>
          )}

          {/* Artist Selection */}
          <div>
            <label className={labelClass}>
              Artistes * ({selectedArtists.size} sélectionné{selectedArtists.size > 1 ? 's' : ''})
            </label>
            <div className="relative mb-3">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                placeholder="Rechercher un artiste…"
                value={artistSearch}
                onChange={(e) => setArtistSearch(e.target.value)}
                className={`${selectClass} pl-9 placeholder:text-ink-faint`}
              />
            </div>
            <div className="border border-line rounded-[12px] max-h-60 overflow-y-auto p-1.5 bg-surface-2">
              {loadingArtists ? (
                <p className="text-center text-ink-faint text-[13px] py-4">Chargement…</p>
              ) : filteredArtists.length === 0 ? (
                <p className="text-center text-ink-faint text-[13px] py-4">Aucun artiste trouvé</p>
              ) : (
                <div className="space-y-0.5">
                  {filteredArtists.map((artist) => (
                    <div
                      key={artist.id}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface rounded-[8px] cursor-pointer transition-colors"
                      onClick={() => handleArtistToggle(artist.id)}
                    >
                      <Checkbox
                        isSelected={selectedArtists.has(artist.id)}
                        onChange={() => handleArtistToggle(artist.id)}
                      />
                      <span className="text-[13px] text-ink">{artist.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className={labelClass}>Catégorie *</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={selectClass}
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.key} value={c.key}>{c.icon} {c.label}</option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div>
            <label className={labelClass}>Priorité</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className={selectClass}
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className={labelClass}>Sujet *</label>
            <Input
              placeholder="Sujet du ticket…"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Message */}
          <div>
            <label className={labelClass}>Message *</label>
            <Textarea
              placeholder="Votre message…"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              minRows={6}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <OutlineButton onClick={() => router.back()}>
              Annuler
            </OutlineButton>
            <AccentButton
              onClick={handleSubmit}
              disabled={creating || !subject.trim() || !message.trim() || selectedArtists.size === 0}
            >
              Créer le ticket
            </AccentButton>
          </div>
        </Card>
      </div>
    </div>
  );
}
