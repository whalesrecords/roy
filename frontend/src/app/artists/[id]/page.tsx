'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';
import Input from '@/components/ui/Input';
import { Artist, Contract, AdvanceEntry, EXPENSE_CATEGORIES, ExpenseCategory, ArtistCategory, ARTIST_CATEGORIES } from '@/lib/types';
import { WHALES_LOGO_BASE64 } from '@/lib/whales-logo';
import CatalogSection from '@/components/artist/CatalogSection';
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
  updatePayment,
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
  createStatement,
  getArtistStatements,
  generateAccessCode,
  createArtistAuth,
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

// Helper to calculate shares from contract parties
// If forArtistId is provided, returns only that artist's individual share (not total of all artists)
function getContractShares(contract: Contract, forArtistId?: string): { artistShare: number; labelShare: number } {
  if (!contract.parties || contract.parties.length === 0) {
    // Fallback to old fields if parties not available
    return {
      artistShare: parseFloat(contract.artist_share || '0'),
      labelShare: parseFloat(contract.label_share || '0'),
    };
  }
  let artistShare: number;
  if (forArtistId) {
    // Find this specific artist's share
    const thisParty = contract.parties.find(
      p => p.party_type === 'artist' && p.artist_id === forArtistId
    );
    artistShare = thisParty ? parseFloat(thisParty.share_percentage || '0') : 0;
  } else {
    // Total of all artist parties
    artistShare = contract.parties
      .filter(p => p.party_type === 'artist')
      .reduce((sum, p) => sum + parseFloat(p.share_percentage || '0'), 0);
  }
  const labelShare = contract.parties
    .filter(p => p.party_type === 'label')
    .reduce((sum, p) => sum + parseFloat(p.share_percentage || '0'), 0);
  return { artistShare, labelShare };
}

