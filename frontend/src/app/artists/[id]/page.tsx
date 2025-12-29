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
  updateContract,
  deleteContract,
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
  updateArtistArtwork,
  updateArtist,
  calculateArtistRoyalties,
  searchAlbumByUPC,
  searchTrackByISRC,
  getLabelSettings,
  CatalogRelease,
  CatalogTrack,
  ArtistRoyaltyCalculation,
  SpotifyAlbumResult,
  SpotifyTrackResult,
  LabelSettings
} from '@/lib/api';

type ContractTab = 'releases' | 'tracks';

export default function ArtistDetailPage() {
  const params = useParams();
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
  const [creatingContract, setCreatingContract] = useState(false);

  // Advance form
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceDescription, setAdvanceDescription] = useState('');
  const [advanceScope, setAdvanceScope] = useState<'catalog' | 'release' | 'track'>('catalog');
  const [advanceScopeId, setAdvanceScopeId] = useState('');
  const [creatingAdvance, setCreatingAdvance] = useState(false);

  // Artwork
  const [fetchingArtwork, setFetchingArtwork] = useState(false);
  const [showEditArtwork, setShowEditArtwork] = useState(false);
  const [editImageUrl, setEditImageUrl] = useState('');

  // Royalty calculation
  const [royaltyPeriod, setRoyaltyPeriod] = useState<string>('3');
  const [calculatingRoyalties, setCalculatingRoyalties] = useState(false);
  const [royaltyResult, setRoyaltyResult] = useState<ArtistRoyaltyCalculation | null>(null);
  const [royaltyError, setRoyaltyError] = useState<string | null>(null);

  // Edit artist
  const [showEditArtist, setShowEditArtist] = useState(false);
  const [editName, setEditName] = useState('');
  const [editSpotifyId, setEditSpotifyId] = useState('');
  const [savingArtist, setSavingArtist] = useState(false);

  // Expanded releases (to show tracks)
  const [expandedReleases, setExpandedReleases] = useState<Set<string>>(new Set());

  // Edit advance
  const [editingAdvance, setEditingAdvance] = useState<AdvanceEntry | null>(null);
  const [editAdvanceAmount, setEditAdvanceAmount] = useState('');
  const [editAdvanceDescription, setEditAdvanceDescription] = useState('');
  const [editAdvanceScope, setEditAdvanceScope] = useState<'catalog' | 'release' | 'track'>('catalog');
  const [editAdvanceScopeId, setEditAdvanceScopeId] = useState('');
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
  const [savingContract, setSavingContract] = useState(false);
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [artistId]);

  const loadData = async () => {
    try {
      const [artistData, contractsData, advancesData, balanceData, paymentsData] = await Promise.all([
        getArtist(artistId),
        getContracts(artistId),
        getAdvances(artistId),
        getAdvanceBalance(artistId),
        getPayments(artistId),
      ]);
      setArtist(artistData);
      setContracts(contractsData);
      setAdvances(advancesData);
      setBalance(balanceData.balance);
      setBalanceCurrency(balanceData.currency || 'EUR');
      setPayments(paymentsData);

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

          // Auto-load artwork for releases (first 10 to avoid rate limiting)
          const releasesToFetch = releasesData.slice(0, 10);
          for (const release of releasesToFetch) {
            try {
              const artworkResult = await searchAlbumByUPC(release.upc);
              if (artworkResult.image_url) {
                setAlbumArtwork(prev => ({ ...prev, [release.upc]: artworkResult }));
              }
            } catch (err) {
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
    if (advanceScope !== 'catalog' && !advanceScopeId) return;
    setCreatingAdvance(true);
    try {
      await createAdvance(
        artistId,
        parseFloat(advanceAmount),
        'EUR',
        advanceDescription || undefined,
        advanceScope,
        advanceScope !== 'catalog' ? advanceScopeId : undefined
      );
      setShowAdvanceForm(false);
      setAdvanceAmount('');
      setAdvanceDescription('');
      setAdvanceScope('catalog');
      setAdvanceScopeId('');
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

  const handleUpdateArtist = async () => {
    if (!editName.trim()) return;
    setSavingArtist(true);
    try {
      await updateArtist(artistId, {
        name: editName.trim(),
        spotify_id: editSpotifyId.trim() || undefined,
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
        editAdvanceScope !== 'catalog' ? editAdvanceScopeId : undefined
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
    setCalculatingRoyalties(true);
    setRoyaltyError(null);
    setRoyaltyResult(null);

    const months = parseInt(royaltyPeriod);
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    try {
      const result = await calculateArtistRoyalties(
        artistId,
        formatDate(startDate),
        formatDate(endDate)
      );
      setRoyaltyResult(result);
    } catch (err) {
      setRoyaltyError(err instanceof Error ? err.message : 'Erreur de calcul');
    } finally {
      setCalculatingRoyalties(false);
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
    lines.push('Album;UPC;Tracks;Streams;Brut;Part artiste;Royalties artiste;Royalties label');
    for (const album of royaltyResult.albums) {
      lines.push([
        album.release_title,
        album.upc,
        album.track_count.toString(),
        album.streams.toString(),
        `${album.gross} ${royaltyResult.currency}`,
        `${(parseFloat(album.artist_share) * 100).toFixed(0)}%`,
        `${album.artist_royalties} ${royaltyResult.currency}`,
        `${album.label_royalties} ${royaltyResult.currency}`,
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
    const formatCurrency = (value: string) => parseFloat(value).toLocaleString('en-US', { style: 'currency', currency: royaltyResult.currency });
    const formatNumber = (value: number) => value.toLocaleString('en-US');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Royalty Statement - ${artist.name}</title>
        <style>
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
          .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; }
          @media print { body { padding: 20px; } .label-header { top: 20px; right: 20px; } }
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

        ${royaltyResult.sources && royaltyResult.sources.length > 0 ? `
        <h2>Revenue by Source</h2>
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th class="right">Transactions</th>
              <th class="right">Streams</th>
              <th class="right">Gross</th>
              <th class="right">Royalties</th>
            </tr>
          </thead>
          <tbody>
            ${royaltyResult.sources.map(source => `
              <tr>
                <td>${source.source_label}</td>
                <td class="right">${formatNumber(source.transaction_count)}</td>
                <td class="right">${formatNumber(source.streams)}</td>
                <td class="right">${formatCurrency(source.gross)}</td>
                <td class="right">${formatCurrency(source.artist_royalties)}</td>
              </tr>
            `).join('')}
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
            </tr>
          </thead>
          <tbody>
            ${royaltyResult.albums.map(album => `
              <tr>
                <td>
                  <div>${album.release_title}</div>
                  <div class="mono">UPC: ${album.upc}</div>
                </td>
                <td>${album.track_count}</td>
                <td class="right">${formatNumber(album.streams)}</td>
                <td class="right">${formatCurrency(album.gross)}</td>
                <td class="right">${(parseFloat(album.artist_share) * 100).toFixed(0)}%</td>
                <td class="right">${formatCurrency(album.artist_royalties)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Generated on ${formatDate(new Date())} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          ${labelSettings?.label_name ? ` - ${labelSettings.label_name}` : ''}
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
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toLocaleString('fr-FR', { style: 'currency', currency });
  };

  const formatNumber = (value: number) => {
    return value.toLocaleString('fr-FR');
  };

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
              <p className="text-sm text-default-500 mt-1">
                {releases.length} release{releases.length > 1 ? 's' : ''} · {tracks.length} track{tracks.length > 1 ? 's' : ''}
              </p>
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
                value={royaltyPeriod}
                onChange={(e) => setRoyaltyPeriod(e.target.value)}
                className="flex-1 px-3 py-2 border border-divider rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
              >
                <option value="1">1 mois</option>
                <option value="3">3 mois</option>
                <option value="6">6 mois</option>
                <option value="12">1 an</option>
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
                  <div className="bg-default-50 rounded-lg p-3">
                    <p className="text-xs text-default-500">Recoupable</p>
                    <p className="text-lg font-semibold text-foreground">
                      {formatCurrency(royaltyResult.recoupable, royaltyResult.currency)}
                    </p>
                  </div>
                  <div className={`rounded-lg p-3 ${parseFloat(royaltyResult.net_payable) > 0 ? 'bg-green-50' : 'bg-default-50'}`}>
                    <p className="text-xs text-default-500">Net payable</p>
                    <p className={`text-lg font-semibold ${parseFloat(royaltyResult.net_payable) > 0 ? 'text-green-700' : 'text-foreground'}`}>
                      {formatCurrency(royaltyResult.net_payable, royaltyResult.currency)}
                    </p>
                  </div>
                </div>

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
                              source.source === 'believe' ? 'bg-purple-100 text-purple-800' :
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
                      {royaltyResult.albums.map((album, idx) => (
                        <div key={`${album.upc}-${idx}`} className="flex items-start justify-between gap-3 py-2 border-b border-neutral-50 last:border-0">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground text-sm truncate">{album.release_title}</p>
                            <p className="text-xs text-default-400 font-mono">UPC: {album.upc}</p>
                            <p className="text-xs text-default-500">
                              {album.track_count} track{album.track_count > 1 ? 's' : ''} · {formatNumber(album.streams)} streams
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-medium text-foreground">{formatCurrency(album.artist_royalties, royaltyResult.currency)}</p>
                            <p className="text-xs text-default-500">
                              {(parseFloat(album.artist_share) * 100).toFixed(0)}% de {formatCurrency(album.gross, royaltyResult.currency)}
                            </p>
                          </div>
                        </div>
                      ))}
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
              <h2 className="font-medium text-foreground">Releases ({releases.length})</h2>
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
              {releases.map((release, index) => {
                const contract = getContractForRelease(release.upc);
                const artwork = albumArtwork[release.upc];
                const isLoadingArt = loadingArtwork[`album-${release.upc}`];
                const isExpanded = expandedReleases.has(release.upc);
                const releaseTracks = getTracksForRelease(release.release_title);
                return (
                  <div key={`${release.upc}-${index}`}>
                    <div className="px-4 py-3">
                      <div className="flex items-start gap-3">
                        {/* Album artwork */}
                        <div className="relative flex-shrink-0">
                          {artwork?.image_url_small ? (
                            <img
                              src={artwork.image_url_small}
                              alt={release.release_title}
                              className="w-12 h-12 rounded-md object-cover"
                            />
                          ) : (
                            <button
                              onClick={() => fetchAlbumArtwork(release.upc)}
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
                            onClick={() => toggleReleaseExpanded(release.upc)}
                            className="text-left w-full group"
                          >
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground truncate group-hover:text-default-700">{release.release_title}</p>
                              <svg
                                className={`w-4 h-4 text-default-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>
                          <p className="text-xs text-default-400 font-mono">UPC: {release.upc}</p>
                          <p className="text-sm text-default-500">
                            {release.track_count} track{release.track_count > 1 ? 's' : ''} · {formatCurrency(release.total_gross, release.currency)}
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
                    {/* Expanded tracks */}
                    {isExpanded && releaseTracks.length > 0 && (
                      <div className="bg-default-50 border-t border-divider px-4 py-2">
                        <div className="ml-15 pl-3 border-l-2 border-divider space-y-2">
                          {releaseTracks.map((track, tIdx) => {
                            const trackContract = getContractForTrack(track.isrc);
                            const effectiveContract = trackContract || contract || catalogContract;
                            const tArtwork = trackArtwork[track.isrc];
                            const isLoadingTArt = loadingArtwork[`track-${track.isrc}`];
                            return (
                              <div key={`${track.isrc}-${tIdx}`} className="flex items-center gap-3 py-1">
                                {/* Track artwork */}
                                <div className="relative flex-shrink-0">
                                  {tArtwork?.image_url_small ? (
                                    <img
                                      src={tArtwork.image_url_small}
                                      alt={track.track_title}
                                      className="w-8 h-8 rounded object-cover"
                                    />
                                  ) : (
                                    <button
                                      onClick={() => fetchTrackArtwork(track.isrc)}
                                      disabled={isLoadingTArt}
                                      className="w-8 h-8 rounded bg-default-200 flex items-center justify-center hover:bg-default-300 transition-colors"
                                    >
                                      {isLoadingTArt ? (
                                        <div className="w-3 h-3 border border-neutral-400 border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <svg className="w-3 h-3 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                                        </svg>
                                      )}
                                    </button>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-default-800 truncate">{track.track_title}</p>
                                  <p className="text-xs text-default-400 font-mono">ISRC: {track.isrc}</p>
                                </div>
                                <div className="flex items-center gap-2 text-right">
                                  <div>
                                    <p className="text-sm font-medium text-default-700">{formatCurrency(track.total_gross, track.currency)}</p>
                                    <p className="text-xs text-default-400">{formatNumber(track.total_streams)} streams</p>
                                  </div>
                                  {trackContract ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                      {(parseFloat(trackContract.artist_share) * 100).toFixed(0)}%
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setSelectedItem({ type: 'track', id: track.isrc, name: track.track_title });
                                        setShowContractForm(true);
                                      }}
                                      className="text-xs text-default-500 hover:text-default-700"
                                    >
                                      + contrat
                                    </button>
                                  )}
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
                        {isAdvance && (
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
                        )}
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
                <label className="block text-sm font-medium text-default-700 mb-2">
                  Part artiste: {(parseFloat(artistShare) * 100).toFixed(0)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={artistShare}
                  onChange={(e) => setArtistShare(e.target.value)}
                  className="w-full h-2 bg-default-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-sm text-default-500 mt-2">
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
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3">
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
                <button onClick={() => setShowEditArtwork(false)} className="p-2 -mr-2 text-default-500">
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
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3">
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
    </div>
  );
}
