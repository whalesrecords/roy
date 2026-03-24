'use client';

import { useState, useEffect, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Artist, Contract } from '@/lib/types';
import { formatCurrency } from '@/lib/formatters';
import {
  getContracts,
  createContract,
  updateContract,
  deleteContract,
  uploadContractDocument,
  getArtists,
  getArtistReleases,
  getArtistTracks,
  getLabelSettings,
  getReleaseTracks,
  assignIsrcToTrack,
  CatalogRelease,
  CatalogTrack,
  ReleaseTrack,
} from '@/lib/api';

// Helper to calculate shares from contract parties
function getContractShares(contract: Contract, forArtistId?: string): { artistShare: number; labelShare: number } {
  if (!contract.parties || contract.parties.length === 0) {
    return { artistShare: parseFloat(contract.artist_share || '0'), labelShare: parseFloat(contract.label_share || '0') };
  }
  let artistShare: number;
  if (forArtistId) {
    const thisParty = contract.parties.find(p => p.party_type === 'artist' && p.artist_id === forArtistId);
    artistShare = thisParty ? parseFloat(thisParty.share_percentage || '0') : 0;
  } else {
    artistShare = contract.parties.filter(p => p.party_type === 'artist').reduce((sum, p) => sum + parseFloat(p.share_percentage || '0'), 0);
  }
  const labelShare = contract.parties.filter(p => p.party_type === 'label').reduce((sum, p) => sum + parseFloat(p.share_percentage || '0'), 0);
  return { artistShare, labelShare };
}

const formatPercent = (decimal: number) => {
  const pct = decimal * 100;
  return pct % 1 === 0 ? pct.toFixed(0) : pct.toFixed(2).replace(/0+$/, '');
};

type ContractPartyState = {
  id?: string;
  party_type: 'artist' | 'label';
  artist_id?: string;
  label_name?: string;
  share_percentage: number;
  share_physical: number | null;
  share_digital: number | null;
};

interface ContractsTabProps {
  artist: Artist;
  artistId: string;
}

