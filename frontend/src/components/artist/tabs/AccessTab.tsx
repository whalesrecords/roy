'use client';

import { useState } from 'react';
import Input from '@/components/ui/Input';
import { Artist } from '@/lib/types';
import { Card, Eyebrow, AccentButton, OutlineButton } from '@/components/roy/ui';
import { IconCheck } from '@/components/roy/icons';
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
    <div className="space-y-4">
      {error && (
        <div className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[13px] text-neg">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Fermer</button>
        </div>
      )}

      {/* Access Code */}
      <Card padded={false} className="overflow-hidden">
        <div className="px-[22px] py-4 border-b border-line">
          <h2 className="text-[13.5px] font-semibold text-ink">Code d&apos;accès</h2>
          <p className="text-[11.5px] text-ink-faint mt-0.5">Code unique pour l&apos;espace artiste</p>
        </div>
        <div className="p-[22px] space-y-4">
          {artist.access_code ? (
            <div className="rounded-[12px] bg-surface-2 p-4">
              <Eyebrow>Code actuel</Eyebrow>
              <p className="roy-num text-[26px] font-bold text-ink tracking-wider mt-1.5">{artist.access_code}</p>
            </div>
          ) : (
            <p className="text-[13px] text-ink-faint">Aucun code d&apos;accès généré</p>
          )}
          <AccentButton onClick={handleGenerateAccessCode} disabled={generatingCode}>
            {generatingCode && <div className="w-3.5 h-3.5 border-2 border-accent-ink border-t-transparent rounded-full animate-spin" />}
            {artist.access_code ? 'Regénérer le code' : 'Générer un code'}
          </AccentButton>
        </div>
      </Card>

      {/* Auth Account */}
      <Card padded={false} className="overflow-hidden">
        <div className="px-[22px] py-4 border-b border-line">
          <h2 className="text-[13.5px] font-semibold text-ink">Compte Supabase Auth</h2>
          <p className="text-[11.5px] text-ink-faint mt-0.5">Accès avec email / mot de passe</p>
        </div>
        <div className="p-[22px] space-y-4">
          {artist.auth_user_id ? (
            <div className="rounded-[12px] bg-accent-soft p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 rounded-full bg-accent text-accent-ink flex items-center justify-center shrink-0">
                  <IconCheck size={13} />
                </span>
                <p className="text-[13px] font-semibold text-accent">Compte actif</p>
              </div>
              {artist.email && (
                <p className="text-[12.5px] text-ink-muted">Email : {artist.email}</p>
              )}
              <p className="text-[11px] text-ink-faint font-mono mt-1">
                Auth ID : {artist.auth_user_id}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] text-ink-faint">Aucun compte créé</p>
              <AccentButton onClick={() => setShowCreateAuthModal(true)}>
                Créer un compte
              </AccentButton>
            </div>
          )}
        </div>
      </Card>

      {/* Create Auth Modal */}
      {showCreateAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            onClick={() => { setShowCreateAuthModal(false); setAuthEmail(''); setAuthPassword(''); }}
          />
          <div className="relative bg-surface border border-line rounded-[16px] shadow-roy max-w-md w-full overflow-hidden">
            <div className="px-6 py-5 border-b border-line flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-ink">Créer un compte</h2>
              <button onClick={() => { setShowCreateAuthModal(false); setAuthEmail(''); setAuthPassword(''); }} className="p-2 text-ink-faint hover:text-ink transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
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
            <div className="px-6 py-4 border-t border-line flex gap-3 bg-surface-2">
              <OutlineButton onClick={() => { setShowCreateAuthModal(false); setAuthEmail(''); setAuthPassword(''); }} className="flex-1 justify-center">
                Annuler
              </OutlineButton>
              <AccentButton onClick={handleCreateAuth} disabled={creatingAuth || !authEmail || !authPassword} className="flex-1">
                {creatingAuth && <div className="w-3.5 h-3.5 border-2 border-accent-ink border-t-transparent rounded-full animate-spin" />}
                Créer
              </AccentButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
