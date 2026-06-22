'use client';

import { useState, useEffect } from 'react';
import { Spinner } from '@heroui/react';
import { getArtists, createManualPromoSubmission, Artist } from '@/lib/api';
import { AccentButton, OutlineButton } from '@/components/roy/ui';
import { IconCheck, IconPlus } from '@/components/roy/icons';

interface ManualPromoFormProps {
  onSuccess: () => void;
}

const fieldClass =
  'w-full h-11 px-3.5 bg-surface border border-line rounded-[10px] text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors';
const labelClass = 'roy-eyebrow text-[9.5px] mb-1.5 block';

export default function ManualPromoForm({ onSuccess }: ManualPromoFormProps) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<string>('');
  const [songTitle, setSongTitle] = useState<string>('');
  const [outletName, setOutletName] = useState<string>('');
  const [link, setLink] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load artists on mount
  useEffect(() => {
    loadArtists();
  }, []);

  const loadArtists = async () => {
    try {
      const data = await getArtists();
      setArtists(data);
    } catch {
      // Non-blocking — form still usable without artist list
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedArtistId || !songTitle || !outletName) {
      setError('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await createManualPromoSubmission({
        artist_id: selectedArtistId,
        song_title: songTitle,
        outlet_name: outletName,
        link: link || undefined,
        notes: notes || undefined,
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSongTitle('');
    setOutletName('');
    setLink('');
    setNotes('');
    setError(null);
    setSuccess(false);
  };

  if (success) {
    return (
      <div className="bg-accent-soft border border-line rounded-[16px] p-8 text-center">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-accent text-accent-ink flex items-center justify-center">
          <IconCheck size={26} />
        </div>
        <p className="text-[15px] font-bold text-ink mb-1.5">Submission ajoutée !</p>
        <p className="text-[13px] text-ink-muted mb-5">
          Votre lien promo a été enregistré avec succès.
        </p>
        <div className="flex justify-center">
          <AccentButton onClick={handleReset}>
            <IconPlus size={14} /> Ajouter un autre lien
          </AccentButton>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Artist selection */}
      <div>
        <label className={labelClass}>
          Artiste <span className="text-neg">*</span>
        </label>
        <select
          value={selectedArtistId}
          onChange={(e) => setSelectedArtistId(e.target.value)}
          required
          className={fieldClass}
        >
          <option value="">Sélectionner un artiste</option>
          {artists.map((artist) => (
            <option key={artist.id} value={artist.id}>
              {artist.name}
            </option>
          ))}
        </select>
      </div>

      {/* Song title */}
      <div>
        <label className={labelClass}>
          Titre du morceau <span className="text-neg">*</span>
        </label>
        <input
          type="text"
          value={songTitle}
          onChange={(e) => setSongTitle(e.target.value)}
          required
          placeholder="Ex: Mon super titre"
          className={fieldClass}
        />
      </div>

      {/* Outlet name */}
      <div>
        <label className={labelClass}>
          Nom du média / playlist <span className="text-neg">*</span>
        </label>
        <input
          type="text"
          value={outletName}
          onChange={(e) => setOutletName(e.target.value)}
          required
          placeholder="Ex: Indie Vibes Playlist"
          className={fieldClass}
        />
      </div>

      {/* Link */}
      <div>
        <label className={labelClass}>Lien (optionnel)</label>
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://..."
          className={fieldClass}
        />
      </div>

      {/* Notes */}
      <div>
        <label className={labelClass}>Notes (optionnel)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Ajouter des notes ou un feedback..."
          className="w-full px-3.5 py-3 bg-surface border border-line rounded-[10px] text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors"
        />
      </div>

      {error && (
        <p className="text-[13px] text-neg bg-surface-2 border border-line rounded-[12px] px-3.5 py-3">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <OutlineButton onClick={handleReset}>
          Réinitialiser
        </OutlineButton>
        <AccentButton type="submit" disabled={loading}>
          {loading && <Spinner size="sm" color="white" />}
          Ajouter
        </AccentButton>
      </div>
    </form>
  );
}
