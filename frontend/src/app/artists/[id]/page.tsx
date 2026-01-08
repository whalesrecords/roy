'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Artist, Contract, AdvanceEntry, EXPENSE_CATEGORIES, ExpenseCategory, ArtistCategory, ARTIST_CATEGORIES } from '@/lib/types';
import { WHALES_LOGO_BASE64 } from '@/lib/whales-logo';
import {
  getArtist,
  getArtists,
  getContracts,
  createContract,
  updateContract,
  deleteContract,
  uploadContractDocument,
  getAdvances,
  createAdvance,
  updateAdvance,
  deleteAdvance,
  getAdvanceBalance,
  getPayments,
  createPayment,
  deletePayment,
  getArtistReleases,
  getArtistTracks,
  fetchArtistArtwork,
  fetchArtistFromSpotifyUrl,
  updateArtistArtwork,
  updateArtist,
  deleteArtist,
  calculateArtistRoyalties,
  searchAlbumByUPC,
  searchTrackByISRC,
  getCachedReleaseArtworks,
  getCachedTrackArtworks,
  getLabelSettings,
  CatalogRelease,
  CatalogTrack,
  ArtistRoyaltyCalculation,
  SpotifyAlbumResult,
  SpotifyTrackResult,
  LabelSettings
} from '@/lib/api';

type ContractTab = 'releases' | 'tracks';

// Period type for quarter/year selection
interface Period {
  label: string;
  value: string;
  start: string;
  end: string;
  type: 'quarter' | 'year';
}

// Generate available periods (quarters and years)
function generatePeriods(): Period[] {
  const periods: Period[] = [];
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;

  // 5 years back
  for (let year = currentYear; year >= currentYear - 4; year--) {
    // Full year option
    periods.push({
      label: `${year} (annee)`,
      value: `year-${year}`,
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      type: 'year',
    });

    // Quarters for this year
    const maxQuarter = year === currentYear ? currentQuarter : 4;
    for (let q = maxQuarter; q >= 1; q--) {
      const startMonth = (q - 1) * 3 + 1;
      const endMonth = q * 3;
      const lastDay = new Date(year, endMonth, 0).getDate();
      const monthNames = ['Jan-Mar', 'Avr-Jun', 'Jul-Sep', 'Oct-Dec'];

      periods.push({
        label: `Q${q} ${year} (${monthNames[q - 1]})`,
        value: `Q${q}-${year}`,
        start: `${year}-${String(startMonth).padStart(2, '0')}-01`,
        end: `${year}-${String(endMonth).padStart(2, '0')}-${lastDay}`,
        type: 'quarter',
      });
    }
  }

  return periods;
}

const PERIODS = generatePeriods();

