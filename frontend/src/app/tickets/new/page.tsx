'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, Textarea, Select, SelectItem, Checkbox } from '@heroui/react';
import { Artist, getArtists, createTicket } from '@/lib/api';

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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <Link href="/tickets" className="text-blue-500 hover:underline mb-2 inline-block">
          ← Retour aux tickets
        </Link>
        <h1 className="text-3xl font-bold">Nouveau ticket</h1>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Artist Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">
            Artistes * ({selectedArtists.size} sélectionné{selectedArtists.size > 1 ? 's' : ''})
          </label>
          <Input
            placeholder="Rechercher un artiste..."
            value={artistSearch}
            onChange={(e) => setArtistSearch(e.target.value)}
            className="mb-4"
            startContent={
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            }
          />
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-60 overflow-y-auto p-2">
            {loadingArtists ? (
              <p className="text-center text-gray-500 py-4">Chargement...</p>
            ) : filteredArtists.length === 0 ? (
              <p className="text-center text-gray-500 py-4">Aucun artiste trouvé</p>
            ) : (
              <div className="space-y-1">
                {filteredArtists.map((artist) => (
                  <div
                    key={artist.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer"
                    onClick={() => handleArtistToggle(artist.id)}
                  >
                    <Checkbox
                      isSelected={selectedArtists.has(artist.id)}
                      onChange={() => handleArtistToggle(artist.id)}
                    />
                    <span>{artist.name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Category */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Catégorie *</label>
          <Select
            selectedKeys={[category]}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORY_OPTIONS.map((cat) => (
              <SelectItem key={cat.key}>
                {cat.icon} {cat.label}
              </SelectItem>
            ))}
          </Select>
        </div>

        {/* Priority */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Priorité</label>
          <Select
            selectedKeys={[priority]}
            onChange={(e) => setPriority(e.target.value)}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <SelectItem key={p.key}>{p.label}</SelectItem>
            ))}
          </Select>
        </div>

        {/* Subject */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Sujet *</label>
          <Input
            placeholder="Sujet du ticket..."
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        {/* Message */}
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Message *</label>
          <Textarea
            placeholder="Votre message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            minRows={6}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            variant="flat"
            onClick={() => router.back()}
            isDisabled={creating}
          >
            Annuler
          </Button>
          <Button
            color="primary"
            onClick={handleSubmit}
            isLoading={creating}
            isDisabled={!subject.trim() || !message.trim() || selectedArtists.size === 0}
          >
            Créer le ticket
          </Button>
        </div>
      </div>
    </div>
  );
}
