'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Artist, Contract, AdvanceEntry } from '@/lib/types';
import {
  getArtist,
  getContracts,
  createContract,
  getAdvances,
  createAdvance,
  getAdvanceBalance,
  getArtistReleases,
  getArtistTracks,
  fetchArtistArtwork,
  updateArtistArtwork,
  CatalogRelease,
  CatalogTrack
} from '@/lib/api';

type ContractTab = 'releases' | 'tracks';

export default function ArtistDetailPage() {
  const params = useParams();
  const artistId = params.id as string;

  const [artist, setArtist] = useState<Artist | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [advances, setAdvances] = useState<AdvanceEntry[]>([]);
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Catalog data
  const [releases, setReleases] = useState<CatalogRelease[]>([]);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  const [showContractForm, setShowContractForm] = useState(false);
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [contractTab, setContractTab] = useState<ContractTab>('releases');

  // Contract form
  const [selectedItem, setSelectedItem] = useState<{ type: 'release' | 'track'; id: string; name: string } | null>(null);
  const [artistShare, setArtistShare] = useState('0.5');
  const [contractStartDate, setContractStartDate] = useState('');
  const [creatingContract, setCreatingContract] = useState(false);

  // Advance form
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDescription, setAdvanceDescription] = useState('');
  const [creatingAdvance, setCreatingAdvance] = useState(false);

  // Artwork
  const [fetchingArtwork, setFetchingArtwork] = useState(false);
  const [showEditArtwork, setShowEditArtwork] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState('');

  useEffect(() => {
    loadData();
  }, [artistId]);

  const loadData = async () => {
    try {
      const [artistData, contractsData, advancesData, balanceData] = await Promise.all([
        getArtist(artistId),
        getContracts(artistId),
        getAdvances(artistId),
        getAdvanceBalance(artistId),
      ]);
      setArtist(artistData);
      setContracts(contractsData);
      setAdvances(advancesData);
      setBalance(balanceData.balance);

      // Load catalog data for the artist
      if (artistData.name) {
        setLoadingCatalog(true);
        try {
          const [releasesData, tracksData] = await Promise.all([
            getArtistReleases(artistData.name),
            getArtistTracks(artistData.name),
          ]);
          setReleases(releasesData);
          setTracks(tracksData);
        } catch (err) {
          console.error('Error loading catalog:', err);
        } finally {
          setLoadingCatalog(false);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateContract = async () => {
    if (!contractStartDate || !selectedItem) return;
    setCreatingContract(true);
    try {
      const share = parseFloat(artistShare);
      await createContract(artistId, {
        scope: selectedItem.type,
        scope_id: selectedItem.id,
        artist_share: share,
        label_share: 1 - share,
        start_date: contractStartDate,
      });
      setShowContractForm(false);
      setSelectedItem(null);
      setArtistShare('0.5');
      setContractStartDate('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de création');
    } finally {
      setCreatingContract(false);
    }
  };

  const handleCreateCatalogContract = async () => {
    if (!contractStartDate) return;
    setCreatingContract(true);
    try {
      const share = parseFloat(artistShare);
      await createContract(artistId, {
        scope: 'catalog',
        artist_share: share,
        label_share: 1 - share,
        start_date: contractStartDate,
      });
      setShowContractForm(false);
      setArtistShare('0.5');
      setContractStartDate('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de création');
    } finally {
      setCreatingContract(false);
    }
  };

  const handleCreateAdvance = async () => {
    if (!advanceAmount) return;
    setCreatingAdvance(true);
    try {
      await createAdvance(artistId, parseFloat(advanceAmount), 'USD', advanceDescription);
      setShowAdvanceForm(false);
      setAdvanceAmount('');
      setAdvanceDescription('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de création');
    } finally {
      setCreatingAdvance(false);
    }
  };

  const handleFetchArtwork = async () => {
    setFetchingArtwork(true);
    try {
      await fetchArtistArtwork(artistId);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur Spotify');
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
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const getContractForRelease = (upc: string) => {
    return contracts.find(c => c.scope === 'release' && c.scope_id === upc);
  };

  const getContractForTrack = (isrc: string) => {
    return contracts.find(c => c.scope === 'track' && c.scope_id === isrc);
  };

  const getCatalogContract = () => {
    return contracts.find(c => c.scope === 'catalog');
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toLocaleString('fr-FR', { style: 'currency', currency: 'USD' });
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString('fr-FR');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Artiste non trouvé'}</p>
          <Link href="/artists">
            <Button variant="secondary">Retour</Button>
          </Link>
        </div>
      </div>
    );
  }

  const catalogContract = getCatalogContract();

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Link href="/artists" className="text-sm text-neutral-500 hover:text-neutral-700 mb-2 inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Artistes
          </Link>
          <div className="flex items-start gap-4 mt-2">
            {/* Artist Image */}
            <div className="relative group">
              {artist.image_url ? (
                <img
                  src={artist.image_url_small || artist.image_url}
                  alt={artist.name}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-neutral-200 flex items-center justify-center">
                  <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
              <button
                onClick={() => {
                  setEditImageUrl(artist.image_url || '');
                  setShowEditArtwork(true);
                }}
                className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-neutral-900">{artist.name}</h1>
              <p className="text-sm text-neutral-500 mt-1">
                {releases.length} release{releases.length > 1 ? 's' : ''} · {tracks.length} track{tracks.length > 1 ? 's' : ''}
              </p>
              {!artist.image_url && (
                <button
                  onClick={handleFetchArtwork}
                  disabled={fetchingArtwork}
                  className="mt-2 text-sm text-green-600 hover:text-green-700 inline-flex items-center gap-1"
                >
                  {fetchingArtwork ? (
                    <>
                      <div className="w-3 h-3 border border-green-600 border-t-transparent rounded-full animate-spin" />
                      Recherche...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                      Chercher sur Spotify
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Balance */}
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-sm text-neutral-500 mb-1">Solde avance</p>
          <p className="text-2xl font-semibold text-neutral-900">
            {formatCurrency(balance)}
          </p>
        </div>

        {/* Contrat Catalogue Global */}
        <div className="bg-white rounded-xl border border-neutral-200">
          <div className="px-4 py-3 border-b border-neutral-100">
            <h2 className="font-medium text-neutral-900">Contrat catalogue (défaut)</h2>
            <p className="text-sm text-neutral-500">S'applique à tout sauf si un contrat spécifique existe</p>
          </div>
          {catalogContract ? (
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">
                      {(parseFloat(catalogContract.artist_share) * 100).toFixed(0)}% artiste / {(parseFloat(catalogContract.label_share) * 100).toFixed(0)}% label
                    </p>
                    <p className="text-sm text-neutral-500">
                      Depuis {new Date(catalogContract.start_date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 py-4">
              <p className="text-neutral-500 text-sm mb-3">Aucun contrat catalogue défini</p>
              <Button size="sm" onClick={() => {
                setSelectedItem(null);
                setShowContractForm(true);
              }}>
                Définir un contrat catalogue
              </Button>
            </div>
          )}
        </div>

        {/* Releases avec contrats */}
        <div className="bg-white rounded-xl border border-neutral-200">
          <div className="px-4 py-3 border-b border-neutral-100">
            <h2 className="font-medium text-neutral-900">Releases ({releases.length})</h2>
            <p className="text-sm text-neutral-500">% spécifique par album/EP/single</p>
          </div>
          {loadingCatalog ? (
            <div className="px-4 py-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : releases.length === 0 ? (
            <p className="px-4 py-6 text-center text-neutral-500">Aucune release trouvée</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {releases.map((release, index) => {
                const contract = getContractForRelease(release.upc);
                return (
                  <div key={`${release.upc}-${index}`} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-neutral-900 truncate">{release.release_title}</p>
                        <p className="text-xs text-neutral-400 font-mono">UPC: {release.upc}</p>
                        <p className="text-sm text-neutral-500">
                          {release.track_count} track{release.track_count > 1 ? 's' : ''} · {formatCurrency(release.total_gross)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {contract ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            {(parseFloat(contract.artist_share) * 100).toFixed(0)}%
                          </span>
                        ) : catalogContract ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600">
                            {(parseFloat(catalogContract.artist_share) * 100).toFixed(0)}% (défaut)
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedItem({ type: 'release', id: release.upc, name: release.release_title });
                              setShowContractForm(true);
                            }}
                          >
                            Définir %
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tracks avec contrats */}
        <div className="bg-white rounded-xl border border-neutral-200">
          <div className="px-4 py-3 border-b border-neutral-100">
            <h2 className="font-medium text-neutral-900">Tracks ({tracks.length})</h2>
            <p className="text-sm text-neutral-500">% spécifique par track (optionnel)</p>
          </div>
          {loadingCatalog ? (
            <div className="px-4 py-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : tracks.length === 0 ? (
            <p className="px-4 py-6 text-center text-neutral-500">Aucune track trouvée</p>
          ) : (
            <div className="divide-y divide-neutral-100 max-h-96 overflow-y-auto">
              {tracks.map((track, index) => {
                const trackContract = getContractForTrack(track.isrc);
                const releaseContract = releases.find(r => r.release_title === track.release_title)
                  ? getContractForRelease(releases.find(r => r.release_title === track.release_title)!.upc)
                  : null;
                const effectiveContract = trackContract || releaseContract || catalogContract;
                const isSpecific = !!trackContract;
                const isReleaseLevel = !trackContract && !!releaseContract;

                return (
                  <div key={`${track.isrc}-${index}`} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-neutral-900 truncate">{track.track_title}</p>
                        <p className="text-sm text-neutral-500 truncate">{track.release_title}</p>
                        <p className="text-xs text-neutral-400 font-mono">ISRC: {track.isrc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {effectiveContract ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            isSpecific
                              ? 'bg-blue-100 text-blue-700'
                              : isReleaseLevel
                                ? 'bg-green-100 text-green-700'
                                : 'bg-neutral-100 text-neutral-600'
                          }`}>
                            {(parseFloat(effectiveContract.artist_share) * 100).toFixed(0)}%
                            {!isSpecific && (isReleaseLevel ? ' (release)' : ' (défaut)')}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedItem({ type: 'track', id: track.isrc, name: track.track_title });
                              setShowContractForm(true);
                            }}
                          >
                            Définir %
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Advances */}
        <div className="bg-white rounded-xl border border-neutral-200">
          <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
            <h2 className="font-medium text-neutral-900">Avances</h2>
            <Button size="sm" onClick={() => setShowAdvanceForm(true)}>Ajouter</Button>
          </div>
          {advances.length === 0 ? (
            <p className="px-4 py-6 text-center text-neutral-500">Aucune avance</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {advances.map((entry) => (
                <div key={entry.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900">
                        {entry.entry_type === 'advance' ? 'Avance' : 'Recoupement'}
                      </p>
                      {entry.description && (
                        <p className="text-sm text-neutral-500">{entry.description}</p>
                      )}
                    </div>
                    <p className={`font-medium ${entry.entry_type === 'advance' ? 'text-red-600' : 'text-green-600'}`}>
                      {entry.entry_type === 'advance' ? '-' : '+'}
                      {formatCurrency(entry.amount)}
                    </p>
                  </div>
                  <p className="text-sm text-neutral-500 mt-1">
                    {new Date(entry.effective_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Contract Form Modal */}
      {showContractForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-900">
                  {selectedItem ? `Contrat: ${selectedItem.name}` : 'Contrat catalogue'}
                </h2>
                <button onClick={() => {
                  setShowContractForm(false);
                  setSelectedItem(null);
                }} className="p-2 -mr-2 text-neutral-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              {selectedItem && (
                <div className="bg-neutral-50 rounded-lg p-3">
                  <p className="text-sm text-neutral-500">
                    {selectedItem.type === 'release' ? 'Release (UPC)' : 'Track (ISRC)'}
                  </p>
                  <p className="font-medium text-neutral-900">{selectedItem.name}</p>
                  <p className="text-xs text-neutral-400 font-mono mt-1">{selectedItem.id}</p>
                </div>
              )}
              {!selectedItem && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-sm text-blue-700">
                    Le contrat catalogue s'applique à toutes les releases et tracks qui n'ont pas de contrat spécifique.
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Part artiste: {(parseFloat(artistShare) * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={artistShare}
                  onChange={(e) => setArtistShare(e.target.value)}
                  className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-sm text-neutral-500 mt-2">
                  <span>Artiste: {(parseFloat(artistShare) * 100).toFixed(0)}%</span>
                  <span>Label: {((1 - parseFloat(artistShare)) * 100).toFixed(0)}%</span>
                </div>
              </div>
              <Input
                type="date"
                label="Date de début"
                value={contractStartDate}
                onChange={(e) => setContractStartDate(e.target.value)}
              />
            </div>
            <div className="p-4 sm:p-6 border-t border-neutral-100 flex gap-3">
              <Button variant="secondary" onClick={() => {
                setShowContractForm(false);
                setSelectedItem(null);
              }} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={selectedItem ? handleCreateContract : handleCreateCatalogContract}
                loading={creatingContract}
                disabled={!contractStartDate}
                className="flex-1"
              >
                Créer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Advance Form Modal */}
      {showAdvanceForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="px-4 py-4 sm:px-6 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-900">Nouvelle avance</h2>
                <button onClick={() => setShowAdvanceForm(false)} className="p-2 -mr-2 text-neutral-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <Input
                type="number"
                label="Montant (USD)"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="5000"
              />
              <Input
                label="Description (optionnel)"
                value={advanceDescription}
                onChange={(e) => setAdvanceDescription(e.target.value)}
                placeholder="Avance album 2025"
              />
            </div>
            <div className="p-4 sm:p-6 border-t border-neutral-100 flex gap-3">
              <Button variant="secondary" onClick={() => setShowAdvanceForm(false)} className="flex-1">
                Annuler
              </Button>
              <Button onClick={handleCreateAdvance} loading={creatingAdvance} disabled={!advanceAmount} className="flex-1">
                Créer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Artwork Modal */}
      {showEditArtwork && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="px-4 py-4 sm:px-6 border-b border-neutral-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-900">Photo de l'artiste</h2>
                <button onClick={() => setShowEditArtwork(false)} className="p-2 -mr-2 text-neutral-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              {editImageUrl && (
                <div className="flex justify-center">
                  <img src={editImageUrl} alt="Preview" className="w-32 h-32 rounded-full object-cover" />
                </div>
              )}
              <Input
                label="URL de l'image"
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="https://..."
              />
              <button
                onClick={handleFetchArtwork}
                disabled={fetchingArtwork}
                className="w-full py-2 text-sm text-green-600 hover:text-green-700 border border-green-200 rounded-lg inline-flex items-center justify-center gap-2"
              >
                {fetchingArtwork ? (
                  <>
                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                    Recherche...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                    Chercher sur Spotify
                  </>
                )}
              </button>
            </div>
            <div className="p-4 sm:p-6 border-t border-neutral-100 flex gap-3">
              <Button variant="secondary" onClick={() => setShowEditArtwork(false)} className="flex-1">
                Annuler
              </Button>
              <Button onClick={handleUpdateArtwork} className="flex-1">
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
