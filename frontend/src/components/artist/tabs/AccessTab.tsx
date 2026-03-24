'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Artist } from '@/lib/types';
import {
  generateAccessCode,
  createArtistAuth,
} from '@/lib/api';

interface AccessTabProps {
  artist: Artist;
  artistId: string;
  onArtistUpdated: () => void;
}

export default function AccessTab({ artist, artistId, onArtistUpdated }: AccessTabProps) {
  const [generatingCode, setGeneratingCode] = useState(false);
  const [showCreateAuthModal, setShowCreateAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [creatingAuth, setCreatingAuth] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateAccessCode = async () => {
    setGeneratingCode(true);
    try {
      await generateAccessCode(artistId);
      onArtistUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la generation du code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCreateAuth = async () => {
    if (!authEmail || !authPassword) return;
    setCreatingAuth(true);
    try {
      await createArtistAuth(artistId, authEmail, authPassword);
      onArtistUpdated();
      setShowCreateAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la creation du compte');
    } finally {
      setCreatingAuth(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-danger-50 text-danger px-4 py-3 rounded-xl text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Fermer</button>
        </div>
      )}

      {/* Access Code */}
      <div className="bg-background rounded-2xl border border-divider shadow-sm">
        <div className="px-5 py-4 border-b border-divider">
          <h2 className="font-medium text-foreground">Code d&apos;accès</h2>
          <p className="text-sm text-secondary-500">Code unique pour l&apos;espace artiste</p>
        </div>
        <div className="p-5 space-y-4">
          {artist.access_code ? (
            <div className="bg-content2 rounded-xl p-4">
              <p className="text-sm text-secondary-500 mb-1">Code actuel</p>
              <p className="text-2xl font-mono font-bold text-foreground tracking-wider">{artist.access_code}</p>
            </div>
          ) : (
            <p className="text-sm text-secondary-500">Aucun code d&apos;accès généré</p>
          )}
          <Button
            size="sm"
            onClick={handleGenerateAccessCode}
            loading={generatingCode}
          >
            {artist.access_code ? 'Regénérer le code' : 'Générer un code'}
          </Button>
        </div>
      </div>

      {/* Auth Account */}
      <div className="bg-background rounded-2xl border border-divider shadow-sm">
        <div className="px-5 py-4 border-b border-divider">
          <h2 className="font-medium text-foreground">Compte Supabase Auth</h2>
          <p className="text-sm text-secondary-500">Accès avec email/mot de passe</p>
        </div>
        <div className="p-5 space-y-4">
          {artist.auth_user_id ? (
            <div className="space-y-3">
              <div className="bg-success/10 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="font-medium text-success-700">Compte actif</p>
                </div>
                {artist.email && (
                  <p className="text-sm text-success-600">Email: {artist.email}</p>
                )}
                <p className="text-xs text-secondary-400 font-mono mt-1">
                  Auth ID: {artist.auth_user_id}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-secondary-500">Aucun compte créé</p>
              <Button size="sm" onClick={() => setShowCreateAuthModal(true)}>
                Créer un compte
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Create Auth Modal */}
      {showCreateAuthModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Créer un compte</h2>
                <button onClick={() => { setShowCreateAuthModal(false); setAuthEmail(''); setAuthPassword(''); }} className="p-2 -mr-2 text-secondary-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <Input
                label="Email"
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="artiste@email.com"
              />
              <Input
                label="Mot de passe"
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Mot de passe"
              />
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3">
              <Button variant="secondary" onClick={() => { setShowCreateAuthModal(false); setAuthEmail(''); setAuthPassword(''); }} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={handleCreateAuth}
                loading={creatingAuth}
                disabled={!authEmail || !authPassword}
                className="flex-1"
              >
                Créer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