export default function ArtistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const artistId = params.id as string;

  const [artist, setArtist] = useState<Artist | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [advances, setAdvances] = useState<AdvanceEntry[]>([]);
  const [balance, setBalance] = useState<string>('0');
  const [balanceCurrency, setBalanceCurrency] = useState<string>('EUR');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Catalog data
  const [releases, setReleases] = useState<CatalogRelease[]>([]);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Album/Track artwork from Spotify
  const [albumArtwork, setAlbumArtwork] = useState<Record<string, SpotifyAlbumResult>>({});
  const [trackArtwork, setTrackArtwork] = useState<Record<string, SpotifyTrackResult>>({});
  const [loadingArtwork, setLoadingArtwork] = useState<Record<string, boolean>>({});

  const [showContractForm, setShowContractForm] = useState(false);
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [contractTab, setContractTab] = useState<ContractTab>('releases');

  // Contract form
  const [selectedItem, setSelectedItem] = useState<{ type: 'release' | 'track'; id: string; name: string } | null>(null);
  const [artistShare, setArtistShare] = useState('0.5');
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [creatingContract, setCreatingContract] = useState(false);

  // Advance form
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDescription, setAdvanceDescription] = useState('');
  const [advanceScope, setAdvanceScope] = useState<'catalog' | 'release' | 'track'>('catalog');
  const [advanceScopeId, setAdvanceScopeId] = useState('');
  const [advanceCategory, setAdvanceCategory] = useState<ExpenseCategory | ''>('');
  const [creatingAdvance, setCreatingAdvance] = useState(false);

  // Delete artist
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Artwork
  const [fetchingArtwork, setFetchingArtwork] = useState(false);
  const [showEditArtwork, setShowEditArtwork] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [spotifyProfileUrl, setSpotifyProfileUrl] = useState('');

  // Royalty calculation
  const [selectedPeriod, setSelectedPeriod] = useState<string>(PERIODS[1]?.value || PERIODS[0]?.value || ''); // Default to first quarter
  const [calculatingRoyalties, setCalculatingRoyalties] = useState(false);
  const [royaltyResult, setRoyaltyResult] = useState<ArtistRoyaltyCalculation | null>(null);
  const [royaltyError, setRoyaltyError] = useState<string | null>(null);
  const [markingAsPaid, setMarkingAsPaid] = useState(false);
  const [paidQuarters, setPaidQuarters] = useState<{ quarter: string; amount: number; date: string }[]>([]);

  // Edit artist
  const [showEditArtist, setShowEditArtist] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSpotifyId, setEditSpotifyId] = useState('');
  const [editCategory, setEditCategory] = useState<ArtistCategory>('signed');
  const [savingArtist, setSavingArtist] = useState(false);

  // Expanded releases (to show tracks)
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set());

  // Edit advance
  const [editingAdvance, setEditingAdvance] = useState<AdvanceEntry | null>(null);
  const [editAdvanceAmount, setEditAdvanceAmount] = useState('');
  const [editAdvanceDescription, setEditAdvanceDescription] = useState('');
  const [editAdvanceScope, setEditAdvanceScope] = useState<'catalog' | 'release' | 'track'>('catalog');
  const [editAdvanceScopeId, setEditAdvanceScopeId] = useState('');
  const [editAdvanceCategory, setEditAdvanceCategory] = useState<ExpenseCategory | ''>('');
  const [savingAdvance, setSavingAdvance] = useState(false);
  const [deletingAdvanceId, setDeletingAdvanceId] = useState<string | null>(null);

  // Payments
  const [payments, setPayments] = useState<AdvanceEntry[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDescription, setPaymentDescription] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [creatingPayment, setCreatingPayment] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);

  // Edit contract
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [editContractShare, setEditContractShare] = useState('0.5');
  const [editContractStartDate, setEditContractStartDate] = useState('');
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [contractParties, setContractParties] = useState<Array<{id?: string; party_type: 'artist' | 'label'; artist_id?: string; label_name?: string; share_percentage: number}>>([]);
  const [savingContract, setSavingContract] = useState(false);
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [artistId]);

  const loadData = async () => {
    try {
      const [artistData, contractsData, advancesData, balanceData, paymentsData, allArtistsData] = await Promise.all([
        getArtist(artistId),
        getContracts(artistId),
        getAdvances(artistId),
        getAdvanceBalance(artistId),
        getPayments(artistId),
        getArtists(),
      ]);
      setArtist(artistData);
      setContracts(contractsData);
      setAdvances(advancesData);
      setBalance(balanceData.balance);
      setBalanceCurrency(balanceData.currency || 'EUR');
      setPayments(paymentsData);
      setAllArtists(allArtistsData);

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

          // Load cached artworks in bulk (much faster than individual requests)
          const releaseUpcs = releasesData.map(r => r.upc).filter(Boolean);
          const trackIsrcs = tracksData.map(t => t.isrc).filter(Boolean);

          const [cachedReleaseArt, cachedTrackArt] = await Promise.all([
            getCachedReleaseArtworks(releaseUpcs).catch(() => []),
            getCachedTrackArtworks(trackIsrcs).catch(() => []),
          ]);

          // Set cached artworks
          const albumArtMap: Record<string, SpotifyAlbumResult> = {};
          for (const art of cachedReleaseArt) {
            if (art.upc && art.image_url) {
              albumArtMap[art.upc] = {
                spotify_id: art.spotify_id,
                name: art.name,
                image_url: art.image_url,
                image_url_small: art.image_url_small,
              };
            }
          }
          setAlbumArtwork(albumArtMap);

          const trackArtMap: Record<string, SpotifyTrackResult> = {};
          for (const art of cachedTrackArt) {
            if (art.isrc && art.image_url) {
              trackArtMap[art.isrc] = {
                spotify_id: art.spotify_id,
                name: art.name,
                album_name: art.album_name,
                image_url: art.image_url,
                image_url_small: art.image_url_small,
              };
            }
          }
          setTrackArtwork(trackArtMap);

          // Fetch missing artwork from Spotify for first 5 releases (the rest can be loaded on demand)
          const missingReleases = releasesData.filter(r => r.upc && !albumArtMap[r.upc]).slice(0, 5);
          for (const release of missingReleases) {
            try {
              const artworkResult = await searchAlbumByUPC(release.upc);
              if (artworkResult.image_url) {
                setAlbumArtwork(prev => ({ ...prev, [release.upc]: artworkResult }));
              }
            } catch {
              // Silently fail - artwork is optional
            }
          }
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
    if (contractParties.length === 0) {
      setError('Veuillez ajouter au moins une partie au contrat');
      return;
    }
    const totalShare = contractParties.reduce((sum, p) => sum + p.share_percentage, 0);
    if (totalShare !== 100) {
      setError('Le total des parts doit être égal à 100%');
      return;
    }

    setCreatingContract(true);
    try {
      const contract = await createContract({
        artist_id: artistId,
        scope: selectedItem.type,
        scope_id: selectedItem.id,
        start_date: contractStartDate,
        end_date: contractEndDate || undefined,
        parties: contractParties.map(p => ({
          party_type: p.party_type,
          artist_id: p.artist_id,
          label_name: p.label_name,
          share_percentage: p.share_percentage / 100, // Convert to decimal
        })),
      });

      // Upload PDF if provided
      if (contractFile && contract.id) {
        setUploadingContract(true);
        try {
          await uploadContractDocument(contract.id, contractFile);
        } catch (uploadErr) {
          console.error('Failed to upload contract document:', uploadErr);
          setError('Contrat créé mais échec upload PDF');
        } finally {
          setUploadingContract(false);
        }
      }

      setShowContractForm(false);
      setSelectedItem(null);
      setContractParties([]);
      setContractStartDate('');
      setContractEndDate('');
      setContractFile(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de création');
    } finally {
      setCreatingContract(false);
    }
  };

  const handleCreateCatalogContract = async () => {
    if (!contractStartDate) return;
    if (contractParties.length === 0) {
      setError('Veuillez ajouter au moins une partie au contrat');
      return;
    }
    const totalShare = contractParties.reduce((sum, p) => sum + p.share_percentage, 0);
    if (totalShare !== 100) {
      setError('Le total des parts doit être égal à 100%');
      return;
    }

    setCreatingContract(true);
    try {
      const contract = await createContract({
        artist_id: artistId,
        scope: 'catalog',
        start_date: contractStartDate,
        end_date: contractEndDate || undefined,
        parties: contractParties.map(p => ({
          party_type: p.party_type,
          artist_id: p.artist_id,
          label_name: p.label_name,
          share_percentage: p.share_percentage / 100, // Convert to decimal
        })),
      });

      // Upload PDF if provided
      if (contractFile && contract.id) {
        setUploadingContract(true);
        try {
          await uploadContractDocument(contract.id, contractFile);
        } catch (uploadErr) {
          console.error('Failed to upload contract document:', uploadErr);
          setError('Contrat créé mais échec upload PDF');
        } finally {
          setUploadingContract(false);
        }
      }

      setShowContractForm(false);
      setContractParties([]);
      setContractStartDate('');
      setContractEndDate('');
      setContractFile(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de création');
    } finally {
      setCreatingContract(false);
    }
  };

  const handleCreateAdvance = async () => {
    if (!advanceAmount) return;
    if (advanceScope !== 'catalog' && !advanceScopeId) return;
    setCreatingAdvance(true);
    try {
      await createAdvance(
        artistId,
        parseFloat(advanceAmount),
        'EUR',
        advanceDescription || undefined,
        advanceScope,
        advanceScope !== 'catalog' ? advanceScopeId : undefined,
        advanceCategory || undefined
      );
      setShowAdvanceForm(false);
      setAdvanceAmount('');
      setAdvanceDescription('');
      setAdvanceScope('catalog');
      setAdvanceScopeId('');
      setAdvanceCategory('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de création');
    } finally {
      setCreatingAdvance(false);
    }
  };

  const handleCreatePayment = async () => {
    if (!paymentAmount) return;
    setCreatingPayment(true);
    try {
      await createPayment(
        artistId,
        parseFloat(paymentAmount),
        'EUR',
        paymentDescription || undefined,
        paymentDate || undefined
      );
      setShowPaymentForm(false);
      setPaymentAmount('');
      setPaymentDescription('');
      setPaymentDate('');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de création');
    } finally {
      setCreatingPayment(false);
    }
  };

  const handleDeleteArtist = async () => {
    if (!artist || deleteConfirmText !== artist.name) return;
    setDeleting(true);
    try {
      await deleteArtist(artistId);
      router.push('/artists');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression');
      setDeleting(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Supprimer ce versement ?')) return;
    setDeletingPaymentId(paymentId);
    try {
      await deletePayment(artistId, paymentId);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression');
    } finally {
      setDeletingPaymentId(null);
    }
  };

  const handleFetchArtwork = async () => {
    setFetchingArtwork(true);
    try {
      if (spotifyProfileUrl.trim()) {
        // Use URL/ID provided by user
        const result = await fetchArtistFromSpotifyUrl(artistId, spotifyProfileUrl.trim());
        if (result.image_url) {
          setEditImageUrl(result.image_url);
        }
      } else {
        // Search by artist name
        await fetchArtistArtwork(artistId);
      }
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
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingArtist(false);
    }
  };

  const toggleReleaseExpanded = (upc: string) => {
    setExpandedReleases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(upc)) {
        newSet.delete(upc);
      } else {
        newSet.add(upc);
      }
      return newSet;
    });
  };

  const getTracksForRelease = (releaseTitle: string): CatalogTrack[] => {
    return tracks.filter(t => t.release_title === releaseTitle);
  };

  const handleEditAdvance = (advance: AdvanceEntry) => {
    setEditingAdvance(advance);
    setEditAdvanceAmount(advance.amount);
    setEditAdvanceDescription(advance.description || '');
    setEditAdvanceScope(advance.scope || 'catalog');
    setEditAdvanceScopeId(advance.scope_id || '');
    setEditAdvanceCategory(advance.category || '');
  };

  const handleUpdateAdvance = async () => {
    if (!editingAdvance || !editAdvanceAmount) return;
    if (editAdvanceScope !== 'catalog' && !editAdvanceScopeId) return;
    setSavingAdvance(true);
    try {
      await updateAdvance(
        artistId,
        editingAdvance.id,
        parseFloat(editAdvanceAmount),
        'EUR',
        editAdvanceDescription || undefined,
        editAdvanceScope,
        editAdvanceScope !== 'catalog' ? editAdvanceScopeId : undefined,
        editAdvanceCategory || undefined
      );
      setEditingAdvance(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingAdvance(false);
    }
  };

  const handleDeleteAdvance = async (advanceId: string) => {
    if (!confirm('Supprimer cette avance ?')) return;
    setDeletingAdvanceId(advanceId);
    try {
      await deleteAdvance(artistId, advanceId);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDeletingAdvanceId(null);
    }
  };

  const handleEditContract = (contract: Contract) => {
    setEditingContract(contract);
    setEditContractShare(contract.artist_share);
    setEditContractStartDate(contract.start_date);
  };

  const handleUpdateContract = async () => {
    if (!editingContract || !editContractStartDate) return;
    setSavingContract(true);
    try {
      const share = parseFloat(editContractShare);
      await updateContract(artistId, editingContract.id, {
        scope: editingContract.scope,
        scope_id: editingContract.scope_id || undefined,
        artist_share: share,
        label_share: 1 - share,
        start_date: editContractStartDate,
      });
      setEditingContract(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setSavingContract(false);
    }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (!confirm('Supprimer ce contrat ?')) return;
    setDeletingContractId(contractId);
    try {
      await deleteContract(artistId, contractId);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally {
      setDeletingContractId(null);
    }
  };

  const handleCalculateRoyalties = async () => {
    const period = PERIODS.find(p => p.value === selectedPeriod);
    if (!period) return;

    setCalculatingRoyalties(true);
    setRoyaltyError(null);
    setRoyaltyResult(null);
    setPaidQuarters([]);

    try {
      const result = await calculateArtistRoyalties(
        artistId,
        period.start,
        period.end
      );
      setRoyaltyResult(result);

      // If this is a year period, find paid quarters within this year
      if (period.type === 'year') {
        const year = period.value.replace('year-', '');
        const quarterPatterns = [`Q1 ${year}`, `Q2 ${year}`, `Q3 ${year}`, `Q4 ${year}`];

        const paid = payments.filter(p => {
          const desc = p.description || '';
          return quarterPatterns.some(q => desc.includes(q));
        }).map(p => ({
          quarter: (p.description || '').replace('Paiement ', ''),
          amount: parseFloat(p.amount),
          date: p.effective_date,
        }));

        setPaidQuarters(paid);
      }
    } catch (err) {
      setRoyaltyError(err instanceof Error ? err.message : 'Erreur de calcul');
    } finally {
      setCalculatingRoyalties(false);
    }
  };

  const handleMarkAsPaid = async () => {
    if (!royaltyResult) return;

    const paidTotal = paidQuarters.reduce((sum, pq) => sum + pq.amount, 0);
    const remaining = parseFloat(royaltyResult.net_payable) - paidTotal;

    if (remaining <= 0) return;

    const period = PERIODS.find(p => p.value === selectedPeriod);
    if (!period) return;

    setMarkingAsPaid(true);
    try {
      // Create payment entry with period description
      await createPayment(
        artistId,
        remaining, // Use remaining amount after paid quarters
        'EUR',
        `Paiement ${period.label.split(' (')[0]}`, // "Q3 2024" or "2024"
        new Date().toISOString().split('T')[0]
      );
      // Reload data to show the new payment
      await loadData();
      setRoyaltyResult(null); // Clear result after payment
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du paiement');
    } finally {
      setMarkingAsPaid(false);
    }
  };

  const handleExportCSV = () => {
    if (!royaltyResult || !artist) return;

    const lines: string[] = [];

    // Header
    lines.push(`Relevé de royalties - ${artist.name}`);
    lines.push(`Période: ${new Date(royaltyResult.period_start).toLocaleDateString('fr-FR')} - ${new Date(royaltyResult.period_end).toLocaleDateString('fr-FR')}`);
    lines.push('');

    // Summary
    lines.push('RÉSUMÉ');
    lines.push(`Brut total;${royaltyResult.total_gross} ${royaltyResult.currency}`);
    lines.push(`Royalties artiste;${royaltyResult.total_artist_royalties} ${royaltyResult.currency}`);
    lines.push(`Royalties label;${royaltyResult.total_label_royalties} ${royaltyResult.currency}`);
    lines.push(`Solde avance;${royaltyResult.advance_balance} ${royaltyResult.currency}`);
    lines.push(`Recoupable;${royaltyResult.recoupable} ${royaltyResult.currency}`);
    lines.push(`Net payable;${royaltyResult.net_payable} ${royaltyResult.currency}`);
    lines.push('');

    // Sources breakdown
    if (royaltyResult.sources && royaltyResult.sources.length > 0) {
      lines.push('DÉTAIL PAR SOURCE');
      lines.push('Source;Transactions;Streams;Brut;Royalties artiste;Royalties label');
      for (const source of royaltyResult.sources) {
        lines.push([
          source.source_label,
          source.transaction_count.toString(),
          source.streams.toString(),
          `${source.gross} ${royaltyResult.currency}`,
          `${source.artist_royalties} ${royaltyResult.currency}`,
          `${source.label_royalties} ${royaltyResult.currency}`,
        ].join(';'));
      }
      lines.push('');
    }

    // Albums detail
    lines.push('DÉTAIL PAR ALBUM');
    lines.push('Album;UPC;Tracks;Streams;Brut;Part artiste;Royalties artiste;Avance album;Recoupé;Net album;Inclus dans');
    for (const album of royaltyResult.albums) {
      const advanceBalance = parseFloat(album.advance_balance || '0');
      const recoupable = parseFloat(album.recoupable || '0');
      const netPayable = parseFloat(album.net_payable || album.artist_royalties);
      const isIncludedInAlbum = !!album.included_in_upc;
      const parentAlbum = isIncludedInAlbum
        ? royaltyResult.albums.find(a => a.upc === album.included_in_upc)
        : null;

      lines.push([
        album.release_title,
        album.upc,
        album.track_count.toString(),
        album.streams.toString(),
        `${album.gross} ${royaltyResult.currency}`,
        `${(parseFloat(album.artist_share) * 100).toFixed(0)}%`,
        `${album.artist_royalties} ${royaltyResult.currency}`,
        advanceBalance > 0 ? `${advanceBalance} ${royaltyResult.currency}` : '-',
        recoupable > 0 ? `${recoupable} ${royaltyResult.currency}` : '-',
        isIncludedInAlbum ? 'Inclus dans album' : `${netPayable} ${royaltyResult.currency}`,
        parentAlbum ? parentAlbum.release_title : '-',
      ].join(';'));
    }

    // Download
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `royalties_${artist.name.replace(/\s+/g, '_')}_${royaltyResult.period_start}_${royaltyResult.period_end}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = async () => {
    if (!royaltyResult || !artist) return;

    // Fetch label settings for the header
    let labelSettings: LabelSettings | null = null;
    try {
      labelSettings = await getLabelSettings();
    } catch (err) {
      console.error('Error fetching label settings:', err);
    }

    // Fetch advances
    let advances: AdvanceEntry[] = [];
    try {
      const allAdvances = await getAdvances(artist.id);
      // Filter only actual advances (not recoupments)
      advances = allAdvances.filter(a => a.entry_type === 'advance');
    } catch (err) {
      console.error('Error fetching advances:', err);
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Build label header HTML (positioned on the right)
    const labelHeaderHtml = labelSettings ? `
      <div class="label-header">
        ${labelSettings.logo_base64 ? `<img src="${labelSettings.logo_base64}" alt="${labelSettings.label_name}" class="label-logo" />` : ''}
        <div class="label-info">
          <div class="label-name">${labelSettings.label_name}</div>
          ${labelSettings.address_line1 ? `<div>${labelSettings.address_line1}</div>` : ''}
          ${labelSettings.address_line2 ? `<div>${labelSettings.address_line2}</div>` : ''}
          ${labelSettings.postal_code || labelSettings.city ? `<div>${[labelSettings.postal_code, labelSettings.city].filter(Boolean).join(' ')}</div>` : ''}
          ${labelSettings.country ? `<div>${labelSettings.country}</div>` : ''}
          ${labelSettings.email ? `<div>${labelSettings.email}</div>` : ''}
          ${labelSettings.phone ? `<div>${labelSettings.phone}</div>` : ''}
          ${labelSettings.website ? `<div>${labelSettings.website}</div>` : ''}
          ${labelSettings.siret ? `<div class="legal">SIRET: ${labelSettings.siret}</div>` : ''}
          ${labelSettings.vat_number ? `<div class="legal">VAT: ${labelSettings.vat_number}</div>` : ''}
        </div>
      </div>
    ` : '';

    // Format dates in English
    const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const formatCurrency = (value: string) => {
      const num = parseFloat(value);
      return num.toLocaleString('en-US', {
        style: 'currency',
        currency: royaltyResult.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };
    const formatNumber = (value: number) => value.toLocaleString('en-US');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Royalty Statement - ${artist.name}</title>
        <style>
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
          .label-header { position: absolute; top: 40px; right: 40px; text-align: right; }
          .label-logo { max-width: 80px; max-height: 50px; object-fit: contain; margin-bottom: 8px; }
          .label-info { font-size: 11px; color: #333; line-height: 1.4; }
          .label-name { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
          .label-info .legal { color: #666; font-size: 10px; margin-top: 4px; }
          .main-content { margin-top: 120px; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #e5e5e5; padding-bottom: 8px; }
          .period { color: #666; font-size: 14px; margin-bottom: 24px; }
          .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
          .summary-item { background: #f5f5f5; padding: 12px; border-radius: 8px; }
          .summary-item label { font-size: 12px; color: #666; display: block; }
          .summary-item value { font-size: 18px; font-weight: 600; }
          .highlight { background: #dcfce7 !important; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; }
          th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #e5e5e5; }
          th { background: #f5f5f5; font-weight: 600; }
          .mono { font-family: monospace; font-size: 12px; color: #666; }
          .right { text-align: right; }
          .footer {
            margin-top: 30px;
            padding: 20px 0 10px 0;
            border-top: 2px solid #e5e5e5;
            text-align: center;
            page-break-inside: avoid;
          }
          .footer-logo { max-width: 150px; max-height: 60px; margin: 0 auto 10px; display: block; }
          .footer-text { font-size: 10px; color: #666; margin-top: 5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          @page {
            margin: 20mm 15mm 30mm 15mm;
            @bottom-center {
              content: "Page " counter(page) " / " counter(pages);
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 10px;
              color: #666;
            }
          }
          @media print {
            body { padding: 20px; }
            .label-header { top: 20px; right: 20px; }
            .footer { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        ${labelHeaderHtml}

        <div class="main-content">
        <h1>Royalty Statement</h1>
        <p style="font-size: 18px; margin-bottom: 4px;">${artist.name}</p>
        <p class="period">Period: ${formatDate(new Date(royaltyResult.period_start))} - ${formatDate(new Date(royaltyResult.period_end))}</p>

        <h2>Summary</h2>
        <div class="summary">
          <div class="summary-item">
            <label>Gross Revenue</label>
            <value>${formatCurrency(royaltyResult.total_gross)}</value>
          </div>
          <div class="summary-item">
            <label>Artist Royalties</label>
            <value>${formatCurrency(royaltyResult.total_artist_royalties)}</value>
          </div>
          <div class="summary-item">
            <label>Advance Balance</label>
            <value>${formatCurrency(royaltyResult.advance_balance)}</value>
          </div>
          <div class="summary-item">
            <label>Recoupable</label>
            <value>${formatCurrency(royaltyResult.recoupable)}</value>
          </div>
          <div class="summary-item highlight" style="grid-column: span 2;">
            <label>Net Payable</label>
            <value style="font-size: 24px;">${formatCurrency(royaltyResult.net_payable)}</value>
          </div>
        </div>

        ${paidQuarters.length > 0 ? `
        <h2>Previously Paid Quarters</h2>
        <table>
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Payment Date</th>
              <th class="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${paidQuarters.map(pq => `
              <tr>
                <td>${pq.quarter}</td>
                <td>${formatDate(new Date(pq.date))}</td>
                <td class="right" style="color: #b45309;">-${formatCurrency(pq.amount.toString())}</td>
              </tr>
            `).join('')}
            <tr style="font-weight: bold; background: #dcfce7;">
              <td colspan="2">Remaining Balance</td>
              <td class="right" style="color: #15803d; font-size: 18px;">${formatCurrency((parseFloat(royaltyResult.net_payable) - paidQuarters.reduce((sum, pq) => sum + pq.amount, 0)).toString())}</td>
            </tr>
          </tbody>
        </table>
        ` : ''}

        ${royaltyResult.sources && royaltyResult.sources.length > 0 ? `
        <h2>Revenue by Source</h2>
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th class="right">Transactions</th>
              <th class="right">Streams/Sales</th>
              <th class="right">Gross</th>
              <th class="right">Royalties</th>
            </tr>
          </thead>
          <tbody>
            ${royaltyResult.sources.map(source => {
              const isSales = source.source_label.toLowerCase() === 'bandcamp' || source.source_label.toLowerCase() === 'squarespace';
              return `
              <tr>
                <td>${source.source_label}</td>
                <td class="right">${formatNumber(source.transaction_count)}</td>
                <td class="right">${formatNumber(source.streams)} ${isSales ? 'sale' : 'stream'}${source.streams > 1 ? 's' : ''}</td>
                <td class="right">${formatCurrency(source.gross)}</td>
                <td class="right">${formatCurrency(source.artist_royalties)}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
        ` : ''}

        ${advances.length > 0 ? `
        <h2>Advances History</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th class="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${advances.map(advance => {
              const categoryLabel = advance.category
                ? advance.category.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                : 'General';
              return `
              <tr>
                <td>${formatDate(new Date(advance.effective_date))}</td>
                <td>${categoryLabel}</td>
                <td>${advance.description || '-'}</td>
                <td class="right" style="color: #b45309; font-weight: 600;">-${formatCurrency(advance.amount)}</td>
              </tr>
            `}).join('')}
            <tr style="font-weight: bold; background: #fee2e2;">
              <td colspan="3">Total Advances</td>
              <td class="right" style="color: #dc2626; font-size: 16px;">-${formatCurrency(advances.reduce((sum, a) => sum + parseFloat(a.amount), 0).toString())}</td>
            </tr>
          </tbody>
        </table>
        ` : ''}

        <h2>Album Details</h2>
        <table>
          <thead>
            <tr>
              <th>Album</th>
              <th>Tracks</th>
              <th class="right">Streams</th>
              <th class="right">Gross</th>
              <th class="right">Share</th>
              <th class="right">Royalties</th>
              <th class="right">Advance</th>
              <th class="right">Net</th>
            </tr>
          </thead>
          <tbody>
            ${royaltyResult.albums.map(album => {
              const advanceBalance = parseFloat(album.advance_balance || '0');
              const recoupable = parseFloat(album.recoupable || '0');
              const netPayable = parseFloat(album.net_payable || album.artist_royalties);
              const hasAdvance = advanceBalance > 0;
              const isIncludedInAlbum = !!album.included_in_upc;

              // Find the parent album title if this single is included in an album
              const parentAlbum = isIncludedInAlbum
                ? royaltyResult.albums.find(a => a.upc === album.included_in_upc)
                : null;

              return `
              <tr style="${isIncludedInAlbum ? 'background: #fef3c7;' : ''}">
                <td>
                  <div>${album.release_title}</div>
                  <div class="mono">UPC: ${album.upc}</div>
                  ${isIncludedInAlbum ? `<div style="font-size: 11px; color: #92400e; margin-top: 4px;">⚠️ Included in ${parentAlbum?.release_title || 'album'} recoupment</div>` : ''}
                </td>
                <td>${album.track_count}</td>
                <td class="right">${formatNumber(album.streams)}</td>
                <td class="right">${isIncludedInAlbum ? `<span style="text-decoration: line-through; color: #999;">${formatCurrency(album.gross)}</span>` : formatCurrency(album.gross)}</td>
                <td class="right">${(parseFloat(album.artist_share) * 100).toFixed(0)}%</td>
                <td class="right">${(hasAdvance || isIncludedInAlbum) ? `<span style="text-decoration: line-through; color: #999;">${formatCurrency(album.artist_royalties)}</span>` : formatCurrency(album.artist_royalties)}</td>
                <td class="right" style="color: ${hasAdvance ? '#b45309' : '#999'};">${hasAdvance ? `-${formatCurrency(recoupable.toString())}` : '-'}</td>
                <td class="right" style="font-weight: ${hasAdvance ? 'bold' : 'normal'};">${isIncludedInAlbum ? '-' : formatCurrency(netPayable.toString())}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>

        <div class="footer">
          <img src="${WHALES_LOGO_BASE64}" alt="Whales Logo" class="footer-logo" />
          <div class="footer-text">Generated on ${formatDate(new Date())} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          ${labelSettings?.label_name ? ` - ${labelSettings.label_name}` : ''}</div>
        </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  const fetchAlbumArtwork = async (upc: string) => {
    if (albumArtwork[upc] || loadingArtwork[`album-${upc}`]) return;

    setLoadingArtwork(prev => ({ ...prev, [`album-${upc}`]: true }));
    try {
      const result = await searchAlbumByUPC(upc);
      if (result.image_url) {
        setAlbumArtwork(prev => ({ ...prev, [upc]: result }));
      }
    } catch (err) {
      console.error(`Error fetching album artwork for ${upc}:`, err);
    } finally {
      setLoadingArtwork(prev => ({ ...prev, [`album-${upc}`]: false }));
    }
  };

  const fetchTrackArtwork = async (isrc: string) => {
    if (trackArtwork[isrc] || loadingArtwork[`track-${isrc}`]) return;

    setLoadingArtwork(prev => ({ ...prev, [`track-${isrc}`]: true }));
    try {
      const result = await searchTrackByISRC(isrc);
      if (result.image_url) {
        setTrackArtwork(prev => ({ ...prev, [isrc]: result }));
      }
    } catch (err) {
      console.error(`Error fetching track artwork for ${isrc}:`, err);
    } finally {
      setLoadingArtwork(prev => ({ ...prev, [`track-${isrc}`]: false }));
    }
  };

  const fetchAllArtwork = async () => {
    // Fetch artwork for all releases (limit to first 10 to avoid rate limiting)
    const releasesToFetch = releases.slice(0, 10);
    for (const release of releasesToFetch) {
      if (!albumArtwork[release.upc]) {
        await fetchAlbumArtwork(release.upc);
      }
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

  const formatCurrency = (value: string | number, currency: string = 'EUR') => {
    const valueStr = typeof value === 'number' ? value.toString() : value;
    const num = parseFloat(valueStr);
    return num.toLocaleString('fr-FR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString('fr-FR');
  };

  // Group releases by UPC (or release_title if no UPC)
  const groupedReleases = releases.reduce((acc, release) => {
    const key = release.upc || release.release_title;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(release);
    return acc;
  }, {} as Record<string, CatalogRelease[]>);

  // Convert to array with aggregated data
  const groupedReleasesArray = Object.entries(groupedReleases).map(([key, releases]) => {
    const firstRelease = releases[0];
    const totalGross = releases.reduce((sum, r) => sum + parseFloat(r.total_gross), 0);
    const totalStreams = releases.reduce((sum, r) => sum + r.total_streams, 0);
    const totalTracks = Math.max(...releases.map(r => r.track_count)); // Max track count

    return {
      key,
      release_title: firstRelease.release_title,
      upc: firstRelease.upc,
      currency: firstRelease.currency,
      total_gross: totalGross.toString(),
      total_streams: totalStreams,
      track_count: totalTracks,
      sources: releases,
    };
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-default-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="min-h-screen bg-default-50 flex items-center justify-center">
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
    <div className="min-h-screen bg-default-50">
      <header className="bg-background border-b border-divider">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <Link href="/artists" className="text-sm text-default-500 hover:text-default-700 mb-2 inline-flex items-center gap-1">
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
                <div className="w-16 h-16 rounded-full bg-default-200 flex items-center justify-center">
                  <svg className="w-8 h-8 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-foreground">{artist.name}</h1>
                <button
                  onClick={() => {
                    setEditName(artist.name);
                    setEditSpotifyId(artist.spotify_id || '');
                    setEditCategory(artist.category || 'signed');
                    setShowEditArtist(true);
                  }}
                  className="p-1.5 text-default-400 hover:text-default-600 hover:bg-default-100 rounded-lg transition-colors"
                  title="Modifier l'artiste"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-default-500">
                  {releases.length} release{releases.length > 1 ? 's' : ''} · {tracks.length} track{tracks.length > 1 ? 's' : ''}
                </p>
                {artist.category === 'collaborator' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-100 text-secondary-700">
                    Collaborateur
                  </span>
                )}
              </div>
              {artist.spotify_id && (
                <a
                  href={`https://open.spotify.com/artist/${artist.spotify_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-700 mt-1"
                >
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  Profil Spotify
                </a>
              )}
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
        <div className="bg-background rounded-xl border border-divider p-4">
          <p className="text-sm text-default-500 mb-1">Solde avance</p>
          <p className="text-2xl font-semibold text-foreground">
            {formatCurrency(balance, balanceCurrency)}
          </p>
        </div>

        {/* Calcul Royalties */}
        <div className="bg-background rounded-xl border border-divider">
          <div className="px-4 py-3 border-b border-divider">
            <h2 className="font-medium text-foreground">Calcul des royalties</h2>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="flex-1 px-3 py-2 border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                {PERIODS.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </select>
              <Button
                onClick={handleCalculateRoyalties}
                loading={calculatingRoyalties}
              >
                Calculer
              </Button>
            </div>

            {royaltyError && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                {royaltyError}
              </div>
            )}

            {royaltyResult && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-default-50 rounded-lg p-3">
                    <p className="text-xs text-default-500">Brut total</p>
                    <p className="text-lg font-semibold text-foreground">
                      {formatCurrency(royaltyResult.total_gross, royaltyResult.currency)}
                    </p>
                  </div>
                  <div className="bg-default-50 rounded-lg p-3">
                    <p className="text-xs text-default-500">Royalties artiste</p>
                    <p className="text-lg font-semibold text-foreground">
                      {formatCurrency(royaltyResult.total_artist_royalties, royaltyResult.currency)}
                    </p>
                  </div>
                </div>

                {/* Advance breakdown - only show if there are advances */}
                {parseFloat(royaltyResult.total_advances || '0') > 0 && (
                  <div className="bg-amber-50 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-amber-800">Détail des avances</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-amber-700">Avances totales</span>
                        <span className="font-medium text-amber-900">{formatCurrency(royaltyResult.total_advances, royaltyResult.currency)}</span>
                      </div>
                      {parseFloat(royaltyResult.total_recouped_before || '0') > 0 && (
                        <div className="flex justify-between">
                          <span className="text-amber-700">Déjà recoupé (périodes précédentes)</span>
                          <span className="font-medium text-green-700">-{formatCurrency(royaltyResult.total_recouped_before, royaltyResult.currency)}</span>
                        </div>
                      )}
                      {parseFloat(royaltyResult.recoupable || '0') > 0 && (
                        <div className="flex justify-between">
                          <span className="text-amber-700">Recoupé cette période</span>
                          <span className="font-medium text-green-700">-{formatCurrency(royaltyResult.recoupable, royaltyResult.currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-amber-200 pt-1 mt-1">
                        <span className="font-medium text-amber-800">Reste à recouper</span>
                        <span className="font-bold text-amber-900">{formatCurrency(royaltyResult.remaining_advance, royaltyResult.currency)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Net payable */}
                <div className={`rounded-lg p-4 ${parseFloat(royaltyResult.net_payable) > 0 ? 'bg-green-50' : 'bg-default-50'}`}>
                  <p className="text-xs text-default-500 mb-1">Net payable à l'artiste</p>
                  <p className={`text-2xl font-bold ${parseFloat(royaltyResult.net_payable) > 0 ? 'text-green-700' : 'text-foreground'}`}>
                    {formatCurrency(royaltyResult.net_payable, royaltyResult.currency)}
                  </p>
                </div>

                {/* Paid quarters (for year view) */}
                {paidQuarters.length > 0 && (
                  <div className="bg-amber-50 rounded-lg p-3 space-y-2">
                    <p className="text-xs font-medium text-amber-700">Trimestres deja payes cette annee</p>
                    {paidQuarters.map((pq, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-amber-800">{pq.quarter} (paye le {new Date(pq.date).toLocaleDateString('fr-FR')})</span>
                        <span className="font-medium text-amber-900">-{formatCurrency(pq.amount.toString(), royaltyResult.currency)}</span>
                      </div>
                    ))}
                    <div className="border-t border-amber-200 pt-2 flex justify-between">
                      <span className="text-sm font-medium text-amber-800">Reste a payer</span>
                      <span className="text-lg font-bold text-green-700">
                        {formatCurrency((parseFloat(royaltyResult.net_payable) - paidQuarters.reduce((sum, pq) => sum + pq.amount, 0)).toString(), royaltyResult.currency)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Period info */}
                <p className="text-xs text-default-500 text-center">
                  Période: {new Date(royaltyResult.period_start).toLocaleDateString('fr-FR')} - {new Date(royaltyResult.period_end).toLocaleDateString('fr-FR')}
                </p>

                {/* Sources breakdown */}
                {royaltyResult.sources && royaltyResult.sources.length > 0 && (
                  <div className="border-t border-divider pt-4">
                    <h3 className="text-sm font-medium text-default-700 mb-3">Détail par source</h3>
                    <div className="space-y-2">
                      {royaltyResult.sources.map((source, idx) => (
                        <div key={`${source.source}-${idx}`} className="flex items-center justify-between gap-3 py-2 border-b border-neutral-50 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              source.source === 'tunecore' ? 'bg-blue-100 text-blue-800' :
                              source.source === 'bandcamp' ? 'bg-cyan-100 text-cyan-800' :
                              source.source === 'believe_uk' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {source.source_label}
                            </span>
                            <span className="text-xs text-default-500">
                              {formatNumber(source.transaction_count)} transactions · {formatNumber(source.streams)} streams
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-foreground">{formatCurrency(source.artist_royalties, royaltyResult.currency)}</p>
                            <p className="text-xs text-default-500">sur {formatCurrency(source.gross, royaltyResult.currency)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Albums breakdown */}
                {royaltyResult.albums.length > 0 && (
                  <div className="border-t border-divider pt-4">
                    <h3 className="text-sm font-medium text-default-700 mb-3">Détail par album</h3>
                    <div className="space-y-2">
                      {royaltyResult.albums.map((album, idx) => {
                        const hasAdvance = parseFloat(album.advance_balance || '0') > 0;
                        const advanceBalance = parseFloat(album.advance_balance || '0');
                        const recoupable = parseFloat(album.recoupable || '0');
                        const netPayable = parseFloat(album.net_payable || album.artist_royalties);
                        const isIncludedInAlbum = !!album.included_in_upc;

                        // Find the parent album title if this single is included in an album
                        const parentAlbum = isIncludedInAlbum
                          ? royaltyResult.albums.find(a => a.upc === album.included_in_upc)
                          : null;

                        return (
                          <div
                            key={`${album.upc}-${idx}`}
                            className={`flex items-start justify-between gap-3 py-2 border-b border-neutral-50 last:border-0 ${isIncludedInAlbum ? 'bg-warning-50 rounded-lg px-2' : ''}`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className={`font-medium text-sm truncate ${isIncludedInAlbum ? 'text-warning-700' : 'text-foreground'}`}>
                                {album.release_title}
                              </p>
                              <p className="text-xs text-default-400 font-mono">UPC: {album.upc}</p>
                              <p className="text-xs text-default-500">
                                {album.track_count} track{album.track_count > 1 ? 's' : ''} · {formatNumber(album.streams)} streams
                              </p>
                              {isIncludedInAlbum && parentAlbum && (
                                <p className="text-xs text-warning-700 mt-1 font-medium">
                                  ⚠️ Inclus dans "{parentAlbum.release_title}"
                                </p>
                              )}
                              {hasAdvance && !isIncludedInAlbum && (
                                <p className="text-xs text-warning-600 mt-1">
                                  Avance: {formatCurrency(advanceBalance, royaltyResult.currency)} → Déduit: {formatCurrency(recoupable, royaltyResult.currency)}
                                </p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              {isIncludedInAlbum ? (
                                <>
                                  <p className="text-sm font-medium text-default-400 line-through">{formatCurrency(album.artist_royalties, royaltyResult.currency)}</p>
                                  <p className="text-xs text-warning-700">Inclus dans album</p>
                                </>
                              ) : hasAdvance ? (
                                <>
                                  <p className="text-sm font-medium text-foreground">{formatCurrency(netPayable, royaltyResult.currency)}</p>
                                  <p className="text-xs text-default-400 line-through">{formatCurrency(album.artist_royalties, royaltyResult.currency)}</p>
                                </>
                              ) : (
                                <p className="text-sm font-medium text-foreground">{formatCurrency(album.artist_royalties, royaltyResult.currency)}</p>
                              )}
                              {!isIncludedInAlbum && (
                                <p className="text-xs text-default-500">
                                  {(parseFloat(album.artist_share) * 100).toFixed(0)}% de {formatCurrency(album.gross, royaltyResult.currency)}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {royaltyResult.albums.length === 0 && (
                  <p className="text-center text-sm text-default-500 py-4">
                    Aucune donnée pour cette période
                  </p>
                )}

                {/* Export buttons */}
                {royaltyResult.albums.length > 0 && (
                  <div className="flex gap-2 pt-4 border-t border-divider">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handleExportCSV}
                      className="flex-1"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      CSV
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handlePrintPDF}
                      className="flex-1"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      PDF
                    </Button>
                  </div>
                )}

                {/* Mark as paid button */}
                {(() => {
                  const paidTotal = paidQuarters.reduce((sum, pq) => sum + pq.amount, 0);
                  const remaining = parseFloat(royaltyResult.net_payable) - paidTotal;
                  if (royaltyResult.albums.length > 0 && remaining > 0) {
                    return (
                      <div className="pt-4 border-t border-divider">
                        <Button
                          onClick={handleMarkAsPaid}
                          loading={markingAsPaid}
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Marquer comme paye ({formatCurrency(remaining.toString(), royaltyResult.currency)})
                        </Button>
                        <p className="text-xs text-default-500 text-center mt-2">
                          Cree un versement et enregistre le paiement
                        </p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Contrat Catalogue Global */}
        <div className="bg-background rounded-xl border border-divider">
          <div className="px-4 py-3 border-b border-divider">
            <h2 className="font-medium text-foreground">Contrat catalogue (défaut)</h2>
            <p className="text-sm text-default-500">S'applique à tout sauf si un contrat spécifique existe</p>
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
                    <p className="font-medium text-foreground">
                      {(parseFloat(catalogContract.artist_share) * 100).toFixed(0)}% artiste / {(parseFloat(catalogContract.label_share) * 100).toFixed(0)}% label
                    </p>
                    <p className="text-sm text-default-500">
                      Depuis {new Date(catalogContract.start_date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditContract(catalogContract)}
                    className="p-2 text-default-400 hover:text-default-600 hover:bg-default-100 rounded-lg transition-colors"
                    title="Modifier"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteContract(catalogContract.id)}
                    disabled={deletingContractId === catalogContract.id}
                    className="p-2 text-default-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Supprimer"
                  >
                    {deletingContractId === catalogContract.id ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-4 py-4">
              <p className="text-default-500 text-sm mb-3">Aucun contrat catalogue défini</p>
              <Button size="sm" onClick={() => {
                setSelectedItem(null);
                setContractParties([
                  { party_type: 'artist', artist_id: artist?.id, share_percentage: 50 },
                  { party_type: 'label', label_name: '', share_percentage: 50 }
                ]);
                setShowContractForm(true);
              }}>
                Définir un contrat catalogue
              </Button>
            </div>
          )}
        </div>

        {/* Releases avec contrats */}
        <div className="bg-background rounded-xl border border-divider">
          <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
            <div>
              <h2 className="font-medium text-foreground">Releases ({groupedReleasesArray.length})</h2>
              <p className="text-sm text-default-500">% spécifique par album/EP/single</p>
            </div>
            {releases.length > 0 && Object.keys(albumArtwork).length < releases.length && (
              <button
                onClick={fetchAllArtwork}
                className="text-sm text-green-600 hover:text-green-700 inline-flex items-center gap-1"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Charger images
              </button>
            )}
          </div>
          {loadingCatalog ? (
            <div className="px-4 py-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : releases.length === 0 ? (
            <p className="px-4 py-6 text-center text-default-500">Aucune release trouvée</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {groupedReleasesArray.map((group, index) => {
                const contract = getContractForRelease(group.upc);
                const artwork = albumArtwork[group.upc];
                const isLoadingArt = loadingArtwork[`album-${group.upc}`];
                const isExpanded = expandedReleases.has(group.key);
                const releaseTracks = getTracksForRelease(group.release_title);
                const hasMultipleSources = group.sources.length > 1;
                return (
                  <div key={group.key}>
                    <div className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        {/* Album artwork */}
                        <div className="relative flex-shrink-0">
                          {artwork?.image_url_small ? (
                            <img
                              src={artwork.image_url_small}
                              alt={group.release_title}
                              className="w-12 h-12 rounded-md object-cover"
                            />
                          ) : (
                            <button
                              onClick={() => fetchAlbumArtwork(group.upc)}
                              disabled={isLoadingArt}
                              className="w-12 h-12 rounded-md bg-default-100 flex items-center justify-center hover:bg-default-200 transition-colors"
                            >
                              {isLoadingArt ? (
                                <div className="w-4 h-4 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg className="w-5 h-5 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                </svg>
                              )}
                            </button>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <button
                            onClick={() => toggleReleaseExpanded(group.key)}
                            className="text-left w-full group"
                          >
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground truncate group-hover:text-default-700">{group.release_title}</p>
                              {hasMultipleSources && (
                                <svg
                                  className={`w-4 h-4 text-default-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </div>
                          </button>
                          {group.upc ? (
                            <p className="text-xs text-default-400 font-mono">UPC: {group.upc}</p>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {group.sources[0].physical_format && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-medium">
                                  {group.sources[0].physical_format}
                                </span>
                              )}
                              {group.sources[0].store_name && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-medium">
                                  {group.sources[0].store_name}
                                </span>
                              )}
                            </div>
                          )}
                          <p className="text-sm text-default-500">
                            {group.track_count} track{group.track_count > 1 ? 's' : ''} · {formatCurrency(group.total_gross, group.currency)}
                            {group.total_streams > 0 && (
                              <span className="text-default-400 ml-1">
                                · {group.total_streams.toLocaleString()} stream{group.total_streams > 1 ? 's' : ''}
                              </span>
                            )}
                            {hasMultipleSources && (
                              <span className="text-default-400 ml-1">
                                · {group.sources.length} source{group.sources.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {contract ? (
                            <div className="flex items-center gap-1">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                                {(parseFloat(contract.artist_share) * 100).toFixed(0)}%
                              </span>
                              <button
                                onClick={() => handleEditContract(contract)}
                                className="p-1.5 text-default-400 hover:text-default-600 hover:bg-default-100 rounded transition-colors"
                                title="Modifier"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteContract(contract.id)}
                                disabled={deletingContractId === contract.id}
                                className="p-1.5 text-default-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Supprimer"
                              >
                                {deletingContractId === contract.id ? (
                                  <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          ) : catalogContract ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-default-100 text-default-600">
                              {(parseFloat(catalogContract.artist_share) * 100).toFixed(0)}% (défaut)
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedItem({ type: 'release', id: group.upc, name: group.release_title });
                                setContractParties([
                                  { party_type: 'artist', artist_id: artist?.id, share_percentage: 50 },
                                  { party_type: 'label', label_name: '', share_percentage: 50 }
                                ]);
                                setShowContractForm(true);
                              }}
                            >
                              Définir %
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Expanded sources */}
                    {isExpanded && hasMultipleSources && (
                      <div className="bg-default-50 border-t border-divider px-4 py-2">
                        <div className="ml-15 pl-3 border-l-2 border-divider space-y-2">
                          {group.sources.map((source, sIdx) => {
                            return (
                              <div key={`${source.store_name || source.physical_format}-${sIdx}`} className="flex items-center gap-3 py-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    {source.store_name && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 font-medium text-xs">
                                        {source.store_name}
                                      </span>
                                    )}
                                    {source.physical_format && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-medium text-xs">
                                        {source.physical_format}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-default-400 mt-1">
                                    {source.track_count} track{source.track_count > 1 ? 's' : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 text-right">
                                  <div>
                                    <p className="text-sm font-medium text-default-700">{formatCurrency(source.total_gross, source.currency)}</p>
                                    {source.total_streams > 0 && (
                                      <p className="text-xs text-default-400">
                                        {formatNumber(source.total_streams)} {source.store_name && (source.store_name.toLowerCase() === 'bandcamp' || source.store_name.toLowerCase() === 'squarespace') ? 'vente' : 'stream'}{source.total_streams > 1 ? 's' : ''}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tracks avec contrats */}
        <div className="bg-background rounded-xl border border-divider">
          <div className="px-4 py-3 border-b border-divider">
            <h2 className="font-medium text-foreground">Tracks ({tracks.length})</h2>
            <p className="text-sm text-default-500">% spécifique par track (optionnel)</p>
          </div>
          {loadingCatalog ? (
            <div className="px-4 py-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-neutral-900 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : tracks.length === 0 ? (
            <p className="px-4 py-6 text-center text-default-500">Aucune track trouvée</p>
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
                const artwork = trackArtwork[track.isrc];
                const isLoadingArt = loadingArtwork[`track-${track.isrc}`];

                return (
                  <div key={`${track.isrc}-${index}`} className="px-4 py-3">
                    <div className="flex items-start gap-3">
                      {/* Track artwork */}
                      <div className="relative flex-shrink-0">
                        {artwork?.image_url_small ? (
                          <img
                            src={artwork.image_url_small}
                            alt={track.track_title}
                            className="w-10 h-10 rounded object-cover"
                          />
                        ) : (
                          <button
                            onClick={() => fetchTrackArtwork(track.isrc)}
                            disabled={isLoadingArt}
                            className="w-10 h-10 rounded bg-default-100 flex items-center justify-center hover:bg-default-200 transition-colors"
                          >
                            {isLoadingArt ? (
                              <div className="w-3 h-3 border-2 border-neutral-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{track.track_title}</p>
                        <p className="text-sm text-default-500 truncate">{track.release_title}</p>
                        <p className="text-xs text-default-400 font-mono">ISRC: {track.isrc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSpecific && trackContract ? (
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {(parseFloat(trackContract.artist_share) * 100).toFixed(0)}%
                            </span>
                            <button
                              onClick={() => handleEditContract(trackContract)}
                              className="p-1.5 text-default-400 hover:text-default-600 hover:bg-default-100 rounded transition-colors"
                              title="Modifier"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteContract(trackContract.id)}
                              disabled={deletingContractId === trackContract.id}
                              className="p-1.5 text-default-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Supprimer"
                            >
                              {deletingContractId === trackContract.id ? (
                                <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </div>
                        ) : effectiveContract ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            isReleaseLevel
                              ? 'bg-green-100 text-green-700'
                              : 'bg-default-100 text-default-600'
                          }`}>
                            {(parseFloat(effectiveContract.artist_share) * 100).toFixed(0)}%
                            {isReleaseLevel ? ' (release)' : ' (défaut)'}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setSelectedItem({ type: 'track', id: track.isrc, name: track.track_title });
                              setContractParties([
                                { party_type: 'artist', artist_id: artist?.id, share_percentage: 50 },
                                { party_type: 'label', label_name: '', share_percentage: 50 }
                              ]);
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
        <div className="bg-background rounded-xl border border-divider">
          <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
            <div>
              <h2 className="font-medium text-foreground">Avances</h2>
              <p className="text-sm text-default-500">Par catalogue, album ou track</p>
            </div>
            <Button size="sm" onClick={() => setShowAdvanceForm(true)}>Ajouter</Button>
          </div>
          {advances.length === 0 ? (
            <p className="px-4 py-6 text-center text-default-500">Aucune avance</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {advances.map((entry) => {
                const isAdvance = entry.entry_type === 'advance';
                const isDeleting = deletingAdvanceId === entry.id;
                return (
                  <div key={entry.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground">
                            {isAdvance ? 'Avance' : 'Recoupement'}
                          </p>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            entry.scope === 'catalog'
                              ? 'bg-default-100 text-default-600'
                              : entry.scope === 'release'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                          }`}>
                            {entry.scope === 'catalog' ? 'Catalogue' : entry.scope === 'release' ? 'Album' : 'Track'}
                          </span>
                          {entry.category && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              {EXPENSE_CATEGORIES.find(c => c.value === entry.category)?.label || entry.category}
                            </span>
                          )}
                        </div>
                        {entry.scope !== 'catalog' && (
                          <p className="text-xs text-default-400 font-mono">{entry.scope_id}</p>
                        )}
                        {entry.description && (
                          <p className="text-sm text-default-500">{entry.description}</p>
                        )}
                        <p className="text-xs text-default-400 mt-1">
                          {new Date(entry.effective_date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${isAdvance ? 'text-red-600' : 'text-green-600'}`}>
                          {isAdvance ? '-' : '+'}
                          {formatCurrency(entry.amount, entry.currency)}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditAdvance(entry)}
                            className="p-1.5 text-default-400 hover:text-default-600 hover:bg-default-100 rounded transition-colors"
                            title="Modifier"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteAdvance(entry.id)}
                            disabled={isDeleting}
                            className="p-1.5 text-default-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Supprimer"
                          >
                            {isDeleting ? (
                              <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Payments */}
        <div className="bg-background rounded-xl border border-divider">
          <div className="px-4 py-3 border-b border-divider flex items-center justify-between">
            <div>
              <h2 className="font-medium text-foreground">Versements</h2>
              <p className="text-sm text-default-500">Royalties payées à l'artiste</p>
            </div>
            <Button size="sm" onClick={() => setShowPaymentForm(true)}>Ajouter</Button>
          </div>
          {payments.length === 0 ? (
            <p className="px-4 py-6 text-center text-default-500">Aucun versement</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {payments.map((payment) => {
                const isDeleting = deletingPaymentId === payment.id;
                return (
                  <div key={payment.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">Versement</p>
                        {payment.description && (
                          <p className="text-sm text-default-500">{payment.description}</p>
                        )}
                        <p className="text-xs text-default-400 mt-1">
                          {new Date(payment.effective_date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-green-600">
                          {formatCurrency(payment.amount, payment.currency)}
                        </p>
                        <button
                          onClick={() => handleDeletePayment(payment.id)}
                          disabled={isDeleting}
                          className="p-1.5 text-default-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Supprimer"
                        >
                          {isDeleting ? (
                            <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Contract Form Modal */}
      {showContractForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  {selectedItem ? `Contrat: ${selectedItem.name}` : 'Contrat catalogue'}
                </h2>
                <button onClick={() => {
                  setShowContractForm(false);
                  setSelectedItem(null);
                  setContractParties([]);
                }} className="p-2 -mr-2 text-default-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              {selectedItem && (
                <div className="bg-default-50 rounded-lg p-3">
                  <p className="text-sm text-default-500">
                    {selectedItem.type === 'release' ? 'Release (UPC)' : 'Track (ISRC)'}
                  </p>
                  <p className="font-medium text-foreground">{selectedItem.name}</p>
                  <p className="text-xs text-default-400 font-mono mt-1">{selectedItem.id}</p>
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
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-default-700">
                    Parties du contrat
                  </label>
                  <button
                    onClick={() => {
                      setContractParties([...contractParties, {
                        party_type: 'artist',
                        artist_id: artist?.id,
                        share_percentage: 0
                      }]);
                    }}
                    className="text-sm text-primary hover:text-primary-600 font-medium"
                  >
                    + Ajouter une partie
                  </button>
                </div>

                {contractParties.length === 0 && (
                  <div className="bg-default-100 rounded-lg p-3 mb-3">
                    <p className="text-sm text-default-500">
                      Aucune partie définie. Ajoutez des artistes ou labels avec leurs parts respectives.
                    </p>
                  </div>
                )}

                <div className="space-y-3 mb-3">
                  {contractParties.map((party, index) => (
                    <div key={index} className="bg-default-50 rounded-lg p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <select
                          value={party.party_type}
                          onChange={(e) => {
                            const newParties = [...contractParties];
                            newParties[index].party_type = e.target.value as 'artist' | 'label';
                            if (e.target.value === 'artist') {
                              newParties[index].artist_id = artist?.id;
                              delete newParties[index].label_name;
                            } else {
                              newParties[index].label_name = '';
                              delete newParties[index].artist_id;
                            }
                            setContractParties(newParties);
                          }}
                          className="flex-1 px-3 py-2 bg-background border border-divider rounded-lg text-sm"
                        >
                          <option value="artist">Artiste</option>
                          <option value="label">Label</option>
                        </select>
                        <button
                          onClick={() => {
                            setContractParties(contractParties.filter((_, i) => i !== index));
                          }}
                          className="p-2 text-danger hover:bg-danger-50 rounded-lg"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>

                      {party.party_type === 'artist' ? (
                        <select
                          value={party.artist_id || ''}
                          onChange={(e) => {
                            const newParties = [...contractParties];
                            newParties[index].artist_id = e.target.value;
                            setContractParties(newParties);
                          }}
                          className="w-full px-3 py-2 bg-background border border-divider rounded-lg text-sm mb-2"
                        >
                          <option value="">Sélectionner un artiste</option>
                          {allArtists.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Nom du label"
                          value={party.label_name || ''}
                          onChange={(e) => {
                            const newParties = [...contractParties];
                            newParties[index].label_name = e.target.value;
                            setContractParties(newParties);
                          }}
                          className="w-full px-3 py-2 bg-background border border-divider rounded-lg text-sm mb-2"
                        />
                      )}

                      <div>
                        <label className="block text-xs text-default-500 mb-1">
                          Part: {party.share_percentage.toFixed(0)}%
                        </label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={party.share_percentage}
                          onChange={(e) => {
                            const newParties = [...contractParties];
                            newParties[index].share_percentage = parseFloat(e.target.value);
                            setContractParties(newParties);
                          }}
                          className="w-full h-2 bg-default-200 rounded-lg appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {contractParties.length > 0 && (
                  <div className={`rounded-lg p-3 ${
                    contractParties.reduce((sum, p) => sum + p.share_percentage, 0) === 100
                      ? 'bg-success-50 text-success-700'
                      : 'bg-warning-50 text-warning-700'
                  }`}>
                    <p className="text-sm font-medium">
                      Total: {contractParties.reduce((sum, p) => sum + p.share_percentage, 0).toFixed(0)}%
                      {contractParties.reduce((sum, p) => sum + p.share_percentage, 0) !== 100 && ' (doit être 100%)'}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Date de début</label>
                <Input
                  type="date"
                  value={contractStartDate}
                  onChange={(e) => setContractStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Date de fin (optionnel)</label>
                <Input
                  type="date"
                  value={contractEndDate}
                  onChange={(e) => setContractEndDate(e.target.value)}
                  placeholder="Laissez vide pour un contrat sans date de fin"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">PDF du contrat (optionnel)</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setContractFile(file);
                    }
                  }}
                  className="w-full px-3 py-2 bg-background border border-divider rounded-lg text-sm"
                />
                {contractFile && (
                  <p className="text-xs text-success mt-1">
                    📄 {contractFile.name}
                  </p>
                )}
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3">
              <Button variant="secondary" onClick={() => {
                setShowContractForm(false);
                setSelectedItem(null);
                setContractParties([]);
              }} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={selectedItem ? handleCreateContract : handleCreateCatalogContract}
                loading={creatingContract}
                disabled={
                  !contractStartDate ||
                  contractParties.length === 0 ||
                  contractParties.reduce((sum, p) => sum + p.share_percentage, 0) !== 100
                }
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
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Nouvelle avance</h2>
                <button onClick={() => {
                  setShowAdvanceForm(false);
                  setAdvanceScope('catalog');
                  setAdvanceScopeId('');
                }} className="p-2 -mr-2 text-default-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <Input
                type="number"
                label="Montant (EUR)"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="5000"
              />

              {/* Scope selector */}
              <div>
                <label className="block text-sm font-medium text-default-700 mb-2">
                  Appliquer à
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdvanceScope('catalog');
                      setAdvanceScopeId('');
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      advanceScope === 'catalog'
                        ? 'bg-neutral-900 text-white'
                        : 'bg-default-100 text-default-600 hover:bg-default-200'
                    }`}
                  >
                    Catalogue
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdvanceScope('release')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      advanceScope === 'release'
                        ? 'bg-neutral-900 text-white'
                        : 'bg-default-100 text-default-600 hover:bg-default-200'
                    }`}
                  >
                    Album
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdvanceScope('track')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      advanceScope === 'track'
                        ? 'bg-neutral-900 text-white'
                        : 'bg-default-100 text-default-600 hover:bg-default-200'
                    }`}
                  >
                    Track
                  </button>
                </div>
              </div>

              {/* Scope ID selector */}
              {advanceScope === 'release' && (
                <div>
                  <label className="block text-sm font-medium text-default-700 mb-2">
                    Sélectionner un album
                  </label>
                  <select
                    value={advanceScopeId}
                    onChange={(e) => setAdvanceScopeId(e.target.value)}
                    className="w-full px-3 py-2 border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  >
                    <option value="">-- Choisir un album --</option>
                    {releases.map((r) => (
                      <option key={r.upc} value={r.upc}>
                        {r.release_title} ({r.upc})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {advanceScope === 'track' && (
                <div>
                  <label className="block text-sm font-medium text-default-700 mb-2">
                    Sélectionner un track
                  </label>
                  <select
                    value={advanceScopeId}
                    onChange={(e) => setAdvanceScopeId(e.target.value)}
                    className="w-full px-3 py-2 border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  >
                    <option value="">-- Choisir un track --</option>
                    {tracks.map((t) => (
                      <option key={t.isrc} value={t.isrc}>
                        {t.track_title} ({t.isrc})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category selector */}
              <div>
                <label className="block text-sm font-medium text-default-700 mb-2">
                  Catégorie
                </label>
                <select
                  value={advanceCategory}
                  onChange={(e) => setAdvanceCategory(e.target.value as ExpenseCategory | '')}
                  className="w-full px-3 py-2 border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-background"
                >
                  <option value="">-- Choisir une catégorie --</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Description (optionnel)"
                value={advanceDescription}
                onChange={(e) => setAdvanceDescription(e.target.value)}
                placeholder="Avance album 2025"
              />
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3">
              <Button variant="secondary" onClick={() => {
                setShowAdvanceForm(false);
                setAdvanceScope('catalog');
                setAdvanceScopeId('');
                setAdvanceCategory('');
              }} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={handleCreateAdvance}
                loading={creatingAdvance}
                disabled={!advanceAmount || (advanceScope !== 'catalog' && !advanceScopeId)}
                className="flex-1"
              >
                Créer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Form Modal */}
      {showPaymentForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Nouveau versement</h2>
                <button onClick={() => setShowPaymentForm(false)} className="p-2 -mr-2 text-default-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <Input
                type="number"
                label="Montant (EUR)"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="1000"
              />

              <Input
                type="date"
                label="Date du versement"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />

              <Input
                label="Description (optionnel)"
                value={paymentDescription}
                onChange={(e) => setPaymentDescription(e.target.value)}
                placeholder="Versement Q3 2024"
              />
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3">
              <Button variant="secondary" onClick={() => setShowPaymentForm(false)} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={handleCreatePayment}
                loading={creatingPayment}
                disabled={!paymentAmount}
                className="flex-1"
              >
                Créer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Artwork Modal */}
      {showEditArtwork && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Photo de l'artiste</h2>
                <button onClick={() => {
                  setShowEditArtwork(false);
                  setSpotifyProfileUrl('');
                  setEditImageUrl('');
                }} className="p-2 -mr-2 text-default-500">
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

              <div className="bg-default-50 rounded-lg p-3 space-y-3">
                <p className="text-sm text-default-600">
                  Collez l'URL du profil Spotify de l'artiste pour récupérer la bonne image:
                </p>
                <Input
                  label="URL profil Spotify"
                  value={spotifyProfileUrl}
                  onChange={(e) => setSpotifyProfileUrl(e.target.value)}
                  placeholder="https://open.spotify.com/artist/..."
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
                      {spotifyProfileUrl.trim() ? 'Récupérer depuis ce profil' : 'Chercher par nom'}
                    </>
                  )}
                </button>
              </div>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-divider"></div>
                <span className="flex-shrink mx-3 text-xs text-default-400">ou</span>
                <div className="flex-grow border-t border-divider"></div>
              </div>

              <Input
                label="URL directe de l'image"
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="https://i.scdn.co/image/..."
              />
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3">
              <Button variant="secondary" onClick={() => {
                setShowEditArtwork(false);
                setSpotifyProfileUrl('');
                setEditImageUrl('');
              }} className="flex-1">
                Annuler
              </Button>
              <Button onClick={handleUpdateArtwork} className="flex-1">
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Artist Modal */}
      {showEditArtist && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Modifier l'artiste</h2>
                <button onClick={() => setShowEditArtist(false)} className="p-2 -mr-2 text-default-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <Input
                label="Nom de l'artiste"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nom de l'artiste"
              />
              <div>
                <label className="block text-sm font-medium text-default-700 mb-2">
                  Catégorie
                </label>
                <div className="flex gap-2">
                  {ARTIST_CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setEditCategory(cat.value)}
                      className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors ${
                        editCategory === cat.value
                          ? cat.value === 'signed'
                            ? 'bg-primary-100 border-primary-500 text-primary-700'
                            : 'bg-secondary-100 border-secondary-500 text-secondary-700'
                          : 'bg-default-100 border-default-200 text-default-600 hover:bg-default-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-default-700 mb-2">
                  ID Spotify (optionnel)
                </label>
                <div className="flex gap-2">
                  <Input
                    value={editSpotifyId}
                    onChange={(e) => setEditSpotifyId(e.target.value)}
                    placeholder="Ex: 0OdUWJ0sBjDrqHygGUXeCF"
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-default-500 mt-1">
                  L'ID se trouve dans l'URL du profil Spotify: open.spotify.com/artist/<strong>ID</strong>
                </p>
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3">
              <Button variant="secondary" onClick={() => setShowEditArtist(false)} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={handleUpdateArtist}
                loading={savingArtist}
                disabled={!editName.trim()}
                className="flex-1"
              >
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Advance Modal */}
      {editingAdvance && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Modifier l'avance</h2>
                <button onClick={() => setEditingAdvance(null)} className="p-2 -mr-2 text-default-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <Input
                type="number"
                label="Montant (EUR)"
                value={editAdvanceAmount}
                onChange={(e) => setEditAdvanceAmount(e.target.value)}
                placeholder="5000"
              />

              {/* Scope selector */}
              <div>
                <label className="block text-sm font-medium text-default-700 mb-2">
                  Appliquer à
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditAdvanceScope('catalog');
                      setEditAdvanceScopeId('');
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      editAdvanceScope === 'catalog'
                        ? 'bg-neutral-900 text-white'
                        : 'bg-default-100 text-default-600 hover:bg-default-200'
                    }`}
                  >
                    Catalogue
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditAdvanceScope('release')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      editAdvanceScope === 'release'
                        ? 'bg-neutral-900 text-white'
                        : 'bg-default-100 text-default-600 hover:bg-default-200'
                    }`}
                  >
                    Album
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditAdvanceScope('track')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      editAdvanceScope === 'track'
                        ? 'bg-neutral-900 text-white'
                        : 'bg-default-100 text-default-600 hover:bg-default-200'
                    }`}
                  >
                    Track
                  </button>
                </div>
              </div>

              {/* Scope ID selector */}
              {editAdvanceScope === 'release' && (
                <div>
                  <label className="block text-sm font-medium text-default-700 mb-2">
                    Sélectionner un album
                  </label>
                  <select
                    value={editAdvanceScopeId}
                    onChange={(e) => setEditAdvanceScopeId(e.target.value)}
                    className="w-full px-3 py-2 border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  >
                    <option value="">-- Choisir un album --</option>
                    {releases.map((r) => (
                      <option key={r.upc} value={r.upc}>
                        {r.release_title} ({r.upc})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editAdvanceScope === 'track' && (
                <div>
                  <label className="block text-sm font-medium text-default-700 mb-2">
                    Sélectionner un track
                  </label>
                  <select
                    value={editAdvanceScopeId}
                    onChange={(e) => setEditAdvanceScopeId(e.target.value)}
                    className="w-full px-3 py-2 border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  >
                    <option value="">-- Choisir un track --</option>
                    {tracks.map((t) => (
                      <option key={t.isrc} value={t.isrc}>
                        {t.track_title} ({t.isrc})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category selector */}
              <div>
                <label className="block text-sm font-medium text-default-700 mb-2">
                  Catégorie
                </label>
                <select
                  value={editAdvanceCategory}
                  onChange={(e) => setEditAdvanceCategory(e.target.value as ExpenseCategory | '')}
                  className="w-full px-3 py-2 border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-background"
                >
                  <option value="">-- Choisir une catégorie --</option>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="Description (optionnel)"
                value={editAdvanceDescription}
                onChange={(e) => setEditAdvanceDescription(e.target.value)}
                placeholder="Avance album 2025"
              />
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3">
              <Button variant="secondary" onClick={() => setEditingAdvance(null)} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={handleUpdateAdvance}
                loading={savingAdvance}
                disabled={!editAdvanceAmount || (editAdvanceScope !== 'catalog' && !editAdvanceScopeId)}
                className="flex-1"
              >
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contract Modal */}
      {editingContract && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Modifier le contrat</h2>
                <button onClick={() => setEditingContract(null)} className="p-2 -mr-2 text-default-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="bg-default-50 rounded-lg p-3">
                <p className="text-sm text-default-500">
                  {editingContract.scope === 'catalog' ? 'Catalogue' : editingContract.scope === 'release' ? 'Release (UPC)' : 'Track (ISRC)'}
                </p>
                <p className="font-medium text-foreground">
                  {editingContract.scope === 'catalog' ? 'Tout le catalogue' : editingContract.scope_id}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-default-700 mb-2">
                  Part artiste: {(parseFloat(editContractShare) * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={editContractShare}
                  onChange={(e) => setEditContractShare(e.target.value)}
                  className="w-full h-2 bg-default-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-sm text-default-500 mt-2">
                  <span>Artiste: {(parseFloat(editContractShare) * 100).toFixed(0)}%</span>
                  <span>Label: {((1 - parseFloat(editContractShare)) * 100).toFixed(0)}%</span>
                </div>
              </div>

              <Input
                type="date"
                label="Date de début"
                value={editContractStartDate}
                onChange={(e) => setEditContractStartDate(e.target.value)}
              />
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3">
              <Button variant="secondary" onClick={() => setEditingContract(null)} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={handleUpdateContract}
                loading={savingContract}
                disabled={!editContractStartDate}
                className="flex-1"
              >
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && artist && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-background w-full max-w-md rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-divider bg-red-50">
              <h2 className="text-lg font-semibold text-red-800">Supprimer l&apos;artiste</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                <p className="text-red-800 font-medium text-center mb-2">
                  ATTENTION: Cette action est IRREVERSIBLE
                </p>
                <p className="text-red-700 text-sm text-center">
                  Toutes les donnees associees seront supprimees:
                </p>
                <ul className="text-red-600 text-sm mt-2 space-y-1 list-disc list-inside">
                  <li>Contrats ({contracts.length})</li>
                  <li>Avances ({advances.length})</li>
                  <li>Versements ({payments.length})</li>
                  <li>Liens avec les tracks</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-default-700 mb-2">
                  Pour confirmer, tapez le nom de l&apos;artiste:
                </label>
                <p className="text-lg font-bold text-foreground mb-2 bg-default-100 px-3 py-2 rounded-lg">
                  {artist.name}
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Tapez le nom exactement"
                  className="w-full px-4 py-3 border-2 border-red-300 rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                  }}
                  className="flex-1"
                  disabled={deleting}
                >
                  Annuler
                </Button>
                <button
                  onClick={handleDeleteArtist}
                  disabled={deleteConfirmText !== artist.name || deleting}
                  className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-colors ${
                    deleteConfirmText === artist.name
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-red-200 text-red-400 cursor-not-allowed'
                  }`}
                >
                  {deleting ? 'Suppression...' : 'Supprimer definitivement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone - at the very bottom */}
      {artist && (
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="border-2 border-red-200 rounded-xl bg-red-50 p-4">
            <h3 className="text-red-800 font-semibold mb-2">Zone de danger</h3>
            <p className="text-red-600 text-sm mb-4">
              La suppression d&apos;un artiste est irreversible. Toutes les donnees associees seront perdues.
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
            >
              Supprimer cet artiste
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