export default function ArtistDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { displayName, user } = useAuth();
  // Ensure we always have a name to display in PDFs
  const generatedByName = displayName || user?.email || 'Unknown';
  const artistId = params.id as string;

  const [artist, setArtist] = useState<Artist | null>(null);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [advances, setAdvances] = useState<AdvanceEntry[]>([]);
  const [balance, setBalance] = useState<string>('0');
  const [balanceCurrency, setBalanceCurrency] = useState<string>('EUR');
  const [totalAdvances, setTotalAdvances] = useState<string>('0');
  const [totalRecouped, setTotalRecouped] = useState<string>('0');
  const [totalPayments, setTotalPayments] = useState<string>('0');
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
  const [advanceDate, setAdvanceDate] = useState('');
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
  const [publishingStatement, setPublishingStatement] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [paidQuarters, setPaidQuarters] = useState<{ quarter: string; amount: number; date: string }[]>([]);

  // Create auth account
  const [showCreateAuthModal, setShowCreateAuthModal] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [creatingAuth, setCreatingAuth] = useState(false);

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
  const [editAdvanceDate, setEditAdvanceDate] = useState('');
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
  const [editingPayment, setEditingPayment] = useState<AdvanceEntry | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState('');
  const [editPaymentDescription, setEditPaymentDescription] = useState('');
  const [editPaymentDate, setEditPaymentDate] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Edit contract
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [editContractShare, setEditContractShare] = useState('0.5');
  const [editContractStartDate, setEditContractStartDate] = useState('');
  const [editContractParties, setEditContractParties] = useState<Array<{id?: string; party_type: 'artist' | 'label'; artist_id?: string; label_name?: string; share_percentage: number}>>([]);
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
      setTotalAdvances(balanceData.total_advances || '0');
      setTotalRecouped(balanceData.total_recouped || '0');
      setTotalPayments(balanceData.total_payments || '0');
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
    if (Math.abs(totalShare - 100) > 0.01) {
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
          share_percentage: String(p.share_percentage / 100), // Convert to decimal string
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
    if (Math.abs(totalShare - 100) > 0.01) {
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
          share_percentage: String(p.share_percentage / 100), // Convert to decimal string
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
        advanceCategory || undefined,
        advanceDate || undefined
      );
      setShowAdvanceForm(false);
      setAdvanceAmount('');
      setAdvanceDescription('');
      setAdvanceScope('catalog');
      setAdvanceScopeId('');
      setAdvanceCategory('');
      setAdvanceDate('');
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

  const handleEditPayment = (payment: AdvanceEntry) => {
    setEditingPayment(payment);
    setEditPaymentAmount(payment.amount);
    setEditPaymentDescription(payment.description || '');
    setEditPaymentDate(payment.effective_date.split('T')[0]);
  };

  const handleUpdatePayment = async () => {
    if (!editingPayment) return;
    setSavingPayment(true);
    try {
      await updatePayment(
        artistId,
        editingPayment.id,
        parseFloat(editPaymentAmount),
        editPaymentDescription,
        editPaymentDate
      );
      setEditingPayment(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de mise à jour');
    } finally {
      setSavingPayment(false);
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
    setEditAdvanceDate(advance.effective_date || '');
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
        editAdvanceCategory || undefined,
        editAdvanceDate || undefined
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
    const { artistShare } = getContractShares(contract, artistId);
    setEditContractShare(artistShare > 0 ? String(artistShare) : '0.5');
    setEditContractStartDate(contract.start_date);
    // Load existing parties
    if (contract.parties && contract.parties.length > 0) {
      setEditContractParties(contract.parties.map(p => ({
        id: p.id,
        party_type: p.party_type as 'artist' | 'label',
        artist_id: p.artist_id,
        label_name: p.label_name,
        share_percentage: parseFloat(String(p.share_percentage)) * 100,
      })));
    } else {
      setEditContractParties([
        { party_type: 'artist', artist_id: artistId, share_percentage: artistShare * 100 },
        { party_type: 'label', label_name: 'Whales Records', share_percentage: (1 - artistShare) * 100 },
      ]);
    }
  };

  const handleUpdateContract = async () => {
    if (!editingContract || !editingContract.id || !editContractStartDate) return;
    const totalShare = editContractParties.reduce((sum, p) => sum + p.share_percentage, 0);
    if (Math.abs(totalShare - 100) > 0.01) {
      setError('Le total des parts doit être égal à 100%');
      return;
    }
    setSavingContract(true);
    try {
      await updateContract(editingContract.id, {
        start_date: editContractStartDate,
        parties: editContractParties.map(p => ({
          party_type: p.party_type,
          artist_id: p.artist_id,
          label_name: p.label_name,
          share_percentage: String(p.share_percentage / 100),
        })),
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
      await deleteContract(contractId);
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
      // Find the statement for this period to mark it as paid
      let statementId: string | undefined;
      try {
        const { statements } = await getArtistStatements(artistId);
        // Find statement matching the period that is finalized but not paid
        const matchingStmt = statements.find(stmt =>
          stmt.period_start === royaltyResult.period_start &&
          stmt.period_end === royaltyResult.period_end &&
          stmt.status === 'finalized'
        );
        if (matchingStmt) {
          statementId = matchingStmt.id;
        }
      } catch (err) {
        console.warn('Could not find statement to mark as paid:', err);
      }

      // Create payment entry with period description and statement_id
      await createPayment(
        artistId,
        remaining, // Use remaining amount after paid quarters
        'EUR',
        `Paiement ${period.label.split(' (')[0]}`, // "Q3 2024" or "2024"
        new Date().toISOString().split('T')[0],
        statementId
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

  const handlePublishStatement = async () => {
    if (!royaltyResult || !artist) return;

    const period = PERIODS.find(p => p.value === selectedPeriod);
    if (!period) return;

    setPublishingStatement(true);
    try {
      await createStatement(artistId, {
        artist_id: artistId,
        period_start: royaltyResult.period_start,
        period_end: royaltyResult.period_end,
        currency: royaltyResult.currency,
        gross_revenue: royaltyResult.total_gross,
        artist_royalties: royaltyResult.total_artist_royalties,
        label_royalties: royaltyResult.total_label_royalties,
        advance_balance: royaltyResult.advance_balance,
        recouped: royaltyResult.recoupable,
        net_payable: royaltyResult.net_payable,
        transaction_count: royaltyResult.albums.reduce((sum, a) => sum + a.track_count, 0),
        finalize: true,
      });
      alert('Relevé publié sur l\'Espace Artiste !');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la publication');
    } finally {
      setPublishingStatement(false);
    }
  };

  const handleGenerateAccessCode = async () => {
    if (!artist) return;

    setGeneratingCode(true);
    try {
      const result = await generateAccessCode(artistId);
      // Refresh artist data to get the new access code
      setArtist({ ...artist, access_code: result.access_code });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la generation du code');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCreateAuth = async () => {
    if (!artist || !authEmail || !authPassword) return;

    setCreatingAuth(true);
    try {
      const result = await createArtistAuth(artistId, authEmail, authPassword);
      // Update artist with new email and auth_user_id
      setArtist({ ...artist, email: result.email, auth_user_id: result.auth_user_id });
      setShowCreateAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la creation du compte');
    } finally {
      setCreatingAuth(false);
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
        `${formatPercent(parseFloat(album.artist_share || '0'))}%`,
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
          body { font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; background: white; }
          .label-header { position: absolute; top: 40px; right: 40px; text-align: right; }
          .label-logo { max-width: 80px; max-height: 50px; object-fit: contain; margin-bottom: 8px; }
          .label-info { font-size: 11px; color: #4b5563; line-height: 1.5; }
          .label-name { font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 4px; }
          .label-info .legal { color: #6b7280; font-size: 10px; margin-top: 4px; }
          .main-content { margin-top: 120px; }
          h1 { font-size: 24px; margin-bottom: 8px; color: #111827; font-weight: 700; }
          h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; border-bottom: 2px solid #5584ff; padding-bottom: 8px; color: #111827; font-weight: 600; }
          .period { color: #6b7280; font-size: 14px; margin-bottom: 24px; padding: 8px 16px; background: #f3f4f6; border-radius: 20px; display: inline-block; }
          .summary { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px; }
          .summary-item { background: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e5e7eb; }
          .summary-item label { font-size: 12px; color: #6b7280; display: block; margin-bottom: 4px; }
          .summary-item value { font-size: 18px; font-weight: 600; color: #111827; }
          .highlight { background: linear-gradient(135deg, #5584ff10 0%, #22c55e10 100%) !important; border: 1px solid #22c55e30 !important; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; }
          th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background: #f8fafc; font-weight: 600; color: #374151; }
          .mono { font-family: monospace; font-size: 12px; color: #6b7280; }
          .right { text-align: right; }
          .footer {
            margin-top: 30px;
            padding: 20px 0 10px 0;
            border-top: 2px solid #e5e7eb;
            text-align: center;
            page-break-inside: avoid;
          }
          .footer-logo { max-width: 150px; max-height: 60px; margin: 0 auto 10px; display: block; opacity: 0.7; }
          .footer-text { font-size: 10px; color: #9ca3af; margin-top: 5px; font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          @page {
            margin: 20mm 15mm 30mm 15mm;
            @bottom-center {
              content: "Page " counter(page) " / " counter(pages);
              font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
              font-size: 10px;
              color: #6b7280;
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
            <tr style="font-weight: bold; background: linear-gradient(135deg, #22c55e10 0%, #22c55e15 100%);">
              <td colspan="2">Remaining Balance</td>
              <td class="right" style="color: #22c55e; font-size: 18px;">${formatCurrency((parseFloat(royaltyResult.net_payable) - paidQuarters.reduce((sum, pq) => sum + pq.amount, 0)).toString())}</td>
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
                <td class="right">${formatPercent(parseFloat(album.artist_share || '0'))}%</td>
                <td class="right">${(hasAdvance || isIncludedInAlbum) ? `<span style="text-decoration: line-through; color: #999;">${formatCurrency(album.artist_royalties)}</span>` : formatCurrency(album.artist_royalties)}</td>
                <td class="right" style="color: ${hasAdvance ? '#b45309' : '#999'};">${hasAdvance ? `-${formatCurrency(recoupable.toString())}` : '-'}</td>
                <td class="right" style="font-weight: ${hasAdvance ? 'bold' : 'normal'};">${isIncludedInAlbum ? '-' : formatCurrency(netPayable.toString())}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>

        <div class="footer">
          <img src="${WHALES_LOGO_BASE64}" alt="Whales Logo" class="footer-logo" />
          <div class="footer-text">Generated on ${formatDate(new Date())} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} by ${generatedByName}
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

  // Expenses PDF with advances history
  const handlePrintExpensesPDF = async () => {
    if (!royaltyResult || !artist) return;

    // Fetch label settings for the header
    let labelSettings: LabelSettings | null = null;
    try {
      labelSettings = await getLabelSettings();
    } catch (err) {
      console.error('Error fetching label settings:', err);
    }

    // Fetch advances
    let advancesList: AdvanceEntry[] = [];
    try {
      const allAdvances = await getAdvances(artist.id);
      advancesList = allAdvances.filter(a => a.entry_type === 'advance');
    } catch (err) {
      console.error('Error fetching advances:', err);
    }

    if (advancesList.length === 0) {
      alert('No advances to display');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

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

    // Group advances by category
    const advancesByCategory: Record<string, { total: number; items: AdvanceEntry[] }> = {};
    for (const adv of advancesList) {
      const cat = adv.category || 'general';
      if (!advancesByCategory[cat]) {
        advancesByCategory[cat] = { total: 0, items: [] };
      }
      advancesByCategory[cat].total += parseFloat(adv.amount);
      advancesByCategory[cat].items.push(adv);
    }

    const categoryLabels: Record<string, string> = {
      general: 'General',
      recording: 'Recording',
      mixing: 'Mixing',
      mastering: 'Mastering',
      artwork: 'Artwork',
      photos: 'Photos',
      video: 'Video',
      pr: 'PR / Press',
      advertising: 'Advertising',
      distribution: 'Distribution',
      cd: 'CD Production',
      vinyl: 'Vinyl Production',
      goodies: 'Goodies / Merch',
      other: 'Other',
    };

    // Build label header HTML
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
          ${labelSettings.siret ? `<div class="legal">SIRET: ${labelSettings.siret}</div>` : ''}
          ${labelSettings.vat_number ? `<div class="legal">TVA: ${labelSettings.vat_number}</div>` : ''}
        </div>
      </div>
    ` : '';

    const totalAdvances = advancesList.reduce((sum, a) => sum + parseFloat(a.amount), 0);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Expenses Statement - ${artist.name}</title>
        <style>
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; background: white; }
          .label-header { position: absolute; top: 40px; right: 40px; text-align: right; }
          .label-logo { max-width: 80px; max-height: 50px; object-fit: contain; margin-bottom: 8px; }
          .label-info { font-size: 11px; color: #4b5563; line-height: 1.5; }
          .label-name { font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 4px; }
          .label-info .legal { color: #6b7280; font-size: 10px; margin-top: 4px; }
          .main-content { margin-top: 120px; }
          h1 { font-size: 24px; margin-bottom: 8px; color: #111827; font-weight: 700; }
          h2 { font-size: 18px; margin-top: 24px; margin-bottom: 12px; border-bottom: 2px solid #f59e0b; padding-bottom: 8px; color: #111827; font-weight: 600; }
          .period { color: #6b7280; font-size: 14px; margin-bottom: 24px; padding: 8px 16px; background: #f3f4f6; border-radius: 20px; display: inline-block; }
          .summary-box { background: linear-gradient(135deg, #f59e0b10 0%, #f59e0b15 100%); padding: 24px; border-radius: 16px; margin-bottom: 24px; text-align: center; border: 1px solid #f59e0b25; }
          .summary-box label { font-size: 14px; color: #92400e; display: block; margin-bottom: 8px; }
          .summary-box value { font-size: 28px; font-weight: 700; color: #d97706; }
          .category-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
          .category-item { background: #f8fafc; padding: 14px; border-radius: 12px; text-align: center; border: 1px solid #e5e7eb; }
          .category-item label { font-size: 11px; color: #6b7280; display: block; margin-bottom: 4px; }
          .category-item value { font-size: 16px; font-weight: 600; color: #d97706; }
          table { width: 100%; border-collapse: collapse; font-size: 13px; }
          th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #e5e7eb; }
          th { background: #f8fafc; font-weight: 600; color: #374151; }
          .mono { font-family: monospace; font-size: 11px; color: #6b7280; }
          .right { text-align: right; }
          .footer { margin-top: 30px; padding: 20px 0 10px 0; border-top: 2px solid #e5e7eb; text-align: center; }
          .footer-logo { max-width: 150px; max-height: 60px; margin: 0 auto 10px; display: block; opacity: 0.7; }
          .footer-text { font-size: 10px; color: #9ca3af; }
          @media print { body { padding: 20px; } .label-header { top: 20px; right: 20px; } }
        </style>
      </head>
      <body>
        ${labelHeaderHtml}

        <div class="main-content">
        <h1>Expenses Statement</h1>
        <p style="font-size: 18px; margin-bottom: 4px;">${artist.name}</p>
        <p class="period">As of ${formatDate(new Date())}</p>

        <div class="summary-box">
          <label>Total Advances & Expenses</label>
          <value>${formatCurrency(totalAdvances.toString())}</value>
        </div>

        <h2>By Category</h2>
        <div class="category-summary">
          ${Object.entries(advancesByCategory).map(([cat, data]) => `
            <div class="category-item">
              <label>${categoryLabels[cat] || cat}</label>
              <value>${formatCurrency(data.total.toString())}</value>
            </div>
          `).join('')}
        </div>

        <h2>Detailed History</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Scope</th>
              <th>Description</th>
              <th class="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${advancesList.map(advance => {
              const categoryLabel = categoryLabels[advance.category || 'general'] || advance.category || 'General';
              let scopeLabel = 'Catalog';
              if (advance.scope === 'release' && advance.scope_id) {
                const album = royaltyResult.albums.find(a => a.upc === advance.scope_id);
                scopeLabel = album ? album.release_title : `UPC: ${advance.scope_id}`;
              } else if (advance.scope === 'track' && advance.scope_id) {
                scopeLabel = `Track: ${advance.scope_id}`;
              }
              return `
              <tr>
                <td>${formatDate(new Date(advance.effective_date))}</td>
                <td>${categoryLabel}</td>
                <td>${scopeLabel}</td>
                <td>${advance.description || '-'}</td>
                <td class="right" style="color: #b45309; font-weight: 600;">${formatCurrency(advance.amount)}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>

        <div class="footer">
          <img src="${WHALES_LOGO_BASE64}" alt="Whales Logo" class="footer-logo" />
          <div class="footer-text">Generated on ${formatDate(new Date())} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} by ${generatedByName}
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

  // Simplified PDF for artists with mailto link
  const handlePrintArtistPDF = async () => {
    if (!royaltyResult || !artist) return;

    // Fetch label settings for the header
    let labelSettings: LabelSettings | null = null;
    try {
      labelSettings = await getLabelSettings();
    } catch (err) {
      console.error('Error fetching label settings:', err);
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

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

    const periodLabel = `${formatDate(new Date(royaltyResult.period_start))} - ${formatDate(new Date(royaltyResult.period_end))}`;
    const netPayable = parseFloat(royaltyResult.net_payable);

    // Mailto link
    const mailtoSubject = encodeURIComponent(`Royalty payment request ${periodLabel} for ${artist.name}`);
    const mailtoBody = encodeURIComponent(
      `Artist: ${artist.name}\n` +
      `Period: ${periodLabel}\n` +
      `Amount: ${formatCurrency(royaltyResult.net_payable)}\n\n` +
      `Please provide your payment details:\n` +
      `- Full name:\n` +
      `- Bank name:\n` +
      `- IBAN:\n` +
      `- BIC/SWIFT:\n` +
      `- Address:\n\n` +
      `Note: If we already have your banking information on file, simply reply to confirm and we will process the payment to your existing account.`
    );
    const mailtoLink = `mailto:royalties@whalesrecords.com?subject=${mailtoSubject}&body=${mailtoBody}`;

    // Build label header HTML
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
          ${labelSettings.siret ? `<div class="legal">SIRET: ${labelSettings.siret}</div>` : ''}
          ${labelSettings.vat_number ? `<div class="legal">TVA: ${labelSettings.vat_number}</div>` : ''}
        </div>
      </div>
    ` : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Artist Statement - ${artist.name}</title>
        <style>
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; background: white; }
          .label-header { position: absolute; top: 40px; right: 40px; text-align: right; }
          .label-logo { max-width: 80px; max-height: 50px; object-fit: contain; margin-bottom: 8px; }
          .label-info { font-size: 11px; color: #4b5563; line-height: 1.5; }
          .label-name { font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 4px; }
          .label-info .legal { color: #6b7280; font-size: 10px; margin-top: 4px; }
          .main-content { margin-top: 100px; }
          h1 { font-size: 28px; margin-bottom: 8px; color: #111827; font-weight: 700; }
          .artist-name { font-size: 22px; color: #5584ff; font-weight: 600; margin-bottom: 4px; }
          .period { color: #6b7280; font-size: 14px; margin-bottom: 32px; padding: 8px 16px; background: #f3f4f6; border-radius: 20px; display: inline-block; }
          .summary-table { width: 100%; border-collapse: collapse; margin-bottom: 32px; background: #fafafa; border-radius: 16px; overflow: hidden; }
          .summary-table td { padding: 16px 20px; border-bottom: 1px solid #e5e7eb; }
          .summary-table .label { color: #6b7280; font-size: 14px; }
          .summary-table .value { text-align: right; font-size: 16px; font-weight: 600; color: #111827; }
          .net-row td { border-bottom: none; padding-top: 20px; background: linear-gradient(135deg, #5584ff10 0%, #5584ff05 100%); }
          .net-row .label { font-size: 18px; font-weight: 700; color: #111827; }
          .net-row .value { font-size: 26px; font-weight: 700; color: #22c55e; }
          .contact-section { margin-top: 40px; padding: 28px; background: linear-gradient(135deg, #5584ff08 0%, #5584ff15 100%); border-radius: 20px; text-align: center; border: 1px solid #5584ff20; }
          .contact-section h3 { margin: 0 0 8px 0; font-size: 18px; color: #111827; font-weight: 600; }
          .contact-section p { margin: 0 0 20px 0; font-size: 14px; color: #6b7280; }
          .contact-btn { display: inline-block; padding: 14px 36px; background: #5584ff; color: white; text-decoration: none; border-radius: 50px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 14px rgba(85, 132, 255, 0.35); }
          .contact-btn:hover { background: #4070e8; }
          .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; }
          .footer-logo { max-width: 100px; max-height: 40px; margin: 0 auto 8px; display: block; opacity: 0.7; }
          .footer-text { font-size: 10px; color: #9ca3af; }
          @media print {
            .contact-btn { background: #5584ff !important; -webkit-print-color-adjust: exact; }
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        ${labelHeaderHtml}

        <div class="main-content">
          <h1>Royalty Statement</h1>
          <p class="artist-name">${artist.name}</p>
          <p class="period">Period: ${periodLabel}</p>

          <table class="summary-table">
            <tr>
              <td class="label">Gross Revenue</td>
              <td class="value">${formatCurrency(royaltyResult.total_gross)}</td>
            </tr>
            <tr>
              <td class="label">Your Royalties</td>
              <td class="value">${formatCurrency(royaltyResult.total_artist_royalties)}</td>
            </tr>
            <tr>
              <td class="label">Advances Recouped</td>
              <td class="value" style="color: #b45309;">-${formatCurrency(royaltyResult.recoupable)}</td>
            </tr>
            <tr class="net-row">
              <td class="label">Net Payable to You</td>
              <td class="value">${formatCurrency(royaltyResult.net_payable)}</td>
            </tr>
          </table>

          ${netPayable > 0 ? `
          <div class="contact-section">
            <h3>Ready to receive your payment?</h3>
            <p>Click below to send us your payment details</p>
            <a href="${mailtoLink}" class="contact-btn">Request Payment</a>
          </div>
          ` : `
          <div class="contact-section" style="background: linear-gradient(135deg, #6b728010 0%, #6b728015 100%); border-color: #6b728020;">
            <h3>No payment due at this time</h3>
            <p>Your advances are still being recouped. Contact us if you have questions.</p>
            <a href="mailto:royalties@whalesrecords.com" class="contact-btn" style="background: #6b7280; box-shadow: 0 4px 14px rgba(107, 114, 128, 0.25);">Contact Us</a>
          </div>
          `}

          <div class="footer">
            <img src="${WHALES_LOGO_BASE64}" alt="Whales Logo" class="footer-logo" />
            <div class="footer-text">Generated on ${formatDate(new Date())} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} by ${generatedByName}
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

  // Format percentage: show decimals only if needed (50% vs 33.33%)
  const formatPercent = (decimal: number) => {
    const pct = decimal * 100;
    return pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2).replace(/0+$/, '');
  };

  // Releases are already grouped by release_title from the backend
  // Each release has a sources[] array with per-source breakdown
  const groupedReleasesArray = releases.map((release) => ({
    key: release.upc || release.release_title,
    release_title: release.release_title,
    upc: release.upc,
    currency: release.currency,
    total_gross: release.total_gross,
    total_streams: release.total_streams,
    track_count: release.track_count,
    sources: release.sources || [],
  }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-danger mb-4">{error || 'Artiste non trouvé'}</p>
          <Link href="/artists">
            <button className="px-5 py-2.5 bg-content2 text-foreground font-medium rounded-full hover:bg-content3 transition-colors border-2 border-default-200">Retour</button>
          </Link>
        </div>
      </div>
    );
  }

  const catalogContract = getCatalogContract();

  return (
    <div className="min-h-screen">
      <header className="bg-background/80 backdrop-blur-md border-b border-divider sticky top-14 z-30">
        <div className="max-w-2xl mx-auto px-6 py-5">
          <Link href="/artists" className="text-sm text-secondary-500 hover:text-primary mb-3 inline-flex items-center gap-1 transition-colors">
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
                  className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/20"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                <h1 className="text-2xl font-bold text-foreground">{artist.name}</h1>
                <button
                  onClick={() => {
                    setEditName(artist.name);
                    setEditSpotifyId(artist.spotify_id || '');
                    setEditCategory(artist.category || 'signed');
                    setShowEditArtist(true);
                  }}
                  className="p-1.5 text-secondary-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                  title="Modifier l'artiste"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-secondary-500">
                  {releases.length} release{releases.length > 1 ? 's' : ''} · {tracks.length} track{tracks.length > 1 ? 's' : ''}
                </p>
                {artist.category === 'collaborator' && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
                    Collaborateur
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-secondary-400">
                <span
                  className="cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => navigator.clipboard.writeText(artist.id)}
                  title="Cliquer pour copier"
                >
                  ID: {artist.id.slice(0, 8)}...
                </span>
                {artist.spotify_id && (
                  <span
                    className="cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => navigator.clipboard.writeText(artist.spotify_id!)}
                    title="Cliquer pour copier"
                  >
                    Spotify: {artist.spotify_id}
                  </span>
                )}
                {artist.external_id && (
                  <span
                    className="cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => navigator.clipboard.writeText(artist.external_id!)}
                    title="Cliquer pour copier"
                  >
                    External: {artist.external_id}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {artist.spotify_id && (
                  <a
                    href={`https://open.spotify.com/artist/${artist.spotify_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-success hover:text-success-700"
                  >
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                    Profil Spotify
                  </a>
                )}
                {/* Removed: "Espace Artiste" link and "Créer compte Espace Artiste" button - no longer needed */}
              </div>
              {!artist.image_url && (
                <button
                  onClick={handleFetchArtwork}
                  disabled={fetchingArtwork}
                  className="mt-2 text-sm text-success hover:text-success-700 inline-flex items-center gap-1"
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

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Social Media Links */}
        {(artist.instagram_url || artist.twitter_url || artist.facebook_url || artist.tiktok_url || artist.youtube_url) && (
          <div className="bg-background rounded-2xl border border-divider p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-secondary-500 mb-3">Réseaux sociaux</h3>
            <div className="flex flex-wrap gap-2">
              {artist.instagram_url && (
                <a
                  href={artist.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-content2 hover:bg-content3 rounded-xl text-sm text-foreground transition-colors"
                  title="Instagram"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  Instagram
                </a>
              )}
              {artist.twitter_url && (
                <a
                  href={artist.twitter_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-content2 hover:bg-content3 rounded-xl text-sm text-foreground transition-colors"
                  title="Twitter / X"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Twitter / X
                </a>
              )}
              {artist.facebook_url && (
                <a
                  href={artist.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-content2 hover:bg-content3 rounded-xl text-sm text-foreground transition-colors"
                  title="Facebook"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </a>
              )}
              {artist.tiktok_url && (
                <a
                  href={artist.tiktok_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-content2 hover:bg-content3 rounded-xl text-sm text-foreground transition-colors"
                  title="TikTok"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                  </svg>
                  TikTok
                </a>
              )}
              {artist.youtube_url && (
                <a
                  href={artist.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 bg-content2 hover:bg-content3 rounded-xl text-sm text-foreground transition-colors"
                  title="YouTube"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
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

        {/* Calcul Royalties */}
        <div className="bg-background rounded-2xl border border-divider shadow-sm">
          <div className="px-5 py-4 border-b border-divider">
            <h2 className="font-semibold text-foreground">Calcul des royalties</h2>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="flex-1 h-10 px-4 bg-background border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
              >
                {PERIODS.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </select>
              <button
                onClick={handleCalculateRoyalties}
                disabled={calculatingRoyalties}
                className="px-5 py-2.5 bg-primary text-white font-medium text-sm rounded-full shadow-lg shadow-primary/30 hover:shadow-xl disabled:opacity-50 transition-all"
              >
                {calculatingRoyalties ? 'Calcul...' : 'Calculer'}
              </button>
            </div>

            {royaltyError && (
              <div className="bg-danger-50 text-danger px-4 py-3 rounded-xl text-sm mb-4">
                {royaltyError}
              </div>
            )}

            {royaltyResult && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-content2 rounded-xl p-3">
                    <p className="text-xs text-secondary-500">Brut total</p>
                    <p className="text-lg font-semibold text-foreground">
                      {formatCurrency(royaltyResult.total_gross, royaltyResult.currency)}
                    </p>
                  </div>
                  <div className="bg-content2 rounded-xl p-3">
                    <p className="text-xs text-secondary-500">Royalties artiste</p>
                    <p className="text-lg font-semibold text-foreground">
                      {formatCurrency(royaltyResult.total_artist_royalties, royaltyResult.currency)}
                    </p>
                  </div>
                </div>

                {/* Advance breakdown - only show if there are advances */}
                {parseFloat(royaltyResult.total_advances || '0') > 0 && (
                  <div className="bg-warning-50 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-medium text-warning-800">Détail des avances</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-warning-700">Avances totales</span>
                        <span className="font-medium text-warning-900">{formatCurrency(royaltyResult.total_advances, royaltyResult.currency)}</span>
                      </div>
                      {parseFloat(royaltyResult.total_recouped_before || '0') > 0 && (
                        <div className="flex justify-between">
                          <span className="text-warning-700">Déjà recoupé (périodes précédentes)</span>
                          <span className="font-medium text-success-700">-{formatCurrency(royaltyResult.total_recouped_before, royaltyResult.currency)}</span>
                        </div>
                      )}
                      {parseFloat(royaltyResult.recoupable || '0') > 0 && (
                        <div className="flex justify-between">
                          <span className="text-warning-700">Recoupé cette période</span>
                          <span className="font-medium text-success-700">-{formatCurrency(royaltyResult.recoupable, royaltyResult.currency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-warning-200 pt-1 mt-1">
                        <span className="font-medium text-warning-800">Reste à recouper</span>
                        <span className="font-bold text-warning-900">{formatCurrency(royaltyResult.remaining_advance, royaltyResult.currency)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Net payable */}
                <div className={`rounded-xl p-4 ${parseFloat(royaltyResult.net_payable) > 0 ? 'bg-success-50' : 'bg-content2'}`}>
                  <p className="text-xs text-secondary-500 mb-1">Net payable à l'artiste</p>
                  <p className={`text-2xl font-bold ${parseFloat(royaltyResult.net_payable) > 0 ? 'text-success-700' : 'text-foreground'}`}>
                    {formatCurrency(royaltyResult.net_payable, royaltyResult.currency)}
                  </p>
                </div>

                {/* Paid quarters (for year view) */}
                {paidQuarters.length > 0 && (
                  <div className="bg-warning-50 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-medium text-warning-700">Trimestres deja payes cette annee</p>
                    {paidQuarters.map((pq, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-warning-800">{pq.quarter} (paye le {new Date(pq.date).toLocaleDateString('fr-FR')})</span>
                        <span className="font-medium text-warning-900">-{formatCurrency(pq.amount.toString(), royaltyResult.currency)}</span>
                      </div>
                    ))}
                    <div className="border-t border-warning-200 pt-2 flex justify-between">
                      <span className="text-sm font-medium text-warning-800">Reste a payer</span>
                      <span className="text-lg font-bold text-success-700">
                        {formatCurrency((parseFloat(royaltyResult.net_payable) - paidQuarters.reduce((sum, pq) => sum + pq.amount, 0)).toString(), royaltyResult.currency)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Period info */}
                <p className="text-xs text-secondary-500 text-center">
                  Période: {new Date(royaltyResult.period_start).toLocaleDateString('fr-FR')} - {new Date(royaltyResult.period_end).toLocaleDateString('fr-FR')}
                </p>

                {/* Sources breakdown */}
                {royaltyResult.sources && royaltyResult.sources.length > 0 && (
                  <div className="border-t border-divider pt-4">
                    <h3 className="text-sm font-medium text-secondary-700 mb-3">Détail par source</h3>
                    <div className="space-y-2">
                      {royaltyResult.sources.map((source, idx) => (
                        <div key={`${source.source}-${idx}`} className="flex items-center justify-between gap-3 py-2 border-b border-default-50 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              source.source === 'tunecore' ? 'bg-primary/10 text-primary-700' :
                              source.source === 'bandcamp' ? 'bg-success/10 text-success-700' :
                              source.source === 'believe_uk' ? 'bg-secondary/10 text-secondary-700' :
                              'bg-content2 text-secondary-600'
                            }`}>
                              {source.source_label}
                            </span>
                            <span className="text-xs text-secondary-500">
                              {formatNumber(source.transaction_count)} transactions · {formatNumber(source.streams)} streams
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-foreground">{formatCurrency(source.artist_royalties, royaltyResult.currency)}</p>
                            <p className="text-xs text-secondary-500">sur {formatCurrency(source.gross, royaltyResult.currency)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Albums breakdown */}
                {royaltyResult.albums.length > 0 && (
                  <div className="border-t border-divider pt-4">
                    <h3 className="text-sm font-medium text-secondary-700 mb-3">Détail par album</h3>
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
                            className={`flex items-start justify-between gap-3 py-2 border-b border-default-50 last:border-0 ${isIncludedInAlbum ? 'bg-warning-50 rounded-xl px-2' : ''}`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className={`font-medium text-sm truncate ${isIncludedInAlbum ? 'text-warning-700' : 'text-foreground'}`}>
                                {album.release_title}
                              </p>
                              <p className="text-xs text-secondary-400 font-mono">UPC: {album.upc}</p>
                              <p className="text-xs text-secondary-500">
                                {album.track_count} track{album.track_count > 1 ? 's' : ''}
                                {album.streams > 0 && ` · ${formatNumber(album.streams)} streams`}
                              </p>
                              {album.sources && album.sources.length > 1 && (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {album.sources.map((src, si) => {
                                    const saleLabel = src.sale_type === 'stream' ? 'Streams'
                                      : src.sale_type === 'cd' ? 'CD'
                                      : src.sale_type === 'vinyl' ? 'Vinyl'
                                      : src.sale_type === 'k7' ? 'K7'
                                      : src.sale_type === 'digital' ? 'Digital'
                                      : src.sale_type;
                                    return (
                                      <span key={si} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                        src.sale_type === 'stream' ? 'bg-primary/10 text-primary-700' : 'bg-warning/10 text-warning-700'
                                      }`}>
                                        {src.source_label} ({saleLabel}): {formatCurrency(src.gross, royaltyResult.currency)}
                                        {src.sale_type === 'stream' ? ` · ${formatNumber(src.quantity)} streams` : src.quantity > 0 ? ` · ${src.quantity} ventes` : ''}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
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
                                  <p className="text-sm font-medium text-secondary-400 line-through">{formatCurrency(album.artist_royalties, royaltyResult.currency)}</p>
                                  <p className="text-xs text-warning-700">Inclus dans album</p>
                                </>
                              ) : hasAdvance ? (
                                <>
                                  <p className="text-sm font-medium text-foreground">{formatCurrency(netPayable, royaltyResult.currency)}</p>
                                  <p className="text-xs text-secondary-400 line-through">{formatCurrency(album.artist_royalties, royaltyResult.currency)}</p>
                                </>
                              ) : (
                                <p className="text-sm font-medium text-foreground">{formatCurrency(album.artist_royalties, royaltyResult.currency)}</p>
                              )}
                              {!isIncludedInAlbum && (
                                <p className="text-xs text-secondary-500">
                                  {formatPercent(parseFloat(album.artist_share || '0'))}% de {formatCurrency(album.gross, royaltyResult.currency)}
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
                  <p className="text-center text-sm text-secondary-500 py-4">
                    Aucune donnée pour cette période
                  </p>
                )}

                {/* Export buttons */}
                {royaltyResult.albums.length > 0 && (
                  <div className="pt-4 border-t border-divider space-y-2">
                    <div className="flex gap-2">
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
                        Revenus
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handlePrintExpensesPDF}
                        className="flex-1"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                        </svg>
                        Depenses
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={handlePrintArtistPDF}
                      className="w-full"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                      </svg>
                      PDF Artiste (avec lien paiement)
                    </Button>
                  </div>
                )}

                {/* Publish to artist portal button */}
                <div className="pt-4 border-t border-divider">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={handlePublishStatement}
                    loading={publishingStatement}
                    className="w-full bg-primary hover:bg-primary-600"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Publier sur l'Espace Artiste
                  </Button>
                  <p className="text-xs text-secondary-500 text-center mt-2">
                    Envoie le relevé sur l'espace artiste
                  </p>
                </div>

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
                          className="w-full bg-success hover:bg-success-600 text-white"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Marquer comme paye ({formatCurrency(remaining.toString(), royaltyResult.currency)})
                        </Button>
                        <p className="text-xs text-secondary-500 text-center mt-2">
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
        <div className="bg-background rounded-2xl border border-divider shadow-sm">
          <div className="px-5 py-4 border-b border-divider">
            <h2 className="font-medium text-foreground">Contrat catalogue (défaut)</h2>
            <p className="text-sm text-secondary-500">S'applique à tout sauf si un contrat spécifique existe</p>
          </div>
          {catalogContract ? (
            <div className="px-4 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                    <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {(() => {
                        const { artistShare, labelShare } = getContractShares(catalogContract, artistId);
                        return `${formatPercent(artistShare)}% artiste / ${formatPercent(labelShare)}% label`;
                      })()}
                    </p>
                    <p className="text-sm text-secondary-500">
                      Depuis {new Date(catalogContract.start_date).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleEditContract(catalogContract)}
                    className="p-2 text-secondary-400 hover:text-secondary-600 hover:bg-content2 rounded-xl transition-colors"
                    title="Modifier"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => catalogContract.id && handleDeleteContract(catalogContract.id)}
                    disabled={deletingContractId === catalogContract.id}
                    className="p-2 text-secondary-400 hover:text-danger hover:bg-danger-50 rounded-xl transition-colors"
                    title="Supprimer"
                  >
                    {deletingContractId === catalogContract.id ? (
                      <div className="w-4 h-4 border-2 border-danger-400 border-t-transparent rounded-full animate-spin" />
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
              <p className="text-secondary-500 text-sm mb-3">Aucun contrat catalogue défini</p>
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

        {/* Tous les contrats - shows ALL releases + existing contracts */}
        <div className="bg-background rounded-2xl border border-divider shadow-sm">
          <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
            <div>
              <h2 className="font-medium text-foreground">Tous les contrats</h2>
              <p className="text-sm text-secondary-500">
                {contracts.length} contrat{contracts.length !== 1 ? 's' : ''} · {releases.length} release{releases.length !== 1 ? 's' : ''}
              </p>
            </div>
            <a
              href="/contracts"
              className="text-sm text-primary hover:text-primary-600 font-medium"
            >
              Voir page Contrats →
            </a>
          </div>
          <div className="divide-y divide-divider max-h-[500px] overflow-y-auto">
            {/* Catalog contract */}
            {(() => {
              const catContract = contracts.find(c => c.scope === 'catalog');
              if (catContract) {
                const { artistShare, labelShare } = getContractShares(catContract, artistId);
                return (
                  <div className="px-4 py-3 flex items-center justify-between gap-3 bg-content2/30">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-secondary/10 text-secondary-700">Catalogue</span>
                        <span className="text-sm font-medium text-foreground">Contrat par défaut</span>
                      </div>
                      {catContract.parties && catContract.parties.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {catContract.parties.map((p, i) => (
                            <span key={i} className="text-xs text-secondary-500">
                              {p.party_type === 'artist'
                                ? (allArtists.find(a => a.id === p.artist_id)?.name || 'Artiste')
                                : (p.label_name || 'Label')
                              }: {formatPercent(parseFloat(String(p.share_percentage)))}%
                              {i < catContract.parties!.length - 1 ? ' · ' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success-700">
                        {formatPercent(artistShare)}% / {formatPercent(labelShare)}%
                      </span>
                      <button onClick={() => handleEditContract(catContract)} className="p-1.5 text-secondary-400 hover:text-secondary-600 hover:bg-content2 rounded transition-colors" title="Modifier">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </button>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* All releases - with or without contract */}
            {releases.map((release) => {
              const releaseContract = contracts.find(c => c.scope === 'release' && c.scope_id === release.upc);
              const catContract = contracts.find(c => c.scope === 'catalog');
              const hasContract = !!releaseContract;
              const effectiveContract = releaseContract || catContract;
              const shares = effectiveContract ? getContractShares(effectiveContract, artistId) : null;

              return (
                <div key={release.upc} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                        hasContract ? 'bg-success/10 text-success-700' : 'bg-warning/10 text-warning-700'
                      }`}>
                        Release
                      </span>
                      <span className="text-sm font-medium text-foreground truncate">{release.release_title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs font-mono text-secondary-400">UPC: {release.upc}</span>
                      {release.store_name && (
                        <span className="text-xs text-secondary-400">· {release.store_name}</span>
                      )}
                    </div>
                    {hasContract && releaseContract?.parties && releaseContract.parties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {releaseContract.parties.map((p, i) => (
                          <span key={i} className="text-xs text-secondary-500">
                            {p.party_type === 'artist'
                              ? (allArtists.find(a => a.id === p.artist_id)?.name || 'Artiste')
                              : (p.label_name || 'Label')
                            }: {formatPercent(parseFloat(String(p.share_percentage)))}%
                            {i < releaseContract.parties!.length - 1 ? ' · ' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasContract ? (
                      <>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success-700">
                          {shares ? `${formatPercent(shares.artistShare)}%` : '-'}
                        </span>
                        <button onClick={() => handleEditContract(releaseContract!)} className="p-1.5 text-secondary-400 hover:text-secondary-600 hover:bg-content2 rounded transition-colors" title="Modifier">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                      </>
                    ) : shares ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-content2 text-secondary-600">
                        {formatPercent(shares.artistShare)}% (catalogue)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning-700">
                        Aucun contrat
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Track-level contracts (not shown as releases) */}
            {contracts.filter(c => c.scope === 'track').map((contract) => {
              const { artistShare, labelShare } = getContractShares(contract, artistId);
              const trackName = tracks.find(t => t.isrc === contract.scope_id)?.track_title;
              return (
                <div key={contract.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary-700">Track</span>
                      {trackName && <span className="text-sm font-medium text-foreground truncate">{trackName}</span>}
                      {contract.scope_id && <span className="text-xs font-mono text-secondary-400">{contract.scope_id}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary-700">
                      {formatPercent(artistShare)}%
                    </span>
                    <button onClick={() => handleEditContract(contract)} className="p-1.5 text-secondary-400 hover:text-secondary-600 hover:bg-content2 rounded transition-colors" title="Modifier">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Releases avec contrats */}
        <div className="bg-background rounded-2xl border border-divider shadow-sm">
          <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
            <div>
              <h2 className="font-medium text-foreground">Releases ({groupedReleasesArray.length})</h2>
              <p className="text-sm text-secondary-500">% spécifique par album/EP/single</p>
            </div>
            {releases.length > 0 && Object.keys(albumArtwork).length < releases.length && (
              <button
                onClick={fetchAllArtwork}
                className="text-sm text-success hover:text-success-700 inline-flex items-center gap-1"
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
              <div className="animate-spin w-6 h-6 border-2 border-default-900 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : releases.length === 0 ? (
            <p className="px-4 py-6 text-center text-secondary-500">Aucune release trouvée</p>
          ) : (
            <div className="divide-y divide-divider">
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
                              className="w-12 h-12 rounded-md bg-content2 flex items-center justify-center hover:bg-content3 transition-colors"
                            >
                              {isLoadingArt ? (
                                <div className="w-4 h-4 border-2 border-default-400 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg className="w-5 h-5 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                              <p className="font-medium text-foreground truncate group-hover:text-secondary-700">{group.release_title}</p>
                              {hasMultipleSources && (
                                <svg
                                  className={`w-4 h-4 text-secondary-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              )}
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
                            {group.upc && group.upc !== 'UNKNOWN' && (
                              <p className="text-xs text-secondary-400 font-mono">UPC: {group.upc}</p>
                            )}
                            {group.sources.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1">
                                {group.sources.map((s, si) => (
                                  <span key={si} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    s.store_name?.toLowerCase() === 'bandcamp' || s.store_name?.toLowerCase() === 'squarespace'
                                      ? 'bg-warning/10 text-warning-700' : 'bg-primary/10 text-primary-700'
                                  }`}>
                                    {s.store_name}{s.physical_format ? ` (${s.physical_format})` : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-secondary-500">
                            {group.track_count} track{group.track_count > 1 ? 's' : ''} · {formatCurrency(group.total_gross, group.currency)}
                            {group.total_streams > 0 && (
                              <span className="text-secondary-400 ml-1">
                                · {group.total_streams.toLocaleString()} stream{group.total_streams > 1 ? 's' : ''}
                              </span>
                            )}
                            {hasMultipleSources && (
                              <span className="text-secondary-400 ml-1">
                                · {group.sources.length} source{group.sources.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {contract ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success-700">
                              {formatPercent(getContractShares(contract, artistId).artistShare)}%
                            </span>
                          ) : catalogContract ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-content2 text-secondary-600">
                              {formatPercent(getContractShares(catalogContract, artistId).artistShare)}% (défaut)
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning-700">
                              Aucun contrat
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Expanded sources */}
                    {isExpanded && hasMultipleSources && (
                      <div className="bg-content2 border-t border-divider px-4 py-2">
                        <div className="ml-15 pl-3 border-l-2 border-divider space-y-2">
                          {group.sources.map((source, sIdx) => {
                            const isPhysical = source.store_name?.toLowerCase() === 'bandcamp' || source.store_name?.toLowerCase() === 'squarespace';
                            const unitLabel = isPhysical ? 'vente' : 'stream';
                            return (
                              <div key={`${source.store_name}-${source.physical_format}-${sIdx}`} className="flex items-center gap-3 py-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    {source.store_name && (
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-medium text-xs ${
                                        isPhysical ? 'bg-warning/10 text-warning-700' : 'bg-primary/10 text-primary-700'
                                      }`}>
                                        {source.store_name}
                                      </span>
                                    )}
                                    {source.physical_format && (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-secondary/10 text-secondary-700 font-medium text-xs">
                                        {source.physical_format}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-secondary-400 mt-1">
                                    {source.track_count} track{source.track_count > 1 ? 's' : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 text-right">
                                  <div>
                                    <p className="text-sm font-medium text-secondary-700">{formatCurrency(source.gross, group.currency)}</p>
                                    {source.quantity > 0 && (
                                      <p className="text-xs text-secondary-400">
                                        {formatNumber(source.quantity)} {unitLabel}{source.quantity > 1 ? 's' : ''}
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
        <div className="bg-background rounded-2xl border border-divider shadow-sm">
          <div className="px-5 py-4 border-b border-divider">
            <h2 className="font-medium text-foreground">Tracks ({tracks.length})</h2>
            <p className="text-sm text-secondary-500">% spécifique par track (optionnel)</p>
          </div>
          {loadingCatalog ? (
            <div className="px-4 py-8 text-center">
              <div className="animate-spin w-6 h-6 border-2 border-default-900 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : tracks.length === 0 ? (
            <p className="px-4 py-6 text-center text-secondary-500">Aucune track trouvée</p>
          ) : (
            <div className="divide-y divide-divider max-h-96 overflow-y-auto">
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
                            className="w-10 h-10 rounded bg-content2 flex items-center justify-center hover:bg-content3 transition-colors"
                          >
                            {isLoadingArt ? (
                              <div className="w-3 h-3 border-2 border-default-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground truncate">{track.track_title}</p>
                        <p className="text-sm text-secondary-500 truncate">{track.release_title}</p>
                        <p className="text-xs text-secondary-400 font-mono">ISRC: {track.isrc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSpecific && trackContract ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary-700">
                            {formatPercent(getContractShares(trackContract, artistId).artistShare)}%
                          </span>
                        ) : effectiveContract ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            isReleaseLevel
                              ? 'bg-success/10 text-success-700'
                              : 'bg-content2 text-secondary-600'
                          }`}>
                            {formatPercent(getContractShares(effectiveContract, artistId).artistShare)}%
                            {isReleaseLevel ? ' (release)' : ' (défaut)'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning-700">
                            Aucun contrat
                          </span>
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
        <div className="bg-background rounded-2xl border border-divider shadow-sm">
          <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
            <div>
              <h2 className="font-medium text-foreground">Avances</h2>
              <p className="text-sm text-secondary-500">Par catalogue, album ou track</p>
            </div>
            <Button size="sm" onClick={() => setShowAdvanceForm(true)}>Ajouter</Button>
          </div>
          {advances.length === 0 ? (
            <p className="px-4 py-6 text-center text-secondary-500">Aucune avance</p>
          ) : (
            <div className="divide-y divide-divider">
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
                              ? 'bg-content2 text-secondary-600'
                              : entry.scope === 'release'
                                ? 'bg-success/10 text-success-700'
                                : 'bg-primary/10 text-primary-700'
                          }`}>
                            {entry.scope === 'catalog' ? 'Catalogue' : entry.scope === 'release' ? 'Album' : 'Track'}
                          </span>
                          {entry.category && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary/10 text-secondary-700">
                              {EXPENSE_CATEGORIES.find(c => c.value === entry.category)?.label || entry.category}
                            </span>
                          )}
                        </div>
                        {entry.scope !== 'catalog' && entry.scope_id && (
                          <p className="text-sm text-secondary-600">
                            {entry.scope === 'release'
                              ? (releases.find(r => r.upc === entry.scope_id)?.release_title || entry.scope_id)
                              : (tracks.find(t => t.isrc === entry.scope_id)?.track_title || entry.scope_id)
                            }
                            <span className="text-xs text-secondary-400 font-mono ml-2">({entry.scope_id})</span>
                          </p>
                        )}
                        {entry.description && (
                          <p className="text-sm text-secondary-500">{entry.description}</p>
                        )}
                        <p className="text-xs text-secondary-400 mt-1">
                          {new Date(entry.effective_date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${isAdvance ? 'text-danger' : 'text-success'}`}>
                          {isAdvance ? '-' : '+'}
                          {formatCurrency(entry.amount, entry.currency)}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEditAdvance(entry)}
                            className="p-1.5 text-secondary-400 hover:text-secondary-600 hover:bg-content2 rounded transition-colors"
                            title="Modifier"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteAdvance(entry.id)}
                            disabled={isDeleting}
                            className="p-1.5 text-secondary-400 hover:text-danger hover:bg-danger-50 rounded transition-colors"
                            title="Supprimer"
                          >
                            {isDeleting ? (
                              <div className="w-4 h-4 border-2 border-danger-400 border-t-transparent rounded-full animate-spin" />
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
        <div className="bg-background rounded-2xl border border-divider shadow-sm">
          <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
            <div>
              <h2 className="font-medium text-foreground">Versements</h2>
              <p className="text-sm text-secondary-500">Royalties payées à l'artiste</p>
            </div>
            <Button size="sm" onClick={() => setShowPaymentForm(true)}>Ajouter</Button>
          </div>
          {payments.length === 0 ? (
            <p className="px-4 py-6 text-center text-secondary-500">Aucun versement</p>
          ) : (
            <div className="divide-y divide-divider">
              {payments.map((payment) => {
                const isDeleting = deletingPaymentId === payment.id;
                return (
                  <div key={payment.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">Versement</p>
                        {payment.description && (
                          <p className="text-sm text-secondary-500">{payment.description}</p>
                        )}
                        <p className="text-xs text-secondary-400 mt-1">
                          {new Date(payment.effective_date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-success">
                          {formatCurrency(payment.amount, payment.currency)}
                        </p>
                        <button
                          onClick={() => handleEditPayment(payment)}
                          className="p-1.5 text-secondary-400 hover:text-primary hover:bg-primary/10 rounded transition-colors"
                          title="Modifier"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeletePayment(payment.id)}
                          disabled={isDeleting}
                          className="p-1.5 text-secondary-400 hover:text-danger hover:bg-danger-50 rounded transition-colors"
                          title="Supprimer"
                        >
                          {isDeleting ? (
                            <div className="w-4 h-4 border-2 border-danger-400 border-t-transparent rounded-full animate-spin" />
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

      {/* Edit Payment Modal */}
      {editingPayment && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Modifier le versement</h2>
                <button onClick={() => setEditingPayment(null)} className="p-2 -mr-2 text-secondary-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Montant (EUR)</label>
                <Input
                  type="number"
                  value={editPaymentAmount}
                  onChange={(e) => setEditPaymentAmount(e.target.value)}
                  placeholder="1000.00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Description</label>
                <Input
                  value={editPaymentDescription}
                  onChange={(e) => setEditPaymentDescription(e.target.value)}
                  placeholder="Versement Q3 2024"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Date</label>
                <Input
                  type="date"
                  value={editPaymentDate}
                  onChange={(e) => setEditPaymentDate(e.target.value)}
                />
              </div>
              <Button
                onClick={handleUpdatePayment}
                loading={savingPayment}
                disabled={!editPaymentAmount}
                className="w-full"
              >
                Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Contract Form Modal */}
      {showContractForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
            <div className="px-4 py-4 sm:px-6 border-b border-divider flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  {selectedItem ? `Contrat: ${selectedItem.name}` : 'Contrat catalogue'}
                </h2>
                <button onClick={() => {
                  setShowContractForm(false);
                  setSelectedItem(null);
                  setContractParties([]);
                }} className="p-2 -mr-2 text-secondary-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {selectedItem && (
                <div className="bg-content2 rounded-xl p-3">
                  <p className="text-sm text-secondary-500">
                    {selectedItem.type === 'release' ? 'Release (UPC)' : 'Track (ISRC)'}
                  </p>
                  <p className="font-medium text-foreground">{selectedItem.name}</p>
                  <p className="text-xs text-secondary-400 font-mono mt-1">{selectedItem.id}</p>
                </div>
              )}
              {!selectedItem && (
                <div className="bg-primary/5 rounded-xl p-3">
                  <p className="text-sm text-primary-700">
                    Le contrat catalogue s'applique à toutes les releases et tracks qui n'ont pas de contrat spécifique.
                  </p>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-secondary-700">
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
                  <div className="bg-content2 rounded-xl p-3 mb-3">
                    <p className="text-sm text-secondary-500">
                      Aucune partie définie. Ajoutez des artistes ou labels avec leurs parts respectives.
                    </p>
                  </div>
                )}

                <div className="space-y-3 mb-3">
                  {contractParties.map((party, index) => (
                    <div key={index} className="bg-content2 rounded-xl p-3">
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
                          className="flex-1 px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm"
                        >
                          <option value="artist">Artiste</option>
                          <option value="label">Label</option>
                        </select>
                        <button
                          onClick={() => {
                            setContractParties(contractParties.filter((_, i) => i !== index));
                          }}
                          className="p-2 text-danger hover:bg-danger-50 rounded-xl"
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
                          className="w-full px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm mb-2"
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
                          className="w-full px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm mb-2"
                        />
                      )}

                      <div>
                        <label className="block text-xs text-secondary-500 mb-1">
                          Part (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={party.share_percentage}
                          onChange={(e) => {
                            const newParties = [...contractParties];
                            newParties[index].share_percentage = parseFloat(e.target.value) || 0;
                            setContractParties(newParties);
                          }}
                          className="w-full px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm text-center focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {contractParties.length > 0 && (
                  <div className={`rounded-xl p-3 ${
                    Math.abs(contractParties.reduce((sum, p) => sum + p.share_percentage, 0) - 100) <= 0.01
                      ? 'bg-success-50 text-success-700'
                      : 'bg-warning-50 text-warning-700'
                  }`}>
                    <p className="text-sm font-medium">
                      Total: {contractParties.reduce((sum, p) => sum + p.share_percentage, 0).toFixed(2)}%
                      {Math.abs(contractParties.reduce((sum, p) => sum + p.share_percentage, 0) - 100) > 0.01 && ' (doit être 100%)'}
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
                  className="w-full px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm"
                />
                {contractFile && (
                  <p className="text-xs text-success mt-1">
                    📄 {contractFile.name}
                  </p>
                )}
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3 flex-shrink-0">
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
                  Math.abs(contractParties.reduce((sum, p) => sum + p.share_percentage, 0) - 100) > 0.01
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Nouvelle avance</h2>
                <button onClick={() => {
                  setShowAdvanceForm(false);
                  setAdvanceScope('catalog');
                  setAdvanceScopeId('');
                }} className="p-2 -mr-2 text-secondary-500">
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
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Appliquer à
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAdvanceScope('catalog');
                      setAdvanceScopeId('');
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                      advanceScope === 'catalog'
                        ? 'bg-foreground text-background'
                        : 'bg-content2 text-secondary-600 hover:bg-content3'
                    }`}
                  >
                    Catalogue
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdvanceScope('release')}
                    className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                      advanceScope === 'release'
                        ? 'bg-foreground text-background'
                        : 'bg-content2 text-secondary-600 hover:bg-content3'
                    }`}
                  >
                    Album
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdvanceScope('track')}
                    className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                      advanceScope === 'track'
                        ? 'bg-foreground text-background'
                        : 'bg-content2 text-secondary-600 hover:bg-content3'
                    }`}
                  >
                    Track
                  </button>
                </div>
              </div>

              {/* Scope ID selector */}
              {advanceScope === 'release' && (
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Sélectionner un album
                  </label>
                  <select
                    value={advanceScopeId}
                    onChange={(e) => setAdvanceScopeId(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:outline-none focus:border-primary"
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
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Sélectionner un track
                  </label>
                  <select
                    value={advanceScopeId}
                    onChange={(e) => setAdvanceScopeId(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:outline-none focus:border-primary"
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
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Catégorie
                </label>
                <select
                  value={advanceCategory}
                  onChange={(e) => setAdvanceCategory(e.target.value as ExpenseCategory | '')}
                  className="w-full px-3 py-2 border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:outline-none focus:border-primary bg-background"
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
                type="date"
                label="Date"
                value={advanceDate}
                onChange={(e) => setAdvanceDate(e.target.value)}
              />

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
                setAdvanceDate('');
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Nouveau versement</h2>
                <button onClick={() => setShowPaymentForm(false)} className="p-2 -mr-2 text-secondary-500">
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Photo de l'artiste</h2>
                <button onClick={() => {
                  setShowEditArtwork(false);
                  setSpotifyProfileUrl('');
                  setEditImageUrl('');
                }} className="p-2 -mr-2 text-secondary-500">
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

              <div className="bg-content2 rounded-xl p-3 space-y-3">
                <p className="text-sm text-secondary-600">
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
                  className="w-full py-2 text-sm text-success hover:text-success-700 border border-green-200 rounded-xl inline-flex items-center justify-center gap-2"
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
                <span className="flex-shrink mx-3 text-xs text-secondary-400">ou</span>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Modifier l'artiste</h2>
                <button onClick={() => setShowEditArtist(false)} className="p-2 -mr-2 text-secondary-500">
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
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Catégorie
                </label>
                <div className="flex gap-2">
                  {ARTIST_CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setEditCategory(cat.value)}
                      className={`flex-1 px-3 py-2 text-sm rounded-xl border transition-colors ${
                        editCategory === cat.value
                          ? cat.value === 'signed'
                            ? 'bg-primary-100 border-primary-500 text-primary-700'
                            : 'bg-secondary-100 border-secondary-500 text-secondary-700'
                          : 'bg-content2 border-default-200 text-secondary-600 hover:bg-content3'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
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
                <p className="text-xs text-secondary-500 mt-1">
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-4 py-4 sm:px-6 border-b border-divider">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Modifier l'avance</h2>
                <button onClick={() => setEditingAdvance(null)} className="p-2 -mr-2 text-secondary-500">
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
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Appliquer à
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditAdvanceScope('catalog');
                      setEditAdvanceScopeId('');
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                      editAdvanceScope === 'catalog'
                        ? 'bg-foreground text-background'
                        : 'bg-content2 text-secondary-600 hover:bg-content3'
                    }`}
                  >
                    Catalogue
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditAdvanceScope('release')}
                    className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                      editAdvanceScope === 'release'
                        ? 'bg-foreground text-background'
                        : 'bg-content2 text-secondary-600 hover:bg-content3'
                    }`}
                  >
                    Album
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditAdvanceScope('track')}
                    className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                      editAdvanceScope === 'track'
                        ? 'bg-foreground text-background'
                        : 'bg-content2 text-secondary-600 hover:bg-content3'
                    }`}
                  >
                    Track
                  </button>
                </div>
              </div>

              {/* Scope ID selector */}
              {editAdvanceScope === 'release' && (
                <div>
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Sélectionner un album
                  </label>
                  <select
                    value={editAdvanceScopeId}
                    onChange={(e) => setEditAdvanceScopeId(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:outline-none focus:border-primary"
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
                  <label className="block text-sm font-medium text-secondary-700 mb-2">
                    Sélectionner un track
                  </label>
                  <select
                    value={editAdvanceScopeId}
                    onChange={(e) => setEditAdvanceScopeId(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:outline-none focus:border-primary"
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
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Catégorie
                </label>
                <select
                  value={editAdvanceCategory}
                  onChange={(e) => setEditAdvanceCategory(e.target.value as ExpenseCategory | '')}
                  className="w-full px-3 py-2 border-2 border-default-200 rounded-xl text-sm focus:outline-none focus:outline-none focus:border-primary bg-background"
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
                type="date"
                label="Date"
                value={editAdvanceDate}
                onChange={(e) => setEditAdvanceDate(e.target.value)}
              />

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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
            <div className="px-4 py-4 sm:px-6 border-b border-divider flex-shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Modifier le contrat</h2>
                <button onClick={() => setEditingContract(null)} className="p-2 -mr-2 text-secondary-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="bg-content2 rounded-xl p-3">
                <p className="text-sm text-secondary-500">
                  {editingContract.scope === 'catalog' ? 'Catalogue' : editingContract.scope === 'release' ? 'Release (UPC)' : 'Track (ISRC)'}
                </p>
                <p className="font-medium text-foreground">
                  {editingContract.scope === 'catalog' ? 'Tout le catalogue' : editingContract.scope_id}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-secondary-700">
                    Parties du contrat
                  </label>
                  <button
                    onClick={() => {
                      setEditContractParties([...editContractParties, {
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

                <div className="space-y-3 mb-3">
                  {editContractParties.map((party, index) => (
                    <div key={index} className="bg-content2 rounded-xl p-3">
                      <div className="flex items-start gap-2 mb-2">
                        <select
                          value={party.party_type}
                          onChange={(e) => {
                            const newParties = [...editContractParties];
                            newParties[index].party_type = e.target.value as 'artist' | 'label';
                            if (e.target.value === 'artist') {
                              newParties[index].artist_id = artist?.id;
                              delete newParties[index].label_name;
                            } else {
                              newParties[index].label_name = '';
                              delete newParties[index].artist_id;
                            }
                            setEditContractParties(newParties);
                          }}
                          className="flex-1 px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm"
                        >
                          <option value="artist">Artiste</option>
                          <option value="label">Label</option>
                        </select>
                        <button
                          onClick={() => {
                            setEditContractParties(editContractParties.filter((_, i) => i !== index));
                          }}
                          className="p-2 text-danger hover:bg-danger-50 rounded-xl"
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
                            const newParties = [...editContractParties];
                            newParties[index].artist_id = e.target.value;
                            setEditContractParties(newParties);
                          }}
                          className="w-full px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm mb-2"
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
                            const newParties = [...editContractParties];
                            newParties[index].label_name = e.target.value;
                            setEditContractParties(newParties);
                          }}
                          className="w-full px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm mb-2"
                        />
                      )}

                      <div>
                        <label className="block text-xs text-secondary-500 mb-1">
                          Part (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="any"
                          value={party.share_percentage}
                          onChange={(e) => {
                            const newParties = [...editContractParties];
                            newParties[index].share_percentage = parseFloat(e.target.value) || 0;
                            setEditContractParties(newParties);
                          }}
                          className="w-full px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm text-center focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {editContractParties.length > 0 && (
                  <div className={`rounded-xl p-3 ${
                    Math.abs(editContractParties.reduce((sum, p) => sum + p.share_percentage, 0) - 100) <= 0.01
                      ? 'bg-success-50 text-success-700'
                      : 'bg-warning-50 text-warning-700'
                  }`}>
                    <p className="text-sm font-medium">
                      Total: {editContractParties.reduce((sum, p) => sum + p.share_percentage, 0).toFixed(2)}%
                      {Math.abs(editContractParties.reduce((sum, p) => sum + p.share_percentage, 0) - 100) > 0.01 && ' (doit être 100%)'}
                    </p>
                  </div>
                )}
              </div>

              <Input
                type="date"
                label="Date de début"
                value={editContractStartDate}
                onChange={(e) => setEditContractStartDate(e.target.value)}
              />
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3 flex-shrink-0">
              <Button variant="secondary" onClick={() => setEditingContract(null)} className="flex-1">
                Annuler
              </Button>
              <Button
                onClick={handleUpdateContract}
                loading={savingContract}
                disabled={
                  !editContractStartDate ||
                  editContractParties.length === 0 ||
                  Math.abs(editContractParties.reduce((sum, p) => sum + p.share_percentage, 0) - 100) > 0.01
                }
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-background w-full max-w-md rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-divider bg-danger-50">
              <h2 className="text-lg font-semibold text-danger-800">Supprimer l&apos;artiste</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-danger-100 border border-danger-300 rounded-xl p-4">
                <p className="text-danger-800 font-medium text-center mb-2">
                  ATTENTION: Cette action est IRREVERSIBLE
                </p>
                <p className="text-danger-700 text-sm text-center">
                  Toutes les donnees associees seront supprimees:
                </p>
                <ul className="text-danger text-sm mt-2 space-y-1 list-disc list-inside">
                  <li>Contrats ({contracts.length})</li>
                  <li>Avances ({advances.length})</li>
                  <li>Versements ({payments.length})</li>
                  <li>Liens avec les tracks</li>
                </ul>
              </div>

              <div>
                <label className="block text-sm font-medium text-secondary-700 mb-2">
                  Pour confirmer, tapez le nom de l&apos;artiste:
                </label>
                <p className="text-lg font-bold text-foreground mb-2 bg-content2 px-3 py-2 rounded-xl">
                  {artist.name}
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Tapez le nom exactement"
                  className="w-full px-4 py-3 border-2 border-danger-300 rounded-xl text-foreground focus:outline-none focus:outline-none focus:border-danger"
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
                  className={`flex-1 py-2.5 px-4 rounded-xl font-medium transition-colors ${
                    deleteConfirmText === artist.name
                      ? 'bg-danger text-white hover:bg-danger-600'
                      : 'bg-danger-200 text-danger-400 cursor-not-allowed'
                  }`}
                >
                  {deleting ? 'Suppression...' : 'Supprimer definitivement'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Auth Account Modal - REMOVED: No longer needed */}

      {/* Danger Zone - at the very bottom */}
      {artist && (
        <div className="max-w-2xl mx-auto px-4 py-8">
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
        </div>
      )}
    </div>
  );
}
