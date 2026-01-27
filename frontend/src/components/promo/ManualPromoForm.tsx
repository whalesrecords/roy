'use client';

import { useState, useEffect } from 'react';
import { Spinner } from '@heroui/react';
import { getArtists, Artist } from '@/lib/api';

interface ManualPromoFormProps {
  onSuccess: () => void;
}

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
    } catch (err: any) {
      console.error('Error loading artists:', err);
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

      // For now, just simulate success
      // TODO: Add API call to create manual promo submission
      await new Promise(resolve => setTimeout(resolve, 1000));

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      console.error('Error creating manual promo:', err);
      setError(err.message || 'Erreur lors de la création');
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
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
        <div className="text-4xl mb-4">✓</div>
        <p className="text-green-800 font-medium text-lg mb-2">Submission ajoutée !</p>
        <p className="text-green-700 mb-4">
          Votre lien promo a été enregistré avec succès.
        </p>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Ajouter un autre lien
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Artist selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Artiste <span className="text-red-500">*</span>
        </label>
        <select
          value={selectedArtistId}
          onChange={(e) => setSelectedArtistId(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Titre du morceau <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={songTitle}
          onChange={(e) => setSongTitle(e.target.value)}
          required
          placeholder="Ex: Mon super titre"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Outlet name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Nom du média / playlist <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={outletName}
          onChange={(e) => setOutletName(e.target.value)}
          required
          placeholder="Ex: Indie Vibes Playlist"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Link */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Lien (optionnel)
        </label>
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Notes (optionnel)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Ajouter des notes ou un feedback..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 text-gray-700 hover:text-gray-900"
        >
          Réinitialiser
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading && <Spinner size="sm" color="white" />}
          Ajouter
        </button>
      </div>
    </form>
  );
}
