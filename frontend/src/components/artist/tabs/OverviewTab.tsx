'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
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
import { Card, Eyebrow, Kpi, AccentButton, OutlineButton } from '@/components/roy/ui';

const CHART_COLORS = ['#15CE8E', '#4D8DFF', '#E3B341', '#FC3C44', '#00C7F2', '#8b5cf6', '#f97316', '#ec4899'];

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

  const openEditArtist = () => {
    setEditName(artist.name);
    setEditSpotifyId(artist.spotify_id || '');
    setEditCategory(artist.category);
    setShowEditArtist(true);
  };

  // ── Derived presentation data ──
  const balanceNum = parseFloat(balance);
  const recoupedNum = parseFloat(totalRecouped);
  const advancesNum = parseFloat(totalAdvances);
  const paymentsNum = parseFloat(totalPayments);
  const labelBalance = recoupedNum - advancesNum - paymentsNum;

  const flowData = [
    { name: 'Avances', value: advancesNum },
    { name: 'Recoupé', value: recoupedNum },
    { name: 'Versements', value: paymentsNum },
  ].filter((d) => d.value > 0);

  const hasSocials = !!(artist.instagram_url || artist.twitter_url || artist.facebook_url || artist.tiktok_url || artist.youtube_url);

  return (
    <div className="space-y-4">
      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2.5">
        <OutlineButton onClick={openEditArtist}>Modifier l&apos;artiste</OutlineButton>
        <OutlineButton onClick={() => { setShowEditArtwork(true); setSpotifyProfileUrl(''); setEditImageUrl(''); }}>Photo de l&apos;artiste</OutlineButton>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Kpi label="Solde avance" value={formatCurrency(balance, balanceCurrency)} />
        <Kpi label="Déjà recoupé" value={formatCurrency(totalRecouped, balanceCurrency)} accentValue />
        <Kpi label="Royalties versées" value={formatCurrency(totalPayments, balanceCurrency)} />
        <Kpi
          label="Bilan label"
          value={formatCurrency(String(labelBalance), balanceCurrency)}
          hero
          accentValue={labelBalance >= 0}
          hint={labelBalance >= 0 ? 'positif' : 'négatif'}
          hintTone={labelBalance >= 0 ? 'accent' : 'muted'}
        />
      </div>

      {/* Financial flows chart + breakdown */}
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-3.5">
        <Card>
          <span className="text-[13.5px] font-semibold text-ink">Flux financiers</span>
          {flowData.length > 0 ? (
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={flowData} margin={{ top: 16, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-3)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--text)' }} formatter={(value) => formatCurrency(value as number)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} name="Montant">
                  {flowData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="py-16 text-center text-ink-faint text-[13px]">Aucune donnée financière</div>
          )}
        </Card>

        <Card>
          <span className="text-[13.5px] font-semibold text-ink">Détail</span>
          <div className="flex flex-col mt-3.5">
            <div className="flex items-center justify-between py-2.5 border-b border-line">
              <span className="text-[12.5px] text-ink-muted">Avances données</span>
              <span className="roy-num text-[13px] font-bold text-ink-muted">−{formatCurrency(totalAdvances, balanceCurrency)}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-line">
              <span className="text-[12.5px] text-ink-muted">Royalties versées</span>
              <span className="roy-num text-[13px] font-bold text-ink-muted">−{formatCurrency(totalPayments, balanceCurrency)}</span>
            </div>
            <div className="flex items-center justify-between py-2.5 border-b border-line">
              <span className="text-[12.5px] text-ink-muted">Déjà recoupé</span>
              <span className="roy-num text-[13px] font-bold text-accent">+{formatCurrency(totalRecouped, balanceCurrency)}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-[12.5px] font-semibold text-ink">Solde avance</span>
              <span className={`roy-num text-[13px] font-bold ${balanceNum >= 0 ? 'text-ink' : 'text-neg'}`}>{formatCurrency(balance, balanceCurrency)}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Social Media Links */}
      {hasSocials && (
        <Card>
          <Eyebrow>Réseaux sociaux</Eyebrow>
          <div className="flex flex-wrap gap-2 mt-3">
            {artist.instagram_url && (
              <a href={artist.instagram_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-surface-2 hover:bg-surface-2/70 rounded-[10px] text-[12.5px] text-ink transition-colors" title="Instagram">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                Instagram
              </a>
            )}
            {artist.twitter_url && (
              <a href={artist.twitter_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-surface-2 hover:bg-surface-2/70 rounded-[10px] text-[12.5px] text-ink transition-colors" title="Twitter / X">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                Twitter / X
              </a>
            )}
            {artist.facebook_url && (
              <a href={artist.facebook_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-surface-2 hover:bg-surface-2/70 rounded-[10px] text-[12.5px] text-ink transition-colors" title="Facebook">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                Facebook
              </a>
            )}
            {artist.tiktok_url && (
              <a href={artist.tiktok_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-surface-2 hover:bg-surface-2/70 rounded-[10px] text-[12.5px] text-ink transition-colors" title="TikTok">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg>
                TikTok
              </a>
            )}
            {artist.youtube_url && (
              <a href={artist.youtube_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-surface-2 hover:bg-surface-2/70 rounded-[10px] text-[12.5px] text-ink transition-colors" title="YouTube">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                YouTube
              </a>
            )}
          </div>
        </Card>
      )}

      {/* Danger Zone */}
      <Card>
        <h3 className="text-[13.5px] font-semibold text-neg">Zone de danger</h3>
        <p className="text-[12.5px] text-ink-muted mt-1.5 mb-4">
          La suppression d&apos;un artiste est irréversible. Toutes les données associées seront perdues.
        </p>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="inline-flex items-center rounded-[10px] border border-line-strong bg-surface px-3.5 py-2 text-[12px] font-semibold text-neg hover:bg-surface-2 transition-colors"
        >
          Supprimer cet artiste
        </button>
      </Card>

      {/* Edit Artwork Modal */}
      {showEditArtwork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => { setShowEditArtwork(false); setSpotifyProfileUrl(''); setEditImageUrl(''); }} />
          <div className="relative bg-surface border border-line rounded-[16px] shadow-roy max-w-md w-full overflow-hidden">
            <div className="px-6 py-5 border-b border-line flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-ink">Photo de l&apos;artiste</h2>
              <button onClick={() => { setShowEditArtwork(false); setSpotifyProfileUrl(''); setEditImageUrl(''); }} className="p-2 text-ink-faint hover:text-ink transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {editImageUrl && (
                <div className="flex justify-center">
                  <img src={editImageUrl} alt="Preview" className="w-32 h-32 rounded-full object-cover" />
                </div>
              )}
              <div className="rounded-[12px] bg-surface-2 p-3 space-y-3">
                <p className="text-[12.5px] text-ink-muted">Collez l&apos;URL du profil Spotify de l&apos;artiste pour récupérer la bonne image :</p>
                <Input label="URL profil Spotify" value={spotifyProfileUrl} onChange={(e) => setSpotifyProfileUrl(e.target.value)} placeholder="https://open.spotify.com/artist/..." />
                <button onClick={handleFetchArtwork} disabled={fetchingArtwork} className="w-full py-2 text-[12.5px] font-semibold text-accent hover:opacity-80 border border-line rounded-[10px] inline-flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity">
                  {fetchingArtwork ? (
                    <><div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />Recherche…</>
                  ) : (
                    spotifyProfileUrl.trim() ? 'Récupérer depuis ce profil' : 'Chercher par nom'
                  )}
                </button>
              </div>
              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-line"></div>
                <span className="flex-shrink mx-3 text-[11px] text-ink-faint">ou</span>
                <div className="flex-grow border-t border-line"></div>
              </div>
              <Input label="URL directe de l'image" value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} placeholder="https://i.scdn.co/image/..." />
            </div>
            <div className="px-6 py-4 border-t border-line flex gap-3 bg-surface-2">
              <OutlineButton onClick={() => { setShowEditArtwork(false); setSpotifyProfileUrl(''); setEditImageUrl(''); }} className="flex-1 justify-center">Annuler</OutlineButton>
              <AccentButton onClick={handleUpdateArtwork} className="flex-1">Enregistrer</AccentButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit Artist Modal */}
      {showEditArtist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setShowEditArtist(false)} />
          <div className="relative bg-surface border border-line rounded-[16px] shadow-roy max-w-md w-full overflow-hidden">
            <div className="px-6 py-5 border-b border-line flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-ink">Modifier l&apos;artiste</h2>
              <button onClick={() => setShowEditArtist(false)} className="p-2 text-ink-faint hover:text-ink transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <Input label="Nom de l'artiste" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Nom de l'artiste" />
              <div>
                <label className="roy-eyebrow text-[9.5px] mb-1.5 block">Catégorie</label>
                <div className="flex gap-2">
                  {ARTIST_CATEGORIES.map((cat) => (
                    <button key={cat.value} onClick={() => setEditCategory(cat.value)} className={`flex-1 px-3 py-2 text-[12.5px] font-semibold rounded-[10px] border transition-colors ${editCategory === cat.value ? 'bg-accent-soft border-accent text-accent' : 'bg-surface-2 border-line text-ink-muted hover:text-ink'}`}>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Input label="ID Spotify (optionnel)" value={editSpotifyId} onChange={(e) => setEditSpotifyId(e.target.value)} placeholder="Ex: 0OdUWJ0sBjDrqHygGUXeCF" />
                <p className="text-[11px] text-ink-faint mt-1">L&apos;ID se trouve dans l&apos;URL du profil Spotify : open.spotify.com/artist/<strong className="text-ink-muted">ID</strong></p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-line flex gap-3 bg-surface-2">
              <OutlineButton onClick={() => setShowEditArtist(false)} className="flex-1 justify-center">Annuler</OutlineButton>
              <AccentButton onClick={handleUpdateArtist} disabled={savingArtist || !editName.trim()} className="flex-1">
                {savingArtist && <div className="w-3.5 h-3.5 border-2 border-accent-ink border-t-transparent rounded-full animate-spin" />}
                Enregistrer
              </AccentButton>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && artist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }} />
          <div className="relative bg-surface border border-line rounded-[16px] shadow-roy max-w-md w-full overflow-hidden">
            <div className="px-6 py-5 border-b border-line">
              <h2 className="text-[16px] font-bold text-neg">Supprimer l&apos;artiste</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-[12px] bg-surface-2 p-4 text-center">
                <p className="text-[13px] font-semibold text-neg mb-1">ATTENTION : Cette action est IRRÉVERSIBLE</p>
                <p className="text-[12px] text-ink-muted">Toutes les données associées seront supprimées</p>
              </div>
              <div>
                <label className="roy-eyebrow text-[9.5px] mb-1.5 block">Pour confirmer, tapez le nom de l&apos;artiste</label>
                <p className="text-[15px] font-bold text-ink mb-2 bg-surface-2 px-3 py-2 rounded-[10px]">{artist.name}</p>
                <input type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="Tapez le nom exactement" className="w-full h-12 px-4 bg-surface border border-line rounded-[10px] text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors" />
              </div>
              <div className="flex gap-3 pt-1">
                <OutlineButton onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }} className="flex-1 justify-center">Annuler</OutlineButton>
                <button onClick={handleDeleteArtist} disabled={deleteConfirmText !== artist.name || deleting} className={`flex-1 inline-flex items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-[12px] font-bold transition-colors ${deleteConfirmText === artist.name ? 'bg-neg text-white hover:opacity-90' : 'bg-surface-2 text-ink-faint cursor-not-allowed'}`}>
                  {deleting ? 'Suppression…' : 'Supprimer définitivement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
