'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Spinner } from '@heroui/react';
import {
  getContracts,
  createContract,
  updateContract,
  deleteContract,
  getArtists,
  ContractData,
  ContractParty,
  Artist,
  CatalogRelease,
  CatalogTrack,
  searchAlbumByUPC,
  searchTrackByISRC,
  getReleaseMetadata,
  refreshReleaseMetadata,
  batchRefreshReleases,
  getArtistReleases,
  getArtistTracks,
} from '@/lib/api';
import { Card, Eyebrow, Pill, Avatar, AccentButton, OutlineButton } from '@/components/roy/ui';
import { IconPlus } from '@/components/roy/icons';
import { ContractContributorsModal } from '@/components/contracts/ContractContributorsModal';

interface ScopeInfo {
  name?: string;
  image_url?: string;
  image_url_small?: string;
  release_date?: string;
}

// Map contract scope onto a readable "deal type" label for the premium table.
const SCOPE_TYPE_LABELS: Record<ContractData['scope'], string> = {
  catalog: 'Licence excl.',
  release: 'Distribution',
  track: 'Single deal',
};

// Format an end date like "déc. 2027". Returns "—" when none.
function formatEcheance(endDate?: string): string {
  if (!endDate) return '—';
  const d = new Date(endDate);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractData | null>(null);
  const [scopeInfo, setScopeInfo] = useState<Record<string, ScopeInfo>>({});
  const [saving, setSaving] = useState(false);
  const [artistFilter, setArtistFilter] = useState<string>('');
  const [noEndDateFilter, setNoEndDateFilter] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ updated: number; errors: string[] } | null>(null);
  const [refreshingMetadata, setRefreshingMetadata] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [contributorsContract, setContributorsContract] = useState<ContractData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [artistId, setArtistId] = useState('');
  const [scope, setScope] = useState<'track' | 'release' | 'catalog'>('catalog');
  const [scopeId, setScopeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState<string>(''); // Duration in years
  const [description, setDescription] = useState('');
  const [parties, setParties] = useState<ContractParty[]>([
    { party_type: 'artist', artist_id: '', share_percentage: '0.5' },
    { party_type: 'label', label_name: '', share_percentage: '0.5' },
  ]);
  const [formScopeInfo, setFormScopeInfo] = useState<{ name?: string; image_url?: string; release_date?: string } | null>(null);
  const [loadingFormScope, setLoadingFormScope] = useState(false);
  // Catalog picker state
  const [scopeInputMode, setScopeInputMode] = useState<'catalog' | 'manual'>('catalog');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogReleases, setCatalogReleases] = useState<CatalogRelease[]>([]);
  const [catalogTracks, setCatalogTracks] = useState<CatalogTrack[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  // Calculate end date when start date or duration changes
  const handleDurationChange = (newDuration: string) => {
    setDuration(newDuration);
    if (startDate && newDuration) {
      const years = parseFloat(newDuration);
      if (!isNaN(years) && years > 0) {
        const start = new Date(startDate);
        const end = new Date(start);
        end.setFullYear(end.getFullYear() + Math.floor(years));
        // Handle fractional years (months)
        const months = Math.round((years % 1) * 12);
        end.setMonth(end.getMonth() + months);
        setEndDate(end.toISOString().split('T')[0]);
      }
    }
  };

  // Calculate duration when end date changes manually
  const handleEndDateChange = (newEndDate: string) => {
    setEndDate(newEndDate);
    if (startDate && newEndDate) {
      const start = new Date(startDate);
      const end = new Date(newEndDate);
      const diffYears = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (diffYears > 0) {
        setDuration(diffYears.toFixed(1));
      } else {
        setDuration('');
      }
    }
  };

  // Recalculate end date when start date changes (if duration is set)
  const handleStartDateChange = (newStartDate: string) => {
    setStartDate(newStartDate);
    if (duration && newStartDate) {
      const years = parseFloat(duration);
      if (!isNaN(years) && years > 0) {
        const start = new Date(newStartDate);
        const end = new Date(start);
        end.setFullYear(end.getFullYear() + Math.floor(years));
        const months = Math.round((years % 1) * 12);
        end.setMonth(end.getMonth() + months);
        setEndDate(end.toISOString().split('T')[0]);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Load catalog entries when artist + scope changes (for the picker)
  useEffect(() => {
    if (!artistId || scope === 'catalog') {
      setCatalogReleases([]);
      setCatalogTracks([]);
      return;
    }
    const artistName = artists.find(a => a.id === artistId)?.name;
    if (!artistName) return;

    setLoadingCatalog(true);
    const fetch = scope === 'release'
      ? getArtistReleases(artistName).then(data => { setCatalogReleases(data); setCatalogTracks([]); })
      : getArtistTracks(artistName).then(data => { setCatalogTracks(data); setCatalogReleases([]); });
    fetch.catch(() => {}).finally(() => setLoadingCatalog(false));
  }, [artistId, scope, artists]);

  // Fetch album/track info when scopeId changes to auto-fill release date
  // Try database first, then refresh from Spotify if not found
  useEffect(() => {
    if (!scopeId || scopeId.length < 5) {
      setFormScopeInfo(null);
      return;
    }

    const fetchScopeInfo = async () => {
      setLoadingFormScope(true);
      try {
        if (scope === 'release') {
          // Try to get from database first
          let metadata = await getReleaseMetadata(scopeId);

          // If not found in DB, refresh from Spotify and save to DB
          if (!metadata.found || !metadata.release_date) {
            await refreshReleaseMetadata(scopeId);
            metadata = await getReleaseMetadata(scopeId);
          }

          if (metadata.found && metadata.name) {
            setFormScopeInfo({
              name: metadata.name,
              image_url: metadata.image_url_small || metadata.image_url,
              release_date: metadata.release_date,
            });
            // Auto-fill start date with release date if not already set
            if (metadata.release_date && !startDate) {
              setStartDate(metadata.release_date);
            }
          } else {
            // Fallback to direct Spotify search
            const albumData = await searchAlbumByUPC(scopeId);
            if (albumData.name) {
              setFormScopeInfo({
                name: albumData.name,
                image_url: albumData.image_url_small || albumData.image_url,
                release_date: albumData.release_date,
              });
              if (albumData.release_date && !startDate) {
                setStartDate(albumData.release_date);
              }
            } else {
              setFormScopeInfo(null);
            }
          }
        } else if (scope === 'track') {
          const trackData = await searchTrackByISRC(scopeId);
          if (trackData.name) {
            setFormScopeInfo({
              name: trackData.name,
              image_url: trackData.image_url_small || trackData.image_url,
            });
          } else {
            setFormScopeInfo(null);
          }
        }
      } catch (e) {
        console.error('Failed to fetch scope info:', e);
        setFormScopeInfo(null);
      } finally {
        setLoadingFormScope(false);
      }
    };

    const debounce = setTimeout(fetchScopeInfo, 500);
    return () => clearTimeout(debounce);
  }, [scopeId, scope]);

  const loadData = async () => {
    try {
      const [contractsData, artistsData] = await Promise.all([
        getContracts(),
        getArtists(),
      ]);
      setContracts(contractsData);
      setArtists(artistsData);

      // Load names, artworks and release dates from database (cached Spotify data)
      const info: Record<string, ScopeInfo> = {};
      const releaseUPCs = contractsData
        .filter(c => c.scope === 'release' && c.scope_id)
        .map(c => c.scope_id!);
      const trackISRCs = contractsData
        .filter(c => c.scope === 'track' && c.scope_id)
        .map(c => c.scope_id!);

      // Load release metadata from database
      for (const upc of releaseUPCs) {
        try {
          const metadata = await getReleaseMetadata(upc);
          if (metadata.found && metadata.name && metadata.name !== upc) {
            info[upc] = {
              name: metadata.name,
              image_url: metadata.image_url,
              image_url_small: metadata.image_url_small,
              release_date: metadata.release_date,
            };
          } else {
            // Fallback to Spotify search if not in DB
            const albumData = await searchAlbumByUPC(upc);
            const hasValidName = albumData.name && albumData.name !== upc;
            info[upc] = {
              name: hasValidName ? albumData.name : undefined,
              image_url: albumData.image_url,
              image_url_small: albumData.image_url_small,
              release_date: albumData.release_date,
            };
          }
        } catch (e) {
          console.error(`Failed to load info for ${upc}:`, e);
          info[upc] = { name: undefined };
        }
      }

      // Load track metadata
      for (const isrc of trackISRCs) {
        try {
          const trackData = await searchTrackByISRC(isrc);
          const hasValidName = trackData.name && trackData.name !== isrc;
          info[isrc] = {
            name: hasValidName ? trackData.name : undefined,
            image_url: trackData.image_url,
            image_url_small: trackData.image_url_small,
          };
        } catch (e) {
          console.error(`Failed to load info for ${isrc}:`, e);
          info[isrc] = { name: undefined };
        }
      }

      setScopeInfo(info);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoadError(error instanceof Error ? error.message : 'Erreur de chargement des contrats');
    } finally {
      setLoading(false);
    }
  };

  // Filter contracts by artist and end date
  const filteredContracts = useMemo(() => {
    let filtered = contracts;
    if (artistFilter) {
      filtered = filtered.filter(c => c.artist_id === artistFilter);
    }
    if (noEndDateFilter) {
      filtered = filtered.filter(c => !c.end_date);
    }
    return filtered;
  }, [contracts, artistFilter, noEndDateFilter]);

  // Count contracts without end date
  const contractsWithoutEndDate = useMemo(() => {
    return contracts.filter(c => !c.end_date).length;
  }, [contracts]);

  // Filtered catalog picker items
  const filteredCatalogItems = useMemo(() => {
    const q = catalogSearch.toLowerCase();
    if (scope === 'release') {
      return catalogReleases.filter(r =>
        !q || r.release_title.toLowerCase().includes(q) || r.upc.includes(q)
      );
    }
    return catalogTracks.filter(t =>
      !q || t.track_title.toLowerCase().includes(q) || t.release_title.toLowerCase().includes(q) || t.isrc.toLowerCase().includes(q)
    );
  }, [catalogReleases, catalogTracks, catalogSearch, scope]);

  // Get unique artists from contracts for the filter
  const contractArtists = useMemo(() => {
    const artistIds = new Set(contracts.map(c => c.artist_id));
    return artists.filter(a => artistIds.has(a.id));
  }, [contracts, artists]);

  const handleOpenModal = (contract?: ContractData) => {
    if (contract) {
      setEditingContract(contract);
      setArtistId(contract.artist_id);
      setScope(contract.scope);
      setScopeId(contract.scope_id || '');
      setStartDate(contract.start_date);
      setEndDate(contract.end_date || '');
      setDescription(contract.description || '');
      setParties(contract.parties);
      // Calculate duration from dates
      if (contract.start_date && contract.end_date) {
        const start = new Date(contract.start_date);
        const end = new Date(contract.end_date);
        const diffYears = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        setDuration(diffYears > 0 ? diffYears.toFixed(1) : '');
      } else {
        setDuration('');
      }
    } else {
      resetForm();
    }
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingContract(null);
    setArtistId('');
    setScope('catalog');
    setScopeId('');
    setStartDate('');
    setEndDate('');
    setDuration('');
    setDescription('');
    setParties([
      { party_type: 'artist', artist_id: '', share_percentage: '0.5' },
      { party_type: 'label', label_name: '', share_percentage: '0.5' },
    ]);
    setFormScopeInfo(null);
    setScopeInputMode('catalog');
    setCatalogSearch('');
    setCatalogReleases([]);
    setCatalogTracks([]);
  };

  const handleAddParty = (type: string) => {
    setParties([...parties, { party_type: type as any, artist_id: '', label_name: '', share_percentage: '0' }]);
  };

  const handleRemoveParty = (index: number) => {
    setParties(parties.filter((_, i) => i !== index));
  };

  const handlePartyChange = (index: number, field: keyof ContractParty, value: any) => {
    const newParties = [...parties];
    newParties[index] = { ...newParties[index], [field]: value };
    setParties(newParties);
  };

  const handleScopeChange = (newScope: 'track' | 'release' | 'catalog') => {
    setScope(newScope);
    setScopeId('');
    setFormScopeInfo(null);
    setCatalogSearch('');
    setScopeInputMode('catalog');
  };

  const totalShare = parties.reduce((sum, p) => sum + parseFloat(p.share_percentage || '0'), 0);

  const handleSubmit = async () => {
    if (!artistId || !startDate || parties.length === 0) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (Math.abs(totalShare - 1) > 0.0001) {
      alert(`Les pourcentages doivent totaliser 100% (actuellement: ${(totalShare * 100).toFixed(2)}%)`);
      return;
    }

    try {
      setSaving(true);
      const data: any = {
        artist_id: artistId,
        scope,
        scope_id: scopeId || undefined,
        start_date: startDate,
        end_date: endDate || undefined,
        description: description || undefined,
        parties: parties.map(p => ({
          party_type: p.party_type,
          artist_id: p.party_type === 'artist' ? p.artist_id : undefined,
          label_name: p.party_type !== 'artist' ? p.label_name : undefined,
          share_percentage: p.share_percentage,
          contact_email: p.contact_email || undefined,
          contact_phone: p.contact_phone || undefined,
        })),
      };

      if (editingContract) {
        await updateContract(editingContract.id!, data);
      } else {
        await createContract(data);
      }

      setIsModalOpen(false);
      loadData();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce contrat ?')) return;
    try {
      await deleteContract(id);
      loadData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  // Export contracts to CSV
  const exportContracts = () => {
    setExporting(true);

    try {
      const rows: string[][] = [];

      // Header row
      rows.push([
        'ID',
        'Artiste',
        'Portee',
        'Code (UPC/ISRC)',
        'Nom',
        'Date debut',
        'Date fin',
        'Description',
        'Parties (Artistes)',
        'Parts Artistes (%)',
        'Parties (Labels)',
        'Parts Labels (%)',
      ]);

      // Data rows
      for (const contract of filteredContracts) {
        const artist = artists.find(a => a.id === contract.artist_id);
        const currentScopeInfo = contract.scope_id ? scopeInfo[contract.scope_id] : null;

        let scopeLabel = '';
        if (contract.scope === 'catalog') {
          scopeLabel = 'Catalogue';
        } else if (contract.scope === 'release') {
          scopeLabel = 'Release';
        } else if (contract.scope === 'track') {
          scopeLabel = 'Track';
        }

        const artistParties = contract.parties.filter(p => p.party_type === 'artist');
        const labelParties = contract.parties.filter(p => p.party_type === 'label');

        const artistNames = artistParties
          .map(p => artists.find(a => a.id === p.artist_id)?.name || 'Inconnu')
          .join(', ');
        const artistShares = artistParties
          .map(p => `${(parseFloat(p.share_percentage) * 100).toFixed(1)}%`)
          .join(', ');
        const labelNames = labelParties
          .map(p => p.label_name || 'Inconnu')
          .join(', ');
        const labelShares = labelParties
          .map(p => `${(parseFloat(p.share_percentage) * 100).toFixed(1)}%`)
          .join(', ');

        rows.push([
          contract.id || '',
          artist?.name || 'Inconnu',
          scopeLabel,
          contract.scope_id || '',
          currentScopeInfo?.name || '',
          contract.start_date,
          contract.end_date || '',
          contract.description || '',
          artistNames,
          artistShares,
          labelNames,
          labelShares,
        ]);
      }

      // Convert to CSV
      const csvContent = rows
        .map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
        .join('\n');

      // Download file
      const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contrats_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
      alert('Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  // Import contracts from CSV
  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').map(line => {
        // Parse CSV line handling quoted fields
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      });

      if (lines.length < 2) {
        throw new Error('Le fichier CSV est vide ou invalide');
      }

      const headers = lines[0].map(h => h.toLowerCase().trim());
      const idIndex = headers.findIndex(h => h === 'id');
      const endDateIndex = headers.findIndex(h => h.includes('date fin'));
      const startDateIndex = headers.findIndex(h => h.includes('date debut'));
      const descriptionIndex = headers.findIndex(h => h === 'description');

      if (idIndex === -1) {
        throw new Error('Colonne "ID" non trouvee dans le CSV');
      }

      let updated = 0;
      const errors: string[] = [];

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        if (row.length <= idIndex || !row[idIndex]) continue;

        const contractId = row[idIndex];
        const contract = contracts.find(c => c.id === contractId);

        if (!contract) {
          errors.push(`Ligne ${i + 1}: Contrat ID "${contractId}" non trouve`);
          continue;
        }

        // Build update data
        const updateData: Partial<ContractData> = {};
        let hasChanges = false;

        // Update end_date if present
        if (endDateIndex !== -1 && row[endDateIndex] !== undefined) {
          const newEndDate = row[endDateIndex].trim();
          const currentEndDate = contract.end_date || '';
          if (newEndDate !== currentEndDate) {
            updateData.end_date = newEndDate || undefined;
            hasChanges = true;
          }
        }

        // Update start_date if present
        if (startDateIndex !== -1 && row[startDateIndex] !== undefined) {
          const newStartDate = row[startDateIndex].trim();
          if (newStartDate && newStartDate !== contract.start_date) {
            updateData.start_date = newStartDate;
            hasChanges = true;
          }
        }

        // Update description if present
        if (descriptionIndex !== -1 && row[descriptionIndex] !== undefined) {
          const newDescription = row[descriptionIndex].trim();
          const currentDescription = contract.description || '';
          if (newDescription !== currentDescription) {
            updateData.description = newDescription || undefined;
            hasChanges = true;
          }
        }

        if (hasChanges) {
          try {
            await updateContract(contractId, updateData);
            updated++;
          } catch (e: any) {
            errors.push(`Ligne ${i + 1}: Erreur lors de la mise a jour - ${e.message}`);
          }
        }
      }

      setImportResult({ updated, errors });
      if (updated > 0) {
        loadData(); // Reload contracts
      }
    } catch (e: any) {
      alert(`Erreur lors de l'import: ${e.message}`);
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Refresh all release metadata from Spotify and save to database
  const refreshAllMetadata = async () => {
    const releaseUPCs = contracts
      .filter(c => c.scope === 'release' && c.scope_id)
      .map(c => c.scope_id!);

    if (releaseUPCs.length === 0) {
      alert('Aucun contrat avec UPC a rafraichir');
      return;
    }

    setRefreshingMetadata(true);
    try {
      const result = await batchRefreshReleases(releaseUPCs);
      alert(`${result.success_count} album(s) mis a jour depuis Spotify`);
      // Reload data to get updated metadata
      await loadData();
    } catch (e) {
      console.error('Failed to refresh metadata:', e);
      alert('Erreur lors du rafraichissement');
    } finally {
      setRefreshingMetadata(false);
    }
  };

  // Synchronize all contract start dates with release dates
  const syncStartDates = async () => {
    const releaseContracts = contracts.filter(c => c.scope === 'release' && c.scope_id);

    if (releaseContracts.length === 0) {
      alert('Aucun contrat avec release a synchroniser');
      return;
    }

    if (!confirm(`Synchroniser les dates de debut de ${releaseContracts.length} contrat(s) avec les dates de release des albums ?`)) {
      return;
    }

    setRefreshingMetadata(true);
    let updated = 0;
    let errors = 0;

    try {
      for (const contract of releaseContracts) {
        try {
          // Get release metadata from database
          let metadata = await getReleaseMetadata(contract.scope_id!);

          // If no release date in DB, refresh from Spotify
          if (!metadata.found || !metadata.release_date) {
            await refreshReleaseMetadata(contract.scope_id!);
            metadata = await getReleaseMetadata(contract.scope_id!);
          }

          if (metadata.release_date && metadata.release_date !== contract.start_date) {
            // Update contract with release date
            await updateContract(contract.id!, { start_date: metadata.release_date });
            updated++;
          }
        } catch (e) {
          console.error(`Failed to sync contract ${contract.id}:`, e);
          errors++;
        }
      }

      alert(`${updated} contrat(s) mis a jour${errors > 0 ? `, ${errors} erreur(s)` : ''}`);
      // Reload data
      await loadData();
    } catch (e) {
      console.error('Failed to sync dates:', e);
      alert('Erreur lors de la synchronisation');
    } finally {
      setRefreshingMetadata(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <div>
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Contrats</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">
            Accords et échéances ·{' '}
            {filteredContracts.length} contrat{filteredContracts.length > 1 ? 's' : ''}
            {(artistFilter || noEndDateFilter) && ' (filtre actif)'}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Filter: no end date */}
          {contractsWithoutEndDate > 0 && (
            <button
              onClick={() => setNoEndDateFilter(!noEndDateFilter)}
              className={`inline-flex items-center gap-1.5 rounded-[10px] border px-3.5 py-2 text-[12px] font-semibold transition-colors ${
                noEndDateFilter
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-line-strong bg-surface text-ink hover:bg-surface-2'
              }`}
            >
              Sans échéance ({contractsWithoutEndDate})
            </button>
          )}
          {/* Artist filter */}
          {contractArtists.length > 0 && (
            <select
              value={artistFilter}
              onChange={(e) => setArtistFilter(e.target.value)}
              className="h-[38px] px-3.5 rounded-[10px] border border-line-strong bg-surface text-[12px] font-semibold text-ink focus:outline-none focus:border-accent transition-colors min-w-[170px]"
            >
              <option value="">Tous les artistes</option>
              {contractArtists.map((artist) => (
                <option key={artist.id} value={artist.id}>{artist.name}</option>
              ))}
            </select>
          )}
          {/* Hidden file input for CSV import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleImportCSV}
            className="hidden"
            disabled={importing}
          />
          {/* Actions dropdown */}
          <div className="relative">
            <OutlineButton onClick={() => setActionsOpen(!actionsOpen)}>
              {(refreshingMetadata || exporting || importing) && <Spinner size="sm" />}
              Actions
              <svg className={`w-3.5 h-3.5 transition-transform ${actionsOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </OutlineButton>
            {actionsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setActionsOpen(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-surface border border-line rounded-[12px] shadow-roy z-50 overflow-hidden">
                  <button
                    onClick={() => { refreshAllMetadata(); setActionsOpen(false); }}
                    disabled={refreshingMetadata}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[12.5px] font-medium text-ink hover:bg-surface-2 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Rafraîchir métadonnées
                  </button>
                  <button
                    onClick={() => { syncStartDates(); setActionsOpen(false); }}
                    disabled={refreshingMetadata}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[12.5px] font-medium text-ink hover:bg-surface-2 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 text-ink-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Synchro dates de fin
                  </button>
                  <div className="border-t border-line" />
                  <button
                    onClick={() => { exportContracts(); setActionsOpen(false); }}
                    disabled={exporting || filteredContracts.length === 0}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[12.5px] font-medium text-ink hover:bg-surface-2 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Exporter CSV
                  </button>
                  <button
                    onClick={() => { fileInputRef.current?.click(); setActionsOpen(false); }}
                    disabled={importing}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[12.5px] font-medium text-ink hover:bg-surface-2 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Importer CSV
                  </button>
                </div>
              </>
            )}
          </div>
          <AccentButton onClick={() => handleOpenModal()}>
            <IconPlus size={14} /> Nouveau contrat
          </AccentButton>
        </div>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {/* Load error */}
        {loadError && (
          <div className="p-4 rounded-[12px] bg-neg/10 border border-neg/30 text-neg text-[13px] flex items-center justify-between">
            <span>{loadError}</span>
            <button onClick={() => setLoadError(null)} className="ml-4 underline shrink-0">Fermer</button>
          </div>
        )}

        {/* Import result notification */}
        {importResult && (
          <div className={`p-4 rounded-[12px] border ${importResult.errors.length > 0 ? 'bg-surface-2 border-line-strong' : 'bg-accent-soft border-accent/30'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`text-[13px] font-semibold ${importResult.errors.length > 0 ? 'text-ink' : 'text-accent'}`}>
                  {importResult.updated} contrat{importResult.updated > 1 ? 's' : ''} mis a jour
                </p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 text-[12.5px] text-ink-muted">
                    <p className="font-medium mb-1">{importResult.errors.length} erreur{importResult.errors.length > 1 ? 's' : ''} :</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {importResult.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {importResult.errors.length > 5 && (
                        <li>... et {importResult.errors.length - 5} autre{importResult.errors.length - 5 > 1 ? 's' : ''}</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
              <button
                onClick={() => setImportResult(null)}
                className="p-1 text-ink-faint hover:text-ink"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {contracts.length === 0 ? (
          <Card className="py-12 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-[14px] bg-surface-2 flex items-center justify-center">
              <svg className="w-7 h-7 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-[15px] font-semibold text-ink mb-1">Aucun contrat</h3>
            <p className="text-ink-faint text-[13px] mb-6">Commencez par creer un contrat pour definir les parts artiste/label</p>
            <div className="flex justify-center">
              <AccentButton onClick={() => handleOpenModal()}>
                <IconPlus size={14} /> Creer un contrat
              </AccentButton>
            </div>
          </Card>
        ) : filteredContracts.length === 0 ? (
          <Card className="py-12 text-center">
            <p className="text-ink-muted text-[13px]">Aucun contrat pour ce filtre</p>
            <div className="flex justify-center mt-4">
              <OutlineButton onClick={() => { setArtistFilter(''); setNoEndDateFilter(false); }}>
                Effacer le filtre
              </OutlineButton>
            </div>
          </Card>
        ) : (
          <Card padded={false} className="overflow-hidden">
            {/* Header row */}
            <div className="grid grid-cols-[1.8fr_1.1fr_0.8fr_1.2fr_0.9fr] px-[22px] py-3 border-b border-line">
              <Eyebrow className="text-[10px]">Artiste</Eyebrow>
              <Eyebrow className="text-[10px]">Type</Eyebrow>
              <Eyebrow className="text-[10px] text-right">Taux</Eyebrow>
              <Eyebrow className="text-[10px] text-right">Échéance</Eyebrow>
              <Eyebrow className="text-[10px] text-center">Statut</Eyebrow>
            </div>

            {/* Rows */}
            {filteredContracts.map((contract) => {
              const artist = artists.find(a => a.id === contract.artist_id);
              const currentScopeInfo = contract.scope_id ? scopeInfo[contract.scope_id] : null;

              // Artist name: prefer the linked artist, then the scope title (album/track), then artist party label.
              const artistParty = contract.parties.find(p => p.party_type === 'artist' && p.artist_id);
              const partyArtistName = artistParty
                ? artists.find(a => a.id === artistParty.artist_id)?.name
                : undefined;
              const artistName =
                artist?.name ||
                currentScopeInfo?.name ||
                partyArtistName ||
                'Artiste inconnu';

              // Avatar art: artist image for catalog scope, otherwise release/track artwork.
              const avatarSrc = contract.scope === 'catalog'
                ? artist?.image_url_small || artist?.image_url
                : currentScopeInfo?.image_url_small || currentScopeInfo?.image_url;

              // Active/signed = no end date OR an end date still in the future.
              const isActive = !contract.end_date || new Date(contract.end_date).getTime() >= Date.now();

              // Taux = total of artist parties' shares (artist royalty rate).
              const artistShareTotal = contract.parties
                .filter(p => p.party_type === 'artist')
                .reduce((sum, p) => sum + parseFloat(p.share_percentage || '0'), 0);
              const tauxLabel = artistShareTotal > 0
                ? `${(artistShareTotal * 100).toFixed(artistShareTotal * 100 % 1 === 0 ? 0 : 1)} %`
                : '—';

              const typeLabel = SCOPE_TYPE_LABELS[contract.scope] ?? 'Contrat';

              return (
                <div
                  key={contract.id}
                  onClick={() => handleOpenModal(contract)}
                  className="group grid grid-cols-[1.8fr_1.1fr_0.8fr_1.2fr_0.9fr] items-center px-[22px] py-3.5 border-b border-line last:border-0 hover:bg-surface-2 transition-colors cursor-pointer"
                >
                  {/* Artiste */}
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Avatar name={artistName} src={avatarSrc} size={30} accent={isActive} />
                    <span className="text-[13.5px] font-semibold text-ink truncate">{artistName}</span>
                  </span>

                  {/* Type */}
                  <span className="text-[12.5px] text-ink-muted truncate">{typeLabel}</span>

                  {/* Taux */}
                  <span className="text-right roy-num text-[13px] text-ink-muted">{tauxLabel}</span>

                  {/* Échéance */}
                  <span className="text-right roy-num text-[13px] text-ink-muted">{formatEcheance(contract.end_date)}</span>

                  {/* Statut + actions */}
                  <span className="flex items-center justify-center gap-2">
                    {isActive ? (
                      <Pill tone="accent">Signé</Pill>
                    ) : (
                      <Pill tone="neutral">Renouv.</Pill>
                    )}
                    <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); setContributorsContract(contract); }}
                        title="Répartition par titre"
                        className="p-1.5 text-ink-faint hover:text-ink hover:bg-surface rounded-[8px] transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenModal(contract); }}
                        title="Modifier"
                        className="p-1.5 text-ink-faint hover:text-ink hover:bg-surface rounded-[8px] transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(contract.id!); }}
                        title="Supprimer"
                        className="p-1.5 text-ink-faint hover:text-neg hover:bg-surface rounded-[8px] transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </span>
                  </span>
                </div>
              );
            })}
          </Card>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-surface w-full sm:max-w-2xl sm:rounded-[16px] rounded-t-[16px] max-h-[90vh] overflow-hidden flex flex-col border border-line shadow-roy">
            <div className="px-4 py-4 sm:px-6 border-b border-line shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-ink">
                  {editingContract ? 'Modifier le contrat' : 'Nouveau contrat'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 -mr-2 text-ink-faint hover:text-ink">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
              {/* Artist selection */}
              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-2">
                  Artiste principal <span className="text-neg">*</span>
                </label>
                <select
                  value={artistId}
                  onChange={(e) => setArtistId(e.target.value)}
                  className="w-full h-12 px-4 bg-surface border border-line-strong rounded-[12px] text-ink focus:outline-none focus:border-accent transition-colors"
                >
                  <option value="">Selectionner un artiste</option>
                  {artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>{artist.name}</option>
                  ))}
                </select>
              </div>

              {/* Scope */}
              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-2">
                  Portee du contrat <span className="text-neg">*</span>
                </label>
                <select
                  value={scope}
                  onChange={(e) => handleScopeChange(e.target.value as any)}
                  className="w-full h-12 px-4 bg-surface border border-line-strong rounded-[12px] text-ink focus:outline-none focus:border-accent transition-colors"
                >
                  <option value="catalog">Tout le catalogue</option>
                  <option value="release">Release specifique (UPC)</option>
                  <option value="track">Track specifique (ISRC)</option>
                </select>
              </div>

              {/* Scope ID — catalog picker or manual */}
              {scope !== 'catalog' && (
                <div>
                  <label className="block text-[12.5px] font-medium text-ink mb-2">
                    {scope === 'track' ? 'Piste' : 'Release'} <span className="text-neg">*</span>
                  </label>

                  {/* Mode toggle */}
                  <div className="flex gap-1 p-1 bg-surface-2 rounded-[12px] mb-3">
                    <button
                      type="button"
                      onClick={() => setScopeInputMode('catalog')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium rounded-[8px] transition-all ${scopeInputMode === 'catalog' ? 'bg-surface text-ink shadow-roy' : 'text-ink-faint hover:text-ink'}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Choisir dans le catalogue
                    </button>
                    <button
                      type="button"
                      onClick={() => setScopeInputMode('manual')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[12px] font-medium rounded-[8px] transition-all ${scopeInputMode === 'manual' ? 'bg-surface text-ink shadow-roy' : 'text-ink-faint hover:text-ink'}`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Saisir {scope === 'track' ? 'un ISRC' : 'un UPC'}
                    </button>
                  </div>

                  {scopeInputMode === 'catalog' ? (
                    <div>
                      {/* Search box */}
                      <div className="relative mb-2">
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          placeholder={scope === 'release' ? 'Rechercher un album...' : 'Rechercher une piste...'}
                          value={catalogSearch}
                          onChange={(e) => setCatalogSearch(e.target.value)}
                          className="w-full h-10 pl-9 pr-4 bg-surface border border-line-strong rounded-[12px] text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors"
                        />
                      </div>

                      {/* Catalog list */}
                      <div className="border border-line-strong rounded-[12px] overflow-hidden max-h-52 overflow-y-auto">
                        {loadingCatalog ? (
                          <div className="flex items-center justify-center py-6 gap-2 text-[13px] text-ink-faint">
                            <Spinner size="sm" /> Chargement...
                          </div>
                        ) : !artistId ? (
                          <p className="text-center py-6 text-[13px] text-ink-faint">Selectionnez d'abord un artiste</p>
                        ) : filteredCatalogItems.length === 0 ? (
                          <p className="text-center py-6 text-[13px] text-ink-faint">
                            {catalogSearch ? 'Aucun résultat' : 'Aucune entrée dans le catalogue'}
                          </p>
                        ) : (
                          filteredCatalogItems.map((item, i) => {
                            const id = scope === 'release' ? (item as CatalogRelease).upc : (item as CatalogTrack).isrc;
                            const title = scope === 'release' ? (item as CatalogRelease).release_title : (item as CatalogTrack).track_title;
                            const subtitle = scope === 'release' ? (item as CatalogRelease).upc : `${(item as CatalogTrack).release_title} · ${(item as CatalogTrack).isrc}`;
                            const isSelected = scopeId === id;
                            return (
                              <button
                                key={i}
                                type="button"
                                onClick={() => { setScopeId(id); setCatalogSearch(''); }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 transition-colors border-b border-line last:border-0 ${isSelected ? 'bg-accent-soft' : ''}`}
                              >
                                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'border-accent bg-accent' : 'border-line-strong'}`}>
                                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-accent-ink" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-medium text-ink truncate">{title}</p>
                                  <p className="text-[11px] text-ink-faint truncate">{subtitle}</p>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    <input
                      type="text"
                      placeholder={scope === 'track' ? 'Ex: USRC17607839' : 'Ex: 0123456789012'}
                      value={scopeId}
                      onChange={(e) => setScopeId(e.target.value)}
                      className="w-full h-12 px-4 bg-surface border border-line-strong rounded-[12px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors"
                    />
                  )}

                  {/* Album/Track preview (shown in both modes) */}
                  {loadingFormScope && (
                    <div className="mt-2 flex items-center gap-2 text-[13px] text-ink-muted">
                      <Spinner size="sm" />
                      Recherche...
                    </div>
                  )}
                  {formScopeInfo && !loadingFormScope && (
                    <div className="mt-3 p-3 bg-surface-2 rounded-[12px] flex items-center gap-3">
                      {formScopeInfo.image_url && (
                        <img
                          src={formScopeInfo.image_url}
                          alt={formScopeInfo.name}
                          className="w-12 h-12 rounded-[10px] object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-ink truncate">{formScopeInfo.name}</p>
                        {formScopeInfo.release_date && (
                          <p className="text-[12.5px] text-ink-muted">
                            Sortie : {formScopeInfo.release_date}
                          </p>
                        )}
                      </div>
                      {formScopeInfo.release_date && (
                        <button
                          type="button"
                          onClick={() => setStartDate(formScopeInfo.release_date!)}
                          className="px-3 py-1.5 text-[11px] font-semibold text-accent bg-accent-soft rounded-full hover:opacity-90 transition-opacity whitespace-nowrap"
                        >
                          Utiliser cette date
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[12.5px] font-medium text-ink mb-2">
                    Date de debut <span className="text-neg">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full h-12 px-4 bg-surface border border-line-strong rounded-[12px] text-ink focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-ink mb-2">
                    Duree (annees)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="Ex: 3"
                    value={duration}
                    onChange={(e) => handleDurationChange(e.target.value)}
                    className="w-full h-12 px-4 bg-surface border border-line-strong rounded-[12px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[12.5px] font-medium text-ink mb-2">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="w-full h-12 px-4 bg-surface border border-line-strong rounded-[12px] text-ink focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[12.5px] font-medium text-ink mb-2">
                  Description
                </label>
                <textarea
                  placeholder="Notes ou details supplementaires..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-surface border border-line-strong rounded-[12px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors resize-none"
                />
              </div>

              {/* Parties */}
              <div className="border-t border-line pt-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[13.5px] font-semibold text-ink">
                    Repartition des parts
                    <span className={`ml-2 text-[12.5px] font-bold ${Math.abs(totalShare - 1) < 0.0001 ? 'text-accent' : 'text-neg'}`}>
                      ({(totalShare * 100).toFixed(1)}%)
                    </span>
                  </h3>
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { type: 'artist', label: 'Artiste' },
                      { type: 'label', label: 'Label' },
                      { type: 'manager', label: 'Manager' },
                      { type: 'booker', label: 'Booker' },
                      { type: 'agent', label: 'Agent' },
                      { type: 'publisher', label: 'Editeur' },
                    ].map(({ type, label }) => (
                      <button
                        key={type}
                        onClick={() => handleAddParty(type)}
                        className="px-2.5 py-1 text-[10px] font-semibold rounded-full bg-surface-2 text-ink-muted hover:bg-accent-soft hover:text-accent transition-colors"
                      >
                        + {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {parties.map((party, index) => (
                    <div key={index} className="flex gap-3 items-start p-4 rounded-[12px] border border-line bg-surface-2">
                      <div className="flex-1 space-y-2">
                        {party.party_type === 'artist' ? (
                          <div>
                            <label className="block text-[11px] font-medium text-ink-muted mb-1.5">Artiste</label>
                            <select
                              value={party.artist_id || ''}
                              onChange={(e) => handlePartyChange(index, 'artist_id', e.target.value)}
                              className="w-full h-10 px-3 bg-surface border border-line-strong rounded-[10px] text-[13px] text-ink focus:outline-none focus:border-accent transition-colors"
                            >
                              <option value="">Selectionner</option>
                              {artists.map((artist) => (
                                <option key={artist.id} value={artist.id}>{artist.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[11px] font-medium text-ink-muted mb-1.5">
                              {party.party_type === 'label' ? 'Nom du label' :
                               party.party_type === 'manager' ? 'Nom du manager' :
                               party.party_type === 'booker' ? 'Nom du booker' :
                               party.party_type === 'agent' ? 'Nom de l\'agent' :
                               party.party_type === 'publisher' ? 'Nom de l\'editeur' : 'Nom'}
                            </label>
                            <input
                              type="text"
                              placeholder="Nom ou societe"
                              value={party.label_name || ''}
                              onChange={(e) => handlePartyChange(index, 'label_name', e.target.value)}
                              className="w-full h-10 px-3 bg-surface border border-line-strong rounded-[10px] text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors"
                            />
                            {/* Contact fields for intermediaries */}
                            {party.party_type !== 'label' && (
                              <div className="flex gap-2 mt-2">
                                <input
                                  type="email"
                                  placeholder="Email"
                                  value={party.contact_email || ''}
                                  onChange={(e) => handlePartyChange(index, 'contact_email', e.target.value)}
                                  className="flex-1 h-8 px-2 bg-surface border border-line rounded-[10px] text-[11px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors"
                                />
                                <input
                                  type="tel"
                                  placeholder="Tel"
                                  value={party.contact_phone || ''}
                                  onChange={(e) => handlePartyChange(index, 'contact_phone', e.target.value)}
                                  className="w-32 h-8 px-2 bg-surface border border-line rounded-[10px] text-[11px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-accent transition-colors"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="w-24">
                        <label className="block text-[11px] font-medium text-ink-muted mb-1.5">Part (%)</label>
                        <input
                          type="number"
                          placeholder="0-100"
                          min={0}
                          max={100}
                          step="any"
                          value={String(parseFloat(party.share_percentage || '0') * 100)}
                          onChange={(e) => handlePartyChange(index, 'share_percentage', String(parseFloat(e.target.value) / 100))}
                          className="w-full h-10 px-3 bg-surface border border-line-strong rounded-[10px] text-[13px] text-ink text-center focus:outline-none focus:border-accent transition-colors"
                        />
                      </div>
                      <div className="pt-6">
                        <button
                          onClick={() => handleRemoveParty(index)}
                          className="p-2 text-ink-faint hover:text-neg hover:bg-surface rounded-[10px] transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  {parties.length === 0 && (
                    <p className="text-center text-ink-faint py-8 text-[13px]">
                      Aucune partie ajoutee. Cliquez sur "+ Artiste" ou "+ Label" pour commencer.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-line flex gap-3 shrink-0">
              <OutlineButton onClick={() => setIsModalOpen(false)} className="flex-1 justify-center">
                Annuler
              </OutlineButton>
              <AccentButton onClick={handleSubmit} disabled={saving} className="flex-1">
                {saving && <Spinner size="sm" color="white" />}
                {editingContract ? 'Enregistrer' : 'Creer'}
              </AccentButton>
            </div>
          </div>
        </div>
      )}

      {contributorsContract && (
        <ContractContributorsModal
          contract={contributorsContract}
          albumName={contributorsContract.scope_id ? scopeInfo[contributorsContract.scope_id]?.name : undefined}
          onClose={() => setContributorsContract(null)}
        />
      )}
    </div>
  );
}
