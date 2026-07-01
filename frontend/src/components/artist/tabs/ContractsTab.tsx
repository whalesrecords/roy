'use client';

import { useState, useEffect, useCallback } from 'react';
import Input from '@/components/ui/Input';
import { Artist, Contract } from '@/lib/types';
import { Card, Pill, AccentButton, OutlineButton } from '@/components/roy/ui';
import { useConfirm } from '@/components/roy/useConfirm';
import { IconCheck, IconPlus } from '@/components/roy/icons';
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

const fieldClass = 'w-full px-3 py-2 bg-surface border border-line rounded-[10px] text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors';
const iconBtnClass = 'p-1.5 text-ink-faint hover:text-ink hover:bg-surface-2 rounded-[8px] transition-colors';
const delBtnClass = 'p-1.5 text-ink-faint hover:text-neg hover:bg-surface-2 rounded-[8px] transition-colors';

export default function ContractsTab({ artist, artistId }: ContractsTabProps) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [releases, setReleases] = useState<CatalogRelease[]>([]);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [allArtists, setAllArtists] = useState<Artist[]>([]);
  const [defaultLabelName, setDefaultLabelName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

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
    if (!(await confirm({ title: 'Supprimer ce contrat ?', message: 'Cette action est irréversible.', danger: true, confirmLabel: 'Supprimer' }))) return;
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

  const EditIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>);
  const TrashIcon = () => (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>);

  // Party editor component (shared between create and edit)
  const renderPartyEditor = (parties: ContractPartyState[], setParties: (p: ContractPartyState[]) => void) => (
    <div>
      <div className="flex items-center justify-between mb-3">
        <label className="roy-eyebrow text-[9.5px]">Parties du contrat</label>
        <button onClick={() => setParties([...parties, { party_type: 'artist', artist_id: artist?.id, share_percentage: 0, share_physical: null, share_digital: null }])} className="text-[12px] text-accent hover:opacity-80 font-semibold transition-opacity">+ Ajouter une partie</button>
      </div>
      {parties.length === 0 && (<div className="rounded-[12px] bg-surface-2 p-3 mb-3"><p className="text-[13px] text-ink-faint">Aucune partie définie.</p></div>)}
      <div className="space-y-3 mb-3">
        {parties.map((party, index) => (
          <div key={index} className="rounded-[12px] bg-surface-2 p-3">
            <div className="flex items-start gap-2 mb-2">
              <select value={party.party_type} onChange={(e) => { const np = [...parties]; np[index].party_type = e.target.value as 'artist' | 'label'; if (e.target.value === 'artist') { np[index].artist_id = artist?.id; delete np[index].label_name; } else { np[index].label_name = ''; delete np[index].artist_id; } setParties(np); }} className={`flex-1 ${fieldClass}`}><option value="artist">Artiste</option><option value="label">Label</option></select>
              <button onClick={() => setParties(parties.filter((_, i) => i !== index))} className={delBtnClass}><TrashIcon /></button>
            </div>
            {party.party_type === 'artist' ? (
              <select value={party.artist_id || ''} onChange={(e) => { const np = [...parties]; np[index].artist_id = e.target.value; setParties(np); }} className={`${fieldClass} mb-2`}><option value="">Sélectionner un artiste</option>{allArtists.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}</select>
            ) : (
              <input type="text" placeholder="Nom du label" value={party.label_name || ''} onChange={(e) => { const np = [...parties]; np[index].label_name = e.target.value; setParties(np); }} className={`${fieldClass} mb-2`} />
            )}
            <div className="grid grid-cols-3 gap-2">
              <div><label className="block text-[10.5px] text-ink-faint mb-1">Streams (%)</label><input type="number" min="0" max="100" step="any" value={party.share_percentage} onChange={(e) => { const np = [...parties]; const val = parseFloat(e.target.value) || 0; np[index].share_percentage = val; if (np[index].share_physical === null) np[index].share_physical = val; if (np[index].share_digital === null) np[index].share_digital = val; setParties(np); }} className={`${fieldClass} text-center roy-num`} /></div>
              <div><label className="block text-[10.5px] text-ink-faint mb-1">Physique (%)</label><input type="number" min="0" max="100" step="any" value={party.share_physical ?? party.share_percentage} onChange={(e) => { const np = [...parties]; np[index].share_physical = parseFloat(e.target.value) || 0; setParties(np); }} className={`${fieldClass} text-center roy-num`} /></div>
              <div><label className="block text-[10.5px] text-ink-faint mb-1">Digital (%)</label><input type="number" min="0" max="100" step="any" value={party.share_digital ?? party.share_percentage} onChange={(e) => { const np = [...parties]; np[index].share_digital = parseFloat(e.target.value) || 0; setParties(np); }} className={`${fieldClass} text-center roy-num`} /></div>
            </div>
          </div>
        ))}
      </div>
      {parties.length > 0 && (() => {
        const total = parties.reduce((sum, p) => sum + p.share_percentage, 0);
        const valid = Math.abs(total - 100) <= 0.01;
        return (
          <div className={`rounded-[12px] p-3 ${valid ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-muted'}`}>
            <p className="text-[13px] font-semibold roy-num">Total : {total.toFixed(2)}%{!valid && <span className="font-medium"> (doit être 100%)</span>}</p>
          </div>
        );
      })()}
    </div>
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-[12px] border border-line bg-surface px-4 py-3 text-[13px] text-neg">
          {error}<button onClick={() => setError(null)} className="ml-2 underline">Fermer</button>
        </div>
      )}

      {/* Catalog Contract */}
      <Card padded={false} className="overflow-hidden">
        <div className="px-[22px] py-4 border-b border-line">
          <h2 className="text-[13.5px] font-semibold text-ink">Contrat catalogue (défaut)</h2>
          <p className="text-[11.5px] text-ink-faint mt-0.5">S&apos;applique à tout sauf si un contrat spécifique existe</p>
        </div>
        {catalogContract ? (
          <div className="px-[22px] py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[12px] bg-accent-soft text-accent flex items-center justify-center shrink-0"><IconCheck size={18} /></div>
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">{(() => { const { artistShare, labelShare } = getContractShares(catalogContract, artistId); return `${formatPercent(artistShare)}% artiste / ${formatPercent(labelShare)}% label`; })()}</p>
                  <p className="text-[12.5px] text-ink-faint">Depuis {new Date(catalogContract.start_date).toLocaleDateString('fr-FR')}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleEditContract(catalogContract)} className={iconBtnClass} title="Modifier"><EditIcon /></button>
                <button onClick={() => catalogContract.id && handleDeleteContract(catalogContract.id)} disabled={deletingContractId === catalogContract.id} className={delBtnClass} title="Supprimer">{deletingContractId === catalogContract.id ? (<div className="w-4 h-4 border-2 border-ink-faint border-t-transparent rounded-full animate-spin" />) : (<TrashIcon />)}</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-[22px] py-4">
            <p className="text-[13px] text-ink-faint mb-3">Aucun contrat catalogue défini</p>
            <AccentButton onClick={() => { setSelectedItem(null); setContractParties([{ party_type: 'artist', artist_id: artist?.id, share_percentage: 50, share_physical: null, share_digital: null }, { party_type: 'label', label_name: defaultLabelName, share_percentage: 50, share_physical: null, share_digital: null }]); setShowContractForm(true); }}>Définir un contrat catalogue</AccentButton>
          </div>
        )}
      </Card>

      {/* All Contracts */}
      <Card padded={false} className="overflow-hidden">
        <div className="px-[22px] py-4 border-b border-line flex items-center justify-between">
          <div><h2 className="text-[13.5px] font-semibold text-ink">Tous les contrats</h2><p className="text-[11.5px] text-ink-faint mt-0.5">{contracts.length} contrat{contracts.length !== 1 ? 's' : ''} · {releases.length} release{releases.length !== 1 ? 's' : ''}</p></div>
          <a href="/contracts" className="text-[12px] text-accent hover:opacity-80 font-semibold transition-opacity">Voir page Contrats →</a>
        </div>
        <div className="divide-y divide-line max-h-[500px] overflow-y-auto">
          {/* Release contracts */}
          {releases.map((release) => {
            const releaseContract = contracts.find(c => c.scope === 'release' && c.scope_id === release.upc);
            const hasContract = !!releaseContract;
            const effectiveContract = releaseContract || catalogContract;
            const shares = effectiveContract ? getContractShares(effectiveContract, artistId) : null;
            return (
              <div key={release.upc} className="px-[22px] py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Pill tone={hasContract ? 'accent' : 'neutral'}>Release</Pill>
                    <span className={`text-[13px] font-semibold truncate ${release.release_title === '(Sans album)' ? 'text-ink-faint italic' : 'text-ink'}`}>{release.release_title === '(Sans album)' ? 'Sans titre' : release.release_title}</span>
                  </div>
                  {release.upc !== 'UNKNOWN' && (<span className="text-[10.5px] font-mono text-ink-faint">UPC {release.upc}</span>)}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {hasContract ? (
                    <>
                      <Pill tone="accent">{shares ? `${formatPercent(shares.artistShare)}%` : '-'}</Pill>
                      <button onClick={() => handleEditContract(releaseContract!)} className={iconBtnClass} title="Modifier"><EditIcon /></button>
                    </>
                  ) : shares ? (
                    <Pill tone="neutral">{formatPercent(shares.artistShare)}% (catalogue)</Pill>
                  ) : (
                    <button onClick={() => openCreateContractForRelease(release.upc, release.release_title)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-semibold bg-accent-soft text-accent hover:opacity-90 transition-opacity"><IconPlus size={12} />Créer contrat</button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Release contracts that exist in DB but have NO matching transaction release yet */}
          {contracts
            .filter(c => c.scope === 'release' && c.scope_id && c.scope_id !== 'UNKNOWN' && !releases.some(r => r.upc === c.scope_id))
            .map((contract) => {
              const { artistShare } = getContractShares(contract, artistId);
              return (
                <div key={contract.id} className="px-[22px] py-3 flex items-center justify-between gap-3 bg-surface-2/60">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Pill tone="neutral">Release</Pill>
                      <span className="text-[13px] font-semibold text-ink-muted font-mono">{contract.scope_id}</span>
                    </div>
                    <span className="text-[10.5px] text-ink-faint">Pas de ventes importées</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Pill tone="accent">{formatPercent(artistShare)}%</Pill>
                    <button onClick={() => handleEditContract(contract)} className={iconBtnClass} title="Modifier"><EditIcon /></button>
                    <button onClick={() => contract.id && handleDeleteContract(contract.id)} disabled={deletingContractId === contract.id} className={delBtnClass} title="Supprimer">{deletingContractId === contract.id ? (<div className="w-4 h-4 border-2 border-ink-faint border-t-transparent rounded-full animate-spin" />) : (<TrashIcon />)}</button>
                  </div>
                </div>
              );
            })}

          {/* Track-level contracts */}
          {contracts.filter(c => c.scope === 'track').map((contract) => {
            const { artistShare } = getContractShares(contract, artistId);
            const trackName = tracks.find(t => t.isrc === contract.scope_id)?.track_title
              || (contract.description?.startsWith('Track: ') ? contract.description.replace('Track: ', '') : contract.description) || undefined;
            return (
              <div key={contract.id} className="px-[22px] py-3 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><Pill tone="accent">Track</Pill>{trackName && <span className="text-[13px] font-semibold text-ink truncate">{trackName}</span>}{contract.scope_id && <span className="text-[10.5px] font-mono text-ink-faint">{contract.scope_id}</span>}</div></div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Pill tone="accent">{formatPercent(artistShare)}%</Pill>
                  <button onClick={() => handleEditContract(contract)} className={iconBtnClass} title="Modifier"><EditIcon /></button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Contract Form Modal */}
      {showContractForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={resetContractForm} />
          <div className="relative bg-surface border border-line rounded-[16px] shadow-roy max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-line flex-shrink-0 flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-ink">{selectedItem ? `Contrat : ${selectedItem.name}` : 'Contrat catalogue'}</h2>
              <button onClick={resetContractForm} className="p-2 text-ink-faint hover:text-ink transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              {selectedItem && (<div className="rounded-[12px] bg-surface-2 p-3"><p className="text-[12px] text-ink-faint">{selectedItem.type === 'release' ? 'Release (UPC)' : 'Track (ISRC)'}</p><p className="text-[13.5px] font-semibold text-ink">{selectedItem.name}</p><p className="text-[11px] text-ink-faint font-mono mt-1">{selectedItem.id}</p></div>)}
              {/* Track mode for release */}
              {selectedItem && selectedItem.type === 'release' && (
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={contractTrackMode} onChange={async (e) => { const checked = e.target.checked; setContractTrackMode(checked); if (!checked) { setContractSelectedTracks([]); setContractTrackFilter(''); setContractReleaseTracks([]); setManualIsrcs({}); } else if (selectedItem.id && selectedItem.id !== 'UNKNOWN') { setLoadingReleaseTracks(true); try { const relTracks = await getReleaseTracks(selectedItem.id); setContractReleaseTracks(relTracks); } catch { setContractReleaseTracks([]); setManualIsrcs({}); } finally { setLoadingReleaseTracks(false); } } }} className="w-4 h-4 rounded border-line accent-[var(--accent)]" />
                    <span className="text-[13px] text-ink-muted">Appliquer à des tracks spécifiques</span>
                  </label>
                  {contractTrackMode && (() => {
                    if (loadingReleaseTracks) return <p className="mt-2 text-[11px] text-ink-faint italic">Chargement des tracks...</p>;
                    const filter = contractTrackFilter.toLowerCase();
                    const filtered = filter ? contractReleaseTracks.filter(t => t.track_title.toLowerCase().includes(filter) || (t.isrc || '').toLowerCase().includes(filter)) : contractReleaseTracks;
                    const existingTrackIsrcs = new Set(contracts.filter(c => c.scope === 'track' && c.scope_id).map(c => c.scope_id!));
                    const selectableIsrcs = filtered.filter(t => t.isrc && !existingTrackIsrcs.has(t.isrc)).map(t => t.isrc!);
                    return (
                      <div className="mt-2">
                        <input type="text" placeholder="Rechercher une track..." value={contractTrackFilter} onChange={(e) => setContractTrackFilter(e.target.value)} className={`${fieldClass} mb-2`} />
                        {filtered.length > 0 ? (
                          <div className="space-y-1 max-h-56 overflow-y-auto border border-line rounded-[12px] p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] text-ink-faint">{filtered.length} track{filtered.length > 1 ? 's' : ''}</span>
                              {selectableIsrcs.length > 0 && (<button type="button" onClick={() => { const allSelected = selectableIsrcs.every(i => contractSelectedTracks.includes(i)); if (allSelected) setContractSelectedTracks(contractSelectedTracks.filter(i => !selectableIsrcs.includes(i))); else setContractSelectedTracks(Array.from(new Set([...contractSelectedTracks, ...selectableIsrcs]))); }} className="text-[11px] text-accent hover:opacity-80 font-semibold transition-opacity">{selectableIsrcs.every(i => contractSelectedTracks.includes(i)) ? 'Tout desélectionner' : 'Tout sélectionner'}</button>)}
                            </div>
                            {filtered.map((track, idx) => {
                              const hasIsrc = !!track.isrc;
                              const manualVal = manualIsrcs[idx] || '';
                              const effectiveIsrc = track.isrc || (manualVal.length >= 5 ? manualVal : null);
                              const alreadyHasContract = !!effectiveIsrc && existingTrackIsrcs.has(effectiveIsrc);
                              const isDisabled = !effectiveIsrc || alreadyHasContract;
                              return (
                                <div key={track.isrc || `no-isrc-${idx}`} className={`p-1.5 rounded-[8px] ${isDisabled ? 'opacity-50' : 'hover:bg-surface-2'}`}>
                                  <label className={`flex items-center gap-2 ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                    <input type="checkbox" disabled={isDisabled} checked={!!effectiveIsrc && !alreadyHasContract && contractSelectedTracks.includes(effectiveIsrc)} onChange={(e) => { if (!effectiveIsrc || alreadyHasContract) return; if (e.target.checked) setContractSelectedTracks([...contractSelectedTracks, effectiveIsrc]); else setContractSelectedTracks(contractSelectedTracks.filter(i => i !== effectiveIsrc)); }} className="w-4 h-4 rounded border-line accent-[var(--accent)]" />
                                    <div className="flex-1 min-w-0"><p className={`text-[13px] truncate ${alreadyHasContract ? 'text-ink-faint' : 'text-ink'}`}>{track.track_title}</p><p className="text-[10.5px] text-ink-faint">{alreadyHasContract ? <span className="text-accent font-semibold">Contrat existant</span> : hasIsrc ? <span className="font-mono">{track.isrc}</span> : <span className="text-ink-muted">Pas d&apos;ISRC</span>}</p></div>
                                  </label>
                                  {!hasIsrc && (
                                    <div className="flex items-center gap-1 mt-1 ml-6">
                                      <input type="text" placeholder="Entrer l'ISRC..." value={manualVal} onChange={(e) => setManualIsrcs({ ...manualIsrcs, [idx]: e.target.value.toUpperCase() })} className={`flex-1 ${fieldClass} font-mono text-[11px] py-1`} />
                                      {manualVal.length >= 5 && (<button type="button" disabled={savingIsrc === idx} onClick={async () => { setSavingIsrc(idx); try { await assignIsrcToTrack(track.track_title, track.artist_name, manualVal.trim()); const updated = [...contractReleaseTracks]; updated[contractReleaseTracks.indexOf(track)] = { ...track, isrc: manualVal.trim() }; setContractReleaseTracks(updated); setManualIsrcs({ ...manualIsrcs, [idx]: '' }); } catch { /* ignore */ } finally { setSavingIsrc(null); } }} className="px-2 py-1 text-[11px] font-bold bg-accent text-accent-ink rounded-[8px] hover:opacity-90 disabled:opacity-50 transition-opacity">{savingIsrc === idx ? '...' : 'OK'}</button>)}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (<p className="text-[11px] text-ink-faint italic">Aucune track trouvée</p>)}
                      </div>
                    );
                  })()}
                </div>
              )}
              {!selectedItem && (<div className="rounded-[12px] bg-accent-soft p-3"><p className="text-[12.5px] text-accent">Le contrat catalogue s&apos;applique à toutes les releases et tracks qui n&apos;ont pas de contrat spécifique.</p></div>)}
              {renderPartyEditor(contractParties, setContractParties)}
              <div><Input type="date" label="Date de début" value={contractStartDate} onChange={(e) => setContractStartDate(e.target.value)} /></div>
              <div><Input type="date" label="Date de fin (optionnel)" value={contractEndDate} onChange={(e) => setContractEndDate(e.target.value)} /></div>
              <div><label className="roy-eyebrow text-[9.5px] mb-1.5 block">PDF du contrat (optionnel)</label><input type="file" accept="application/pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) setContractFile(file); }} className={fieldClass} />{contractFile && (<p className="text-[11px] text-accent mt-1">{contractFile.name}</p>)}</div>
            </div>
            <div className="px-6 py-4 border-t border-line flex gap-3 flex-shrink-0 bg-surface-2">
              <OutlineButton onClick={resetContractForm} className="flex-1 justify-center">Annuler</OutlineButton>
              <AccentButton onClick={handleCreateContract} disabled={creatingContract || uploadingContract || !contractStartDate || contractParties.length === 0 || Math.abs(contractParties.reduce((sum, p) => sum + p.share_percentage, 0) - 100) > 0.01 || (contractTrackMode && contractSelectedTracks.length === 0)} className="flex-1">
                {(creatingContract || uploadingContract) && <div className="w-3.5 h-3.5 border-2 border-accent-ink border-t-transparent rounded-full animate-spin" />}
                {contractTrackMode && contractSelectedTracks.length > 0 ? `Créer ${contractSelectedTracks.length} contrat${contractSelectedTracks.length > 1 ? 's' : ''}` : 'Créer'}
              </AccentButton>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contract Modal */}
      {editingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setEditingContract(null)} />
          <div className="relative bg-surface border border-line rounded-[16px] shadow-roy max-w-md w-full max-h-[90vh] flex flex-col overflow-hidden">
            <div className="px-6 py-5 border-b border-line flex-shrink-0 flex items-center justify-between">
              <h2 className="text-[16px] font-bold text-ink">Modifier le contrat</h2>
              <button onClick={() => setEditingContract(null)} className="p-2 text-ink-faint hover:text-ink transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
              <div className="rounded-[12px] bg-surface-2 p-3"><p className="text-[12px] text-ink-faint">{editingContract.scope === 'catalog' ? 'Catalogue' : editingContract.scope === 'release' ? 'Release (UPC)' : 'Track (ISRC)'}</p><p className="text-[13.5px] font-semibold text-ink">{editingContract.scope === 'catalog' ? 'Tout le catalogue' : editingContract.scope_id}</p></div>
              {renderPartyEditor(editContractParties, setEditContractParties)}
              <Input type="date" label="Date de début" value={editContractStartDate} onChange={(e) => setEditContractStartDate(e.target.value)} />
            </div>
            <div className="px-6 py-4 border-t border-line flex gap-3 flex-shrink-0 bg-surface-2">
              <OutlineButton onClick={() => setEditingContract(null)} className="flex-1 justify-center">Annuler</OutlineButton>
              <AccentButton onClick={handleUpdateContract} disabled={savingContract || !editContractStartDate || editContractParties.length === 0 || Math.abs(editContractParties.reduce((sum, p) => sum + p.share_percentage, 0) - 100) > 0.01} className="flex-1">
                {savingContract && <div className="w-3.5 h-3.5 border-2 border-accent-ink border-t-transparent rounded-full animate-spin" />}
                Enregistrer
              </AccentButton>
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
