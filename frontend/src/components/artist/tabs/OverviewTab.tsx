'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Artist, ArtistCategory, ARTIST_CATEGORIES } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import {
  fetchArtistArtwork,
  fetchArtistFromSpotifyUrl,
  updateArtistArtwork,
  updateArtist,
  deleteArtist,
  getAdvanceBalance,
} from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface OverviewTabProps {
  artist: Artist;
  artistId: string;
  onArtistUpdated: () => void;
}

export default function OverviewTab({ artist, artistId, onArtistUpdated }: OverviewTabProps) {
  const router = useRouter();

  // Balance data
  const [balance, setBalance] = useState<string>('0');
  const [balanceCurrency, setBalanceCurrency] = useState<string>('EUR');
  const [totalAdvances, setTotalAdvances] = useState<string>('0');
  const [totalRecouped, setTotalRecouped] = useState<string>('0');
  const [totalPayments, setTotalPayments] = useState<string>('0');

  // Artwork
  const [fetchingArtwork, setFetchingArtwork] = useState(false);
  const [showEditArtwork, setShowEditArtwork] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [spotifyProfileUrl, setSpotifyProfileUrl] = useState('');

  // Edit artist
  const [showEditArtist, setShowEditArtist] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSpotifyId, setEditSpotifyId] = useState('');
  const [editCategory, setEditCategory] = useState<ArtistCategory>('signed');
  const [savingArtist, setSavingArtist] = useState(false);

  // Delete artist
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadBalance();
  }, [artistId]);

  const loadBalance = async () => {
    try {
      const balanceData = await getAdvanceBalance(artistId);
      setBalance(balanceData.balance);
      setBalanceCurrency(balanceData.currency || 'EUR');
      setTotalAdvances(balanceData.total_advances || '0');
      setTotalRecouped(balanceData.total_recouped || '0');
      setTotalPayments(balanceData.total_payments || '0');
    } catch {
      // Silently fail
    }
  };

  const handleFetchArtwork = async () => {
    setFetchingArtwork(true);
    try {
      if (spotifyProfileUrl.trim()) {
        const result = await fetchArtistFromSpotifyUrl(artistId, spotifyProfileUrl.trim());
        if (result.image_url) {
          setEditImageUrl(result.image_url);
        }
      } else {
        await fetchArtistArtwork(artistId);
      }
      onArtistUpdated();
    } catch {
      // Error handled upstream
    } finally {
      setFetchingArtwork(false);
    }
  };

  const handleUpdateArtwork = async () => {
    try {
      await updateArtistArtwork(artistId, {
        image_url: editImageUrl || undefined,
        image_url_small: editImageUrl || undefined,
      });
      setShowEditArtwork(false);
      setEditImageUrl('');
      onArtistUpdated();
    } catch {
      // Error handled upstream
    }
  };

  const handleUpdateArtist = async () => {
    if (!editName.trim()) return;
    setSavingArtist(true);
    try {
      await updateArtist(artistId, {
        name: editName.trim(),
        spotify_id: editSpotifyId.trim() || undefined,
        category: editCategory,
      });
      setShowEditArtist(false);
      onArtistUpdated();
    } catch {
      // Error handled upstream
    } finally {
      setSavingArtist(false);
    }
  };

  const handleDeleteArtist = async () => {
    if (!artist || deleteConfirmText !== artist.name) return;
    setDeleting(true);
    try {
      await deleteArtist(artistId);
      router.push('/artists');
    } catch {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Social Media Links */}
      {(artist.instagram_url || artist.twitter_url || artist.facebook_url || artist.tiktok_url || artist.youtube_url) && (
        <div className="bg-background rounded-2xl border border-divider p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-secondary-500 mb-3">Réseaux sociaux</h3>
          <div className="flex flex-wrap gap-2">
            {artist.instagram_url && (
              <a href={artist.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-content2 hover:bg-content3 rounded-xl text-sm text-foreground transition-colors" title="Instagram">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                Instagram
              </a>
            )}
            {artist.twitter_url && (
              <a href={artist.twitter_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-content2 hover:bg-content3 rounded-xl text-sm text-foreground transition-colors" title="Twitter / X">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Twitter / X
              </a>
            )}
            {artist.facebook_url && (
              <a href={artist.facebook_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-content2 hover:bg-content3 rounded-xl text-sm text-foreground transition-colors" title="Facebook">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
              </a>
            )}
            {artist.tiktok_url && (
              <a href={artist.tiktok_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-content2 hover:bg-content3 rounded-xl text-sm text-foreground transition-colors" title="TikTok">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg>
                TikTok
              </a>
            )}
            {artist.youtube_url && (
              <a href={artist.youtube_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-content2 hover:bg-content3 rounded-xl text-sm text-foreground transition-colors" title="YouTube">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                YouTube
              </a>
            )}
          </div>
        </div>
      )}

      {/* Balance */}
      <div className="bg-background rounded-2xl border border-divider p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-content2 rounded-xl p-4">
            <p className="text-sm text-secondary-500 mb-1">Solde avance</p>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(balance, balanceCurrency)}
            </p>
          </div>
          <div className="bg-success/10 rounded-xl p-4">
            <p className="text-sm text-success-700 mb-1">Deja recoupé</p>
            <p className="text-2xl font-bold text-success">
              {formatCurrency(totalRecouped, balanceCurrency)}
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-divider grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-secondary-400">Avances donnees</p>
            <p className="text-sm font-medium text-danger">-{formatCurrency(totalAdvances, balanceCurrency)}</p>
          </div>
          <div>
            <p className="text-xs text-secondary-400">Royalties versees</p>
            <p className="text-sm font-medium text-danger">-{formatCurrency(totalPayments, balanceCurrency)}</p>
          </div>
          <div>
            <p className="text-xs text-secondary-400">Bilan label</p>
            <p className={`text-sm font-medium ${parseFloat(totalRecouped) - parseFloat(totalAdvances) - parseFloat(totalPayments) >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatCurrency(String(parseFloat(totalRecouped) - parseFloat(totalAdvances) - parseFloat(totalPayments)), balanceCurrency)}
            </p>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="border-2 border-danger-200 rounded-xl bg-danger-50 p-4">
        <h3 className="text-danger-800 font-semibold mb-2">Zone de danger</h3>
        <p className="text-danger text-sm mb-4">
          La suppression d&apos;un artiste est irreversible. Toutes les donnees associees seront perdues.
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-4 py-2 bg-danger text-white rounded-xl hover:bg-danger-600 transition-colors text-sm font-medium"
        >
          Supprimer cet artiste
        </button>
      </div>

      {/* Edit Artwork Modal */}
      {showEditArtwork && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Photo de l&apos;artiste</h2>
                <button onClick={() => { setShowEditArtwork(false); setSpotifyProfileUrl(''); setEditImageUrl(''); }} className="p-2 -mr-2 text-secondary-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              {editImageUrl && (
                <div className="flex justify-center">
                  <img src={editImageUrl} alt="Preview" className="w-32 h-32 rounded-full object-cover" />
                </div>
              )}
              <div className="bg-content2 rounded-xl p-3 space-y-3">
                <p className="text-sm text-secondary-600">Collez l&apos;URL du profil Spotify de l&apos;artiste pour récupérer la bonne image:</p>
                <Input label="URL profil Spotify" value={spotifyProfileUrl} onChange={(e) => setSpotifyProfileUrl(e.target.value)} placeholder="https://open.spotify.com/artist/..." />
                <button onClick={handleFetchArtwork} disabled={fetchingArtwork} className="w-full py-2 text-sm text-success hover:text-success-700 border border-green-200 rounded-xl inline-flex items-center justify-center gap-2">
                  {fetchingArtwork ? (
                    <><div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />Recherche...</>
                  ) : (
                    <>{spotifyProfileUrl.trim() ? 'Récupérer depuis ce profil' : 'Chercher par nom'}</>
                  )}
                </button>
              </div>
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-divider"></div>
                <span className="flex-shrink mx-3 text-xs text-secondary-400">ou</span>
                <div className="flex-grow border-t border-divider"></div>
              </div>
              <Input label="URL directe de l'image" value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} placeholder="https://i.scdn.co/image/..." />
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3">
              <Button variant="secondary" onClick={() => { setShowEditArtwork(false); setSpotifyProfileUrl(''); setEditImageUrl(''); }} className="flex-1">Annuler</Button>
              <Button onClick={handleUpdateArtwork} className="flex-1">Enregistrer</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Artist Modal */}
      {showEditArtist && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Modifier l&apos;artiste</h2>
                <button onClick={() => setShowEditArtist(false)} className="p-2 -mr-2 text-secondary-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <Input label="Nom de l'artiste" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom de l'artiste" />
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">Catégorie</label>
                <div className="flex gap-2">
                  {ARTIST_CATEGORIES.map((cat) => (
                    <button key={cat.value} onClick={() => setEditCategory(cat.value)} className={`flex-1 px-3 py-2 text-sm rounded-xl border transition-colors ${editCategory === cat.value ? (cat.value === 'signed' ? 'bg-primary-100 border-primary-500 text-primary-700' : 'bg-secondary-100 border-secondary-500 text-secondary-700') : 'bg-content2 border-default-200 text-secondary-600 hover:bg-content3'}`}>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">ID Spotify (optionnel)</label>
                <Input value={editSpotifyId} onChange={(e) => setEditSpotifyId(e.target.value)} placeholder="Ex: 0OdUWJ0sBjDrqHygGUXeCF" />
                <p className="text-xs text-secondary-500 mt-1">L&apos;ID se trouve dans l&apos;URL du profil Spotify: open.spotify.com/artist/<strong>ID</strong></p>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3">
              <Button variant="secondary" onClick={() => setShowEditArtist(false)} className="flex-1">Annuler</Button>
              <Button onClick={handleUpdateArtist} loading={savingArtist} disabled={!editName.trim()} className="flex-1">Enregistrer</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && artist && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-background w-full max-w-md rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-divider bg-danger-50">
              <h2 className="text-lg font-semibold text-danger-800">Supprimer l&apos;artiste</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-danger-100 border border-danger-300 rounded-xl p-4">
                <p className="text-danger-800 font-medium text-center mb-2">ATTENTION: Cette action est IRREVERSIBLE</p>
                <p className="text-danger-700 text-sm text-center">Toutes les donnees associees seront supprimees</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">Pour confirmer, tapez le nom de l&apos;artiste:</label>
                <p className="text-lg font-bold text-foreground mb-2 bg-content2 px-3 py-2 rounded-xl">{artist.name}</p>
                <input type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="Tapez le nom exactement" className="w-full px-4 py-3 border-2 border-danger-300 rounded-xl text-foreground focus:outline-none focus:border-danger" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }} className="flex-1" disabled={deleting}>Annuler</Button>
                <button onClick={handleDeleteArtist} disabled={deleteConfirmText !== artist.name || deleting} className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-colors ${deleteConfirmText === artist.name ? 'bg-danger text-white hover:bg-danger-600' : 'bg-danger-200 text-danger-400 cursor-not-allowed'}`}>
                  {deleting ? 'Suppression...' : 'Supprimer definitivement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