export default function ContractsTab({ artist, artistId }: ContractsTabProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [releases, setReleases] = useState<CatalogRelease[]>([]);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [defaultLabelName, setDefaultLabelName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Contract form state
  const [showContractForm, setShowContractForm] = useState(false);
  const [selectedItem, setSelectedItem] = useState<{ type: 'release' | 'track'; id: string; name: string } | null>(null);
  const [contractStartDate, setContractStartDate] = useState('');
  const [contractEndDate, setContractEndDate] = useState('');
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [creatingContract, setCreatingContract] = useState(false);
  const [contractParties, setContractParties] = useState<ContractPartyState[]>([]);
  const [contractTrackMode, setContractTrackMode] = useState(false);
  const [contractSelectedTracks, setContractSelectedTracks] = useState<string[]>([]);
  const [contractTrackFilter, setContractTrackFilter] = useState('');
  const [contractReleaseTracks, setContractReleaseTracks] = useState<ReleaseTrack[]>([]);
  const [loadingReleaseTracks, setLoadingReleaseTracks] = useState(false);
  const [manualIsrcs, setManualIsrcs] = useState<Record<number, string>>({});
  const [savingIsrc, setSavingIsrc] = useState<number | null>(null);

  // Edit contract state
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [editContractStartDate, setEditContractStartDate] = useState('');
  const [editContractParties, setEditContractParties] = useState<ContractPartyState[]>([]);
  const [savingContract, setSavingContract] = useState(false);
  const [deletingContractId, setDeletingContractId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [contractsData, allArtistsData, labelSettingsData] = await Promise.all([
        getContracts(artistId),
        getArtists(),
        getLabelSettings().catch(() => null),
      ]);
      setContracts(contractsData);
      setAllArtists(allArtistsData);
      if (labelSettingsData?.label_name) setDefaultLabelName(labelSettingsData.label_name);

      if (artist.name) {
        try {
          const [releasesData, tracksData] = await Promise.all([getArtistReleases(artist.name), getArtistTracks(artist.name)]);
          setReleases(releasesData);
          setTracks(tracksData);
        } catch { /* catalog optional */ }
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); }
  }, [artistId, artist.name]);

  useEffect(() => { loadData(); }, [loadData]);

  const resetContractForm = () => {
    setShowContractForm(false); setSelectedItem(null); setContractParties([]); setContractStartDate(''); setContractEndDate(''); setContractFile(null); setContractTrackMode(false); setContractSelectedTracks([]); setContractTrackFilter(''); setContractReleaseTracks([]); setManualIsrcs({});
  };

  const handleCreateContract = async () => {
    if (!contractStartDate) return;
    if (contractParties.length === 0) { setError('Veuillez ajouter au moins une partie au contrat'); return; }
    const totalShare = contractParties.reduce((sum, p) => sum + p.share_percentage, 0);
    if (Math.abs(totalShare - 100) > 0.01) { setError('Le total des parts doit etre egal a 100%'); return; }
    setCreatingContract(true);
    try {
      const partiesPayload = contractParties.map(p => ({ party_type: p.party_type, artist_id: p.artist_id, label_name: p.label_name, share_percentage: String(p.share_percentage / 100), share_physical: p.share_physical != null ? String(p.share_physical / 100) : undefined, share_digital: p.share_digital != null ? String(p.share_digital / 100) : undefined }));

      if (selectedItem) {
        if (contractTrackMode && contractSelectedTracks.length > 0 && selectedItem.type === 'release') {
          for (const isrc of contractSelectedTracks) {
            const trackInfo = contractReleaseTracks.find(t => t.isrc === isrc);
            const contract = await createContract({ artist_id: artistId, scope: 'track', scope_id: isrc, start_date: contractStartDate, end_date: contractEndDate || undefined, description: trackInfo ? `Track: ${trackInfo.track_title}` : undefined, parties: partiesPayload });
            if (contractFile && contract.id) { try { await uploadContractDocument(contract.id, contractFile); } catch { /* ignore upload err */ } }
          }
        } else {
          const contract = await createContract({ artist_id: artistId, scope: selectedItem.type, scope_id: selectedItem.id, start_date: contractStartDate, end_date: contractEndDate || undefined, parties: partiesPayload });
          if (contractFile && contract.id) { setUploadingContract(true); try { await uploadContractDocument(contract.id, contractFile); } catch { setError('Contrat cree mais echec upload PDF'); } finally { setUploadingContract(false); } }
        }
      } else {
        // Catalog contract
        const contract = await createContract({ artist_id: artistId, scope: 'catalog', start_date: contractStartDate, end_date: contractEndDate || undefined, parties: partiesPayload });
        if (contractFile && contract.id) { setUploadingContract(true); try { await uploadContractDocument(contract.id, contractFile); } catch { setError('Contrat cree mais echec upload PDF'); } finally { setUploadingContract(false); } }
      }
      resetContractForm();
      loadData();
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); } finally { setCreatingContract(false); }
  };

  const handleEditContract = (contract: Contract) => {
    setEditingContract(contract);
    setEditContractStartDate(contract.start_date);
    if (contract.parties && contract.parties.length > 0) {
      setEditContractParties(contract.parties.map(p => ({ id: p.id, party_type: p.party_type as 'artist' | 'label', artist_id: p.artist_id, label_name: p.label_name, share_percentage: parseFloat(String(p.share_percentage)) * 100, share_physical: p.share_physical != null ? parseFloat(String(p.share_physical)) * 100 : null, share_digital: p.share_digital != null ? parseFloat(String(p.share_digital)) * 100 : null })));
    } else {
      const { artistShare } = getContractShares(contract, artistId);
      setEditContractParties([
        { party_type: 'artist', artist_id: artistId, share_percentage: artistShare * 100, share_physical: null, share_digital: null },
        { party_type: 'label', label_name: 'Whales Records', share_percentage: (1 - artistShare) * 100, share_physical: null, share_digital: null },
      ]);
    }
  };

  const handleUpdateContract = async () => {
    if (!editingContract || !editingContract.id || !editContractStartDate) return;
    const totalShare = editContractParties.reduce((sum, p) => sum + p.share_percentage, 0);
    if (Math.abs(totalShare - 100) > 0.01) { setError('Le total des parts doit etre egal a 100%'); return; }
    setSavingContract(true);
    try {
      await updateContract(editingContract.id, { start_date: editContractStartDate, parties: editContractParties.map(p => ({ party_type: p.party_type, artist_id: p.artist_id, label_name: p.label_name, share_percentage: String(p.share_percentage / 100), share_physical: p.share_physical != null ? String(p.share_physical / 100) : undefined, share_digital: p.share_digital != null ? String(p.share_digital / 100) : undefined })) });
      setEditingContract(null); loadData();
    } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); } finally { setSavingContract(false); }
  };

  const handleDeleteContract = async (contractId: string) => {
    if (!confirm('Supprimer ce contrat ?')) return;
    setDeletingContractId(contractId);
    try { await deleteContract(contractId); loadData(); } catch (err) { setError(err instanceof Error ? err.message : 'Erreur'); } finally { setDeletingContractId(null); }
  };

  const openCreateContractForRelease = (upc: string, title: string) => {
    setSelectedItem({ type: 'release', id: upc, name: title });
    setContractParties([
      { party_type: 'artist', artist_id: artist?.id, share_percentage: 50, share_physical: null, share_digital: null },
      { party_type: 'label', label_name: defaultLabelName, share_percentage: 50, share_physical: null, share_digital: null }
    ]);
    setContractTrackMode(false); setContractSelectedTracks([]); setShowContractForm(true);
  };

  const catalogContract = contracts.find(c => c.scope === 'catalog');

  // Party editor component (shared between create and edit)
  const renderPartyEditor = (parties: ContractPartyState[], setParties: (p: ContractPartyState[]) => void) => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="block text-sm font-medium text-secondary-700">Parties du contrat</label>
        <button onClick={() => setParties([...parties, { party_type: 'artist', artist_id: artist?.id, share_percentage: 0, share_physical: null, share_digital: null }])} className="text-sm text-primary hover:text-primary-600 font-medium">+ Ajouter une partie</button>
      </div>
      {parties.length === 0 && (<div className="bg-content2 rounded-xl p-3 mb-3"><p className="text-sm text-secondary-500">Aucune partie définie.</p></div>)}
      <div className="space-y-3 mb-3">
        {parties.map((party, index) => (
          <div key={index} className="bg-content2 rounded-xl p-3">
            <div className="flex items-start gap-2 mb-2">
              <select value={party.party_type} onChange={(e) => { const np = [...parties]; np[index].party_type = e.target.value as 'artist' | 'label'; if (e.target.value === 'artist') { np[index].artist_id = artist?.id; delete np[index].label_name; } else { np[index].label_name = ''; delete np[index].artist_id; } setParties(np); }} className="flex-1 px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm"><option value="artist">Artiste</option><option value="label">Label</option></select>
              <button onClick={() => setParties(parties.filter((_, i) => i !== index))} className="p-2 text-danger hover:bg-danger-50 rounded-xl"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
            </div>
            {party.party_type === 'artist' ? (
              <select value={party.artist_id || ''} onChange={(e) => { const np = [...parties]; np[index].artist_id = e.target.value; setParties(np); }} className="w-full px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm mb-2"><option value="">Sélectionner un artiste</option>{allArtists.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}</select>
            ) : (
              <input type="text" placeholder="Nom du label" value={party.label_name || ''} onChange={(e) => { const np = [...parties]; np[index].label_name = e.target.value; setParties(np); }} className="w-full px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm mb-2" />
            )}
            <div className="grid grid-cols-3 gap-2">
              <div><label className="block text-xs text-secondary-500 mb-1">Streams (%)</label><input type="number" min="0" max="100" step="any" value={party.share_percentage} onChange={(e) => { const np = [...parties]; const val = parseFloat(e.target.value) || 0; np[index].share_percentage = val; if (np[index].share_physical === null) np[index].share_physical = val; if (np[index].share_digital === null) np[index].share_digital = val; setParties(np); }} className="w-full px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm text-center focus:outline-none focus:border-primary transition-colors" /></div>
              <div><label className="block text-xs text-secondary-500 mb-1">Physique (%)</label><input type="number" min="0" max="100" step="any" value={party.share_physical ?? party.share_percentage} onChange={(e) => { const np = [...parties]; np[index].share_physical = parseFloat(e.target.value) || 0; setParties(np); }} className="w-full px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm text-center focus:outline-none focus:border-primary transition-colors" /></div>
              <div><label className="block text-xs text-secondary-500 mb-1">Digital (%)</label><input type="number" min="0" max="100" step="any" value={party.share_digital ?? party.share_percentage} onChange={(e) => { const np = [...parties]; np[index].share_digital = parseFloat(e.target.value) || 0; setParties(np); }} className="w-full px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm text-center focus:outline-none focus:border-primary transition-colors" /></div>
            </div>
          </div>
        ))}
      </div>
      {parties.length > 0 && (
        <div className={`rounded-xl p-3 ${Math.abs(parties.reduce((sum, p) => sum + p.share_percentage, 0) - 100) <= 0.01 ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'}`}>
          <p className="text-sm font-medium">Total: {parties.reduce((sum, p) => sum + p.share_percentage, 0).toFixed(2)}%{Math.abs(parties.reduce((sum, p) => sum + p.share_percentage, 0) - 100) > 0.01 && ' (doit etre 100%)'}</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {error && (<div className="bg-danger-50 text-danger px-4 py-3 rounded-xl text-sm">{error}<button onClick={() => setError(null)} className="ml-2 underline">Fermer</button></div>)}

      {/* Catalog Contract */}
      <div className="bg-background rounded-2xl border border-divider shadow-sm">
        <div className="px-5 py-4 border-b border-divider">
          <h2 className="font-medium text-foreground">Contrat catalogue (défaut)</h2>
          <p className="text-sm text-secondary-500">S&apos;applique à tout sauf si un contrat spécifique existe</p>
        </div>
        {catalogContract ? (
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center"><svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
                <div>
                  <p className="font-medium text-foreground">{(() => { const { artistShare, labelShare } = getContractShares(catalogContract, artistId); return `${formatPercent(artistShare)}% artiste / ${formatPercent(labelShare)}% label`; })()}</p>
                  <p className="text-sm text-secondary-500">Depuis {new Date(catalogContract.start_date).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleEditContract(catalogContract)} className="p-2 text-secondary-400 hover:text-secondary-600 hover:bg-content2 rounded-xl transition-colors" title="Modifier"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                <button onClick={() => catalogContract.id && handleDeleteContract(catalogContract.id)} disabled={deletingContractId === catalogContract.id} className="p-2 text-secondary-400 hover:text-danger hover:bg-danger-50 rounded-xl transition-colors" title="Supprimer">{deletingContractId === catalogContract.id ? (<div className="w-4 h-4 border-2 border-danger-400 border-t-transparent rounded-full animate-spin" />) : (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>)}</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-4">
            <p className="text-secondary-500 text-sm mb-3">Aucun contrat catalogue défini</p>
            <Button size="sm" onClick={() => { setSelectedItem(null); setContractParties([{ party_type: 'artist', artist_id: artist?.id, share_percentage: 50, share_physical: null, share_digital: null }, { party_type: 'label', label_name: defaultLabelName, share_percentage: 50, share_physical: null, share_digital: null }]); setShowContractForm(true); }}>Définir un contrat catalogue</Button>
          </div>
        )}
      </div>

      {/* All Contracts */}
      <div className="bg-background rounded-2xl border border-divider shadow-sm">
        <div className="px-5 py-4 border-b border-divider flex items-center justify-between">
          <div><h2 className="font-medium text-foreground">Tous les contrats</h2><p className="text-sm text-secondary-500">{contracts.length} contrat{contracts.length !== 1 ? 's' : ''} · {releases.length} release{releases.length !== 1 ? 's' : ''}</p></div>
          <a href="/contracts" className="text-sm text-primary hover:text-primary-600 font-medium">Voir page Contrats →</a>
        </div>
        <div className="divide-y divide-divider max-h-[500px] overflow-y-auto">
          {/* Release contracts */}
          {releases.map((release) => {
            const releaseContract = contracts.find(c => c.scope === 'release' && c.scope_id === release.upc);
            const hasContract = !!releaseContract;
            const effectiveContract = releaseContract || catalogContract;
            const shares = effectiveContract ? getContractShares(effectiveContract, artistId) : null;
            return (
              <div key={release.upc} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${hasContract ? 'bg-success/10 text-success-700' : 'bg-warning/10 text-warning-700'}`}>Release</span>
                    <span className={`text-sm font-medium truncate ${release.release_title === '(Sans album)' ? 'text-secondary-400 italic' : 'text-foreground'}`}>{release.release_title === '(Sans album)' ? 'Sans titre' : release.release_title}</span>
                  </div>
                  {release.upc !== 'UNKNOWN' && (<span className="text-xs font-mono text-secondary-400">UPC: {release.upc}</span>)}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {hasContract ? (
                    <>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-success/10 text-success-700">{shares ? `${formatPercent(shares.artistShare)}%` : '-'}</span>
                      <button onClick={() => handleEditContract(releaseContract!)} className="p-1.5 text-secondary-400 hover:text-secondary-600 hover:bg-content2 rounded transition-colors" title="Modifier"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                    </>
                  ) : shares ? (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-content2 text-secondary-600">{formatPercent(shares.artistShare)}% (catalogue)</span>
                  ) : (
                    <button onClick={() => openCreateContractForRelease(release.upc, release.release_title)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary-700 hover:bg-primary/20 transition-colors"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>Créer contrat</button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Track-level contracts */}
          {contracts.filter(c => c.scope === 'track').map((contract) => {
            const { artistShare } = getContractShares(contract, artistId);
            const trackName = tracks.find(t => t.isrc === contract.scope_id)?.track_title;
            return (
              <div key={contract.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-primary/10 text-primary-700">Track</span>{trackName && <span className="text-sm font-medium text-foreground truncate">{trackName}</span>}{contract.scope_id && <span className="text-xs font-mono text-secondary-400">{contract.scope_id}</span>}</div></div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary-700">{formatPercent(artistShare)}%</span>
                  <button onClick={() => handleEditContract(contract)} className="p-1.5 text-secondary-400 hover:text-secondary-600 hover:bg-content2 rounded transition-colors" title="Modifier"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Contract Form Modal */}
      {showContractForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
            <div className="px-4 py-4 sm:px-6 border-b border-divider flex-shrink-0"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-foreground">{selectedItem ? `Contrat: ${selectedItem.name}` : 'Contrat catalogue'}</h2><button onClick={resetContractForm} className="p-2 -mr-2 text-secondary-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div></div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              {selectedItem && (<div className="bg-content2 rounded-xl p-3"><p className="text-sm text-secondary-500">{selectedItem.type === 'release' ? 'Release (UPC)' : 'Track (ISRC)'}</p><p className="font-medium text-foreground">{selectedItem.name}</p><p className="text-xs text-secondary-400 font-mono mt-1">{selectedItem.id}</p></div>)}
              {/* Track mode for release */}
              {selectedItem && selectedItem.type === 'release' && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={contractTrackMode} onChange={async (e) => { const checked = e.target.checked; setContractTrackMode(checked); if (!checked) { setContractSelectedTracks([]); setContractTrackFilter(''); setContractReleaseTracks([]); setManualIsrcs({}); } else if (selectedItem.id && selectedItem.id !== 'UNKNOWN') { setLoadingReleaseTracks(true); try { const relTracks = await getReleaseTracks(selectedItem.id); setContractReleaseTracks(relTracks); } catch { setContractReleaseTracks([]); setManualIsrcs({}); } finally { setLoadingReleaseTracks(false); } } }} className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary" />
                    <span className="text-sm text-secondary-700">Appliquer à des tracks spécifiques</span>
                  </label>
                  {contractTrackMode && (() => {
                    if (loadingReleaseTracks) return <p className="mt-2 text-xs text-secondary-400 italic">Chargement des tracks...</p>;
                    const filter = contractTrackFilter.toLowerCase();
                    const filtered = filter ? contractReleaseTracks.filter(t => t.track_title.toLowerCase().includes(filter) || (t.isrc || '').toLowerCase().includes(filter)) : contractReleaseTracks;
                    const existingTrackIsrcs = new Set(contracts.filter(c => c.scope === 'track' && c.scope_id).map(c => c.scope_id!));
                    const selectableIsrcs = filtered.filter(t => t.isrc && !existingTrackIsrcs.has(t.isrc)).map(t => t.isrc!);
                    return (
                      <div className="mt-2">
                        <input type="text" placeholder="Rechercher une track..." value={contractTrackFilter} onChange={(e) => setContractTrackFilter(e.target.value)} className="w-full px-3 py-1.5 bg-background border border-default-200 rounded-lg text-sm mb-2 focus:outline-none focus:border-primary" />
                        {filtered.length > 0 ? (
                          <div className="space-y-1 max-h-56 overflow-y-auto border border-default-200 rounded-xl p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-secondary-400">{filtered.length} track{filtered.length > 1 ? 's' : ''}</span>
                              {selectableIsrcs.length > 0 && (<button type="button" onClick={() => { const allSelected = selectableIsrcs.every(i => contractSelectedTracks.includes(i)); if (allSelected) setContractSelectedTracks(contractSelectedTracks.filter(i => !selectableIsrcs.includes(i))); else setContractSelectedTracks(Array.from(new Set([...contractSelectedTracks, ...selectableIsrcs]))); }} className="text-xs text-primary hover:text-primary-600 font-medium">{selectableIsrcs.every(i => contractSelectedTracks.includes(i)) ? 'Tout desélectionner' : 'Tout sélectionner'}</button>)}
                            </div>
                            {filtered.map((track, idx) => {
                              const hasIsrc = !!track.isrc;
                              const manualVal = manualIsrcs[idx] || '';
                              const effectiveIsrc = track.isrc || (manualVal.length >= 5 ? manualVal : null);
                              const alreadyHasContract = !!effectiveIsrc && existingTrackIsrcs.has(effectiveIsrc);
                              const isDisabled = !effectiveIsrc || alreadyHasContract;
                              return (
                                <div key={track.isrc || `no-isrc-${idx}`} className={`p-1.5 rounded-lg ${isDisabled ? 'opacity-50' : 'hover:bg-content2'}`}>
                                  <label className={`flex items-center gap-2 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                    <input type="checkbox" disabled={isDisabled} checked={!!effectiveIsrc && !alreadyHasContract && contractSelectedTracks.includes(effectiveIsrc)} onChange={(e) => { if (!effectiveIsrc || alreadyHasContract) return; if (e.target.checked) setContractSelectedTracks([...contractSelectedTracks, effectiveIsrc]); else setContractSelectedTracks(contractSelectedTracks.filter(i => i !== effectiveIsrc)); }} className="w-4 h-4 rounded border-default-300 text-primary focus:ring-primary" />
                                    <div className="flex-1 min-w-0"><p className={`text-sm truncate ${alreadyHasContract ? 'text-secondary-400' : 'text-foreground'}`}>{track.track_title}</p><p className="text-xs text-secondary-400">{alreadyHasContract ? <span className="text-success-600 font-medium">Contrat existant</span> : hasIsrc ? <span className="font-mono">{track.isrc}</span> : <span className="text-warning-500">Pas d&apos;ISRC</span>}</p></div>
                                  </label>
                                  {!hasIsrc && (
                                    <div className="flex items-center gap-1 mt-1 ml-6">
                                      <input type="text" placeholder="Entrer l'ISRC..." value={manualVal} onChange={(e) => setManualIsrcs({ ...manualIsrcs, [idx]: e.target.value.toUpperCase() })} className="flex-1 px-2 py-1 text-xs font-mono bg-background border border-default-200 rounded-lg focus:outline-none focus:border-primary" />
                                      {manualVal.length >= 5 && (<button type="button" disabled={savingIsrc === idx} onClick={async () => { setSavingIsrc(idx); try { await assignIsrcToTrack(track.track_title, track.artist_name, manualVal.trim()); const updated = [...contractReleaseTracks]; updated[contractReleaseTracks.indexOf(track)] = { ...track, isrc: manualVal.trim() }; setContractReleaseTracks(updated); setManualIsrcs({ ...manualIsrcs, [idx]: '' }); } catch { /* ignore */ } finally { setSavingIsrc(null); } }} className="px-2 py-1 text-xs bg-primary text-white rounded-lg hover:bg-primary-600 disabled:opacity-50">{savingIsrc === idx ? '...' : 'OK'}</button>)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (<p className="text-xs text-secondary-400 italic">Aucune track trouvée</p>)}
                      </div>
                    );
                  })()}
                </div>
              )}
              {!selectedItem && (<div className="bg-primary/5 rounded-xl p-3"><p className="text-sm text-primary-700">Le contrat catalogue s&apos;applique à toutes les releases et tracks qui n&apos;ont pas de contrat spécifique.</p></div>)}
              {renderPartyEditor(contractParties, setContractParties)}
              <div><label className="text-sm font-medium text-foreground mb-2 block">Date de début</label><Input type="date" value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} /></div>
              <div><label className="text-sm font-medium text-foreground mb-2 block">Date de fin (optionnel)</label><Input type="date" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} /></div>
              <div><label className="text-sm font-medium text-foreground mb-2 block">PDF du contrat (optionnel)</label><input type="file" accept="application/pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) setContractFile(file); }} className="w-full px-3 py-2 bg-background border-2 border-default-200 rounded-xl text-sm" />{contractFile && (<p className="text-xs text-success mt-1">{contractFile.name}</p>)}</div>
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3 flex-shrink-0">
              <Button variant="secondary" onClick={resetContractForm} className="flex-1">Annuler</Button>
              <Button onClick={handleCreateContract} loading={creatingContract} disabled={!contractStartDate || contractParties.length === 0 || Math.abs(contractParties.reduce((sum, p) => sum + p.share_percentage, 0) - 100) > 0.01 || (contractTrackMode && contractSelectedTracks.length === 0)} className="flex-1">{contractTrackMode && contractSelectedTracks.length > 0 ? `Créer ${contractSelectedTracks.length} contrat${contractSelectedTracks.length > 1 ? 's' : ''}` : 'Créer'}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contract Modal */}
      {editingContract && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-background w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] flex flex-col">
            <div className="px-4 py-4 sm:px-6 border-b border-divider flex-shrink-0"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-foreground">Modifier le contrat</h2><button onClick={() => setEditingContract(null)} className="p-2 -mr-2 text-secondary-500"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button></div></div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
              <div className="bg-content2 rounded-xl p-3"><p className="text-sm text-secondary-500">{editingContract.scope === 'catalog' ? 'Catalogue' : editingContract.scope === 'release' ? 'Release (UPC)' : 'Track (ISRC)'}</p><p className="font-medium text-foreground">{editingContract.scope === 'catalog' ? 'Tout le catalogue' : editingContract.scope_id}</p></div>
              {renderPartyEditor(editContractParties, setEditContractParties)}
              <Input type="date" label="Date de début" value={editContractStartDate} onChange={(e) => setEditContractStartDate(e.target.value)} />
            </div>
            <div className="p-4 sm:p-6 border-t border-divider flex gap-3 flex-shrink-0">
              <Button variant="secondary" onClick={() => setEditingContract(null)} className="flex-1">Annuler</Button>
              <Button onClick={handleUpdateContract} loading={savingContract} disabled={!editContractStartDate || editContractParties.length === 0 || Math.abs(editContractParties.reduce((sum, p) => sum + p.share_percentage, 0) - 100) > 0.01} className="flex-1">Enregistrer</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
