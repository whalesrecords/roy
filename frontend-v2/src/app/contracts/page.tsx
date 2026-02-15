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
  searchAlbumByUPC,
  searchTrackByISRC,
  getReleaseMetadata,
  refreshReleaseMetadata,
  batchRefreshReleases,
} from '@/lib/api';

interface ScopeInfo {
  name?: string;
  image_url?: string;
  image_url_small?: string;
  release_date?: string;
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
  };

  const handleAddParty = (type: 'artist' | 'label') => {
    setParties([...parties, { party_type: type, artist_id: '', label_name: '', share_percentage: '0' }]);
  };

  const handleRemoveParty = (index: number) => {
    setParties(parties.filter((_, i) => i !== index));
  };

  const handlePartyChange = (index: number, field: keyof ContractParty, value: any) => {
    const newParties = [...parties];
    newParties[index] = { ...newParties[index], [field]: value };
    setParties(newParties);
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
          label_name: p.party_type === 'label' ? p.label_name : undefined,
          share_percentage: p.share_percentage,
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
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
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
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-md border-b border-divider sticky top-14 z-30">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Contrats</h1>
              <p className="text-secondary-500 text-sm mt-0.5">
                {filteredContracts.length} contrat{filteredContracts.length > 1 ? 's' : ''}
                {(artistFilter || noEndDateFilter) && ` (filtre actif)`}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Filter: no end date */}
              {contractsWithoutEndDate > 0 && (
                <button
                  onClick={() => setNoEndDateFilter(!noEndDateFilter)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                    noEndDateFilter
                      ? 'bg-warning-100 text-warning-700 border-2 border-warning-300'
                      : 'bg-content2 text-secondary-600 border-2 border-default-200 hover:bg-content3'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Sans date fin ({contractsWithoutEndDate})
                </button>
              )}
              {/* Artist filter */}
              {contractArtists.length > 0 && (
                <select
                  value={artistFilter}
                  onChange={(e) => setArtistFilter(e.target.value)}
                  className="h-10 px-4 bg-background border-2 border-default-200 rounded-full text-sm text-foreground focus:outline-none focus:border-primary transition-colors min-w-[180px]"
                >
                  <option value="">Tous les artistes</option>
                  {contractArtists.map((artist) => (
                    <option key={artist.id} value={artist.id}>{artist.name}</option>
                  ))}
                </select>
              )}
              {/* Export CSV button */}
              <button
                onClick={exportContracts}
                disabled={exporting || filteredContracts.length === 0}
                className="flex items-center gap-2 px-4 py-2.5 bg-content2 text-foreground font-medium text-sm rounded-full border-2 border-default-200 hover:bg-content3 transition-colors disabled:opacity-50"
              >
                {exporting ? (
                  <Spinner size="sm" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                )}
                Export
              </button>
              {/* Import CSV button */}
              <label className="flex items-center gap-2 px-4 py-2.5 bg-content2 text-foreground font-medium text-sm rounded-full border-2 border-default-200 hover:bg-content3 transition-colors cursor-pointer">
                {importing ? (
                  <Spinner size="sm" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                )}
                Import
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleImportCSV}
                  className="hidden"
                  disabled={importing}
                />
              </label>
              {/* Refresh Spotify metadata button */}
              <button
                onClick={refreshAllMetadata}
                disabled={refreshingMetadata}
                className="flex items-center gap-2 px-4 py-2.5 bg-success-100 text-success-700 font-medium text-sm rounded-full border-2 border-success-200 hover:bg-success-200 transition-colors disabled:opacity-50"
                title="Recuperer les metadonnees depuis Spotify"
              >
                {refreshingMetadata ? (
                  <Spinner size="sm" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                Spotify
              </button>
              {/* Sync start dates with release dates */}
              <button
                onClick={syncStartDates}
                disabled={refreshingMetadata}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary-100 text-primary-700 font-medium text-sm rounded-full border-2 border-primary-200 hover:bg-primary-200 transition-colors disabled:opacity-50"
                title="Synchroniser les dates de debut avec les dates de release"
              >
                {refreshingMetadata ? (
                  <Spinner size="sm" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
                Sync dates
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="px-5 py-2.5 bg-primary text-white font-medium text-sm rounded-full shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all whitespace-nowrap"
              >
                Nouveau contrat
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Import result notification */}
      {importResult && (
        <div className="max-w-4xl mx-auto px-6 pt-4">
          <div className={`p-4 rounded-xl ${importResult.errors.length > 0 ? 'bg-warning-50 border border-warning-200' : 'bg-success-50 border border-success-200'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className={`font-medium ${importResult.errors.length > 0 ? 'text-warning-700' : 'text-success-700'}`}>
                  {importResult.updated} contrat{importResult.updated > 1 ? 's' : ''} mis a jour
                </p>
                {importResult.errors.length > 0 && (
                  <div className="mt-2 text-sm text-warning-600">
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
                className="p-1 text-secondary-400 hover:text-secondary-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-6 py-8">
        {contracts.length === 0 ? (
          <div className="bg-background border border-divider rounded-2xl p-12 text-center shadow-sm">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-content2 flex items-center justify-center">
              <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Aucun contrat</h3>
            <p className="text-secondary-500 text-sm mb-6">Commencez par creer un contrat pour definir les parts artiste/label</p>
            <button
              onClick={() => handleOpenModal()}
              className="px-5 py-2.5 bg-primary text-white font-medium text-sm rounded-full shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all"
            >
              Creer un contrat
            </button>
          </div>
        ) : filteredContracts.length === 0 ? (
          <div className="bg-background border border-divider rounded-2xl p-12 text-center shadow-sm">
            <p className="text-secondary-500">Aucun contrat pour cet artiste</p>
            <button
              onClick={() => setArtistFilter('')}
              className="mt-4 px-4 py-2 text-sm text-primary hover:bg-primary/10 rounded-full transition-colors"
            >
              Effacer le filtre
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredContracts.map((contract) => {
              const artist = artists.find(a => a.id === contract.artist_id);
              const artistParties = contract.parties.filter(p => p.party_type === 'artist');
              const labelParties = contract.parties.filter(p => p.party_type === 'label');

              let scopeLabel = '';
              const currentScopeInfo = contract.scope_id ? scopeInfo[contract.scope_id] : null;

              if (contract.scope === 'catalog') {
                scopeLabel = 'Tout le catalogue';
              } else if (contract.scope === 'release' && contract.scope_id) {
                scopeLabel = currentScopeInfo?.name
                  ? `Album : ${currentScopeInfo.name}`
                  : `Release (${contract.scope_id})`;
              } else if (contract.scope === 'track' && contract.scope_id) {
                scopeLabel = currentScopeInfo?.name
                  ? `Track : ${currentScopeInfo.name}`
                  : `Track (${contract.scope_id})`;
              }

              // Get artwork - for catalog scope, use artist image; otherwise use release/track artwork
              const artworkUrl = contract.scope === 'catalog'
                ? artist?.image_url_small || artist?.image_url
                : currentScopeInfo?.image_url_small || currentScopeInfo?.image_url;

              return (
                <div key={contract.id} className="bg-background border border-divider rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-divider">
                    <div className="flex items-start gap-4">
                      {/* Artwork */}
                      <div className="flex-shrink-0">
                        {artworkUrl ? (
                          <img
                            src={artworkUrl}
                            alt={artist?.name || 'Artwork'}
                            className="w-16 h-16 rounded-xl object-cover shadow-sm"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-content2 flex items-center justify-center">
                            <svg className="w-8 h-8 text-secondary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Contract info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="text-lg font-semibold text-foreground truncate">{artist?.name || 'Artiste inconnu'}</h3>
                          <span className="px-3 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium shrink-0">
                            {scopeLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-secondary-500">
                          <span>Du {new Date(contract.start_date).toLocaleDateString('fr-FR')}</span>
                          {contract.end_date ? (
                            <>
                              <span>•</span>
                              <span>au {new Date(contract.end_date).toLocaleDateString('fr-FR')}</span>
                            </>
                          ) : (
                            <>
                              <span>•</span>
                              <span className="text-success font-medium">Illimite</span>
                            </>
                          )}
                        </div>
                        {contract.description && (
                          <p className="mt-2 text-sm text-secondary-600 italic">{contract.description}</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleOpenModal(contract)}
                          className="p-2 text-secondary-400 hover:text-secondary-600 hover:bg-content2 rounded-xl transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(contract.id!)}
                          className="p-2 text-secondary-400 hover:text-danger hover:bg-danger-50 rounded-xl transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 p-5">
                    <div>
                      <p className="text-sm font-medium text-secondary-500 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-success"></span>
                        Artistes
                      </p>
                      <div className="space-y-2">
                        {artistParties.map((party, i) => {
                          const partyArtist = artists.find(a => a.id === party.artist_id);
                          return (
                            <div key={i} className="flex justify-between items-center py-2.5 px-3 rounded-xl bg-content2">
                              <span className="text-sm font-medium text-foreground">{partyArtist?.name || 'Inconnu'}</span>
                              <span className="text-sm font-bold text-success">{(parseFloat(party.share_percentage) * 100).toFixed(1)}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-secondary-500 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary"></span>
                        Labels
                      </p>
                      <div className="space-y-2">
                        {labelParties.map((party, i) => (
                          <div key={i} className="flex justify-between items-center py-2.5 px-3 rounded-xl bg-content2">
                            <span className="text-sm font-medium text-foreground">{party.label_name}</span>
                            <span className="text-sm font-bold text-primary">{(parseFloat(party.share_percentage) * 100).toFixed(1)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-background w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-4 py-4 sm:px-6 border-b border-divider shrink-0">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">
                  {editingContract ? 'Modifier le contrat' : 'Nouveau contrat'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 -mr-2 text-secondary-500 hover:text-secondary-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
              {/* Artist selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Artiste principal <span className="text-danger">*</span>
                </label>
                <select
                  value={artistId}
                  onChange={(e) => setArtistId(e.target.value)}
                  className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="">Selectionner un artiste</option>
                  {artists.map((artist) => (
                    <option key={artist.id} value={artist.id}>{artist.name}</option>
                  ))}
                </select>
              </div>

              {/* Scope */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Portee du contrat <span className="text-danger">*</span>
                </label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as any)}
                  className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground focus:outline-none focus:border-primary transition-colors"
                >
                  <option value="catalog">Tout le catalogue</option>
                  <option value="release">Release specifique (UPC)</option>
                  <option value="track">Track specifique (ISRC)</option>
                </select>
              </div>

              {/* Scope ID */}
              {scope !== 'catalog' && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {scope === 'track' ? 'Code ISRC' : 'Code UPC'} <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder={scope === 'track' ? 'Ex: USRC17607839' : 'Ex: 0123456789012'}
                    value={scopeId}
                    onChange={(e) => setScopeId(e.target.value)}
                    className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
                  />
                  {/* Album/Track preview */}
                  {loadingFormScope && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-secondary-500">
                      <Spinner size="sm" />
                      Recherche...
                    </div>
                  )}
                  {formScopeInfo && !loadingFormScope && (
                    <div className="mt-3 p-3 bg-content2 rounded-xl flex items-center gap-3">
                      {formScopeInfo.image_url && (
                        <img
                          src={formScopeInfo.image_url}
                          alt={formScopeInfo.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{formScopeInfo.name}</p>
                        {formScopeInfo.release_date && (
                          <p className="text-sm text-secondary-500">
                            Sortie : {formScopeInfo.release_date}
                          </p>
                        )}
                      </div>
                      {formScopeInfo.release_date && (
                        <button
                          type="button"
                          onClick={() => setStartDate(formScopeInfo.release_date!)}
                          className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors whitespace-nowrap"
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
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Date de debut <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Duree (annees)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={0.5}
                    placeholder="Ex: 3"
                    value={duration}
                    onChange={(e) => handleDurationChange(e.target.value)}
                    className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => handleEndDateChange(e.target.value)}
                    className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Description
                </label>
                <textarea
                  placeholder="Notes ou details supplementaires..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-3 bg-background border-2 border-default-200 rounded-xl text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors resize-none"
                />
              </div>

              {/* Parties */}
              <div className="border-t border-divider pt-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">
                    Repartition des parts
                    <span className={`ml-2 text-sm font-bold ${Math.abs(totalShare - 1) < 0.0001 ? 'text-success' : 'text-danger'}`}>
                      ({(totalShare * 100).toFixed(1)}%)
                    </span>
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleAddParty('artist')}
                      className="px-3 py-1.5 text-xs font-medium text-success bg-success/10 rounded-full hover:bg-success/20 transition-colors"
                    >
                      + Artiste
                    </button>
                    <button
                      onClick={() => handleAddParty('label')}
                      className="px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full hover:bg-primary/20 transition-colors"
                    >
                      + Label
                    </button>
                  </div>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {parties.map((party, index) => (
                    <div key={index} className="flex gap-3 items-start p-4 rounded-xl border-2 border-divider bg-content2">
                      <div className="flex-1">
                        {party.party_type === 'artist' ? (
                          <div>
                            <label className="block text-xs font-medium text-secondary-500 mb-1.5">Artiste</label>
                            <select
                              value={party.artist_id || ''}
                              onChange={(e) => handlePartyChange(index, 'artist_id', e.target.value)}
                              className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-lg text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                            >
                              <option value="">Selectionner</option>
                              {artists.map((artist) => (
                                <option key={artist.id} value={artist.id}>{artist.name}</option>
                              ))}
                            </select>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-xs font-medium text-secondary-500 mb-1.5">Nom du label</label>
                            <input
                              type="text"
                              placeholder="Ex: Whales Records"
                              value={party.label_name || ''}
                              onChange={(e) => handlePartyChange(index, 'label_name', e.target.value)}
                              className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-lg text-sm text-foreground placeholder:text-secondary-400 focus:outline-none focus:border-primary transition-colors"
                            />
                          </div>
                        )}
                      </div>
                      <div className="w-24">
                        <label className="block text-xs font-medium text-secondary-500 mb-1.5">Part (%)</label>
                        <input
                          type="number"
                          placeholder="0-100"
                          min={0}
                          max={100}
                          step="any"
                          value={String(parseFloat(party.share_percentage || '0') * 100)}
                          onChange={(e) => handlePartyChange(index, 'share_percentage', String(parseFloat(e.target.value) / 100))}
                          className="w-full h-10 px-3 bg-background border-2 border-default-200 rounded-lg text-sm text-foreground text-center focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                      <div className="pt-6">
                        <button
                          onClick={() => handleRemoveParty(index)}
                          className="p-2 text-secondary-400 hover:text-danger hover:bg-danger-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  {parties.length === 0 && (
                    <p className="text-center text-secondary-400 py-8 text-sm">
                      Aucune partie ajoutee. Cliquez sur "+ Artiste" ou "+ Label" pour commencer.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 border-t border-divider flex gap-3 shrink-0">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-4 py-2.5 bg-content2 text-foreground font-medium text-sm rounded-full hover:bg-content3 transition-colors border-2 border-default-200"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-medium text-sm rounded-full shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 disabled:opacity-50 transition-all"
              >
                {saving && <Spinner size="sm" color="white" />}
                {editingContract ? 'Enregistrer' : 'Creer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
