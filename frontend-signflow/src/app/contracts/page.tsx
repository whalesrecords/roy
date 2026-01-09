'use client';

import { useState, useEffect } from 'react';
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
} from '@/lib/api';

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractData | null>(null);
  const [scopeNames, setScopeNames] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Form state
  const [artistId, setArtistId] = useState('');
  const [scope, setScope] = useState<'track' | 'release' | 'catalog'>('catalog');
  const [scopeId, setScopeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');
  const [parties, setParties] = useState<ContractParty[]>([
    { party_type: 'artist', artist_id: '', share_percentage: '0.5' },
    { party_type: 'label', label_name: '', share_percentage: '0.5' },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [contractsData, artistsData] = await Promise.all([
        getContracts(),
        getArtists(),
      ]);
      setContracts(contractsData);
      setArtists(artistsData);

      // Load names for albums/tracks
      const names: Record<string, string> = {};
      for (const contract of contractsData) {
        if (contract.scope_id) {
          try {
            if (contract.scope === 'release') {
              const albumData = await searchAlbumByUPC(contract.scope_id);
              names[contract.scope_id] = albumData.name || contract.scope_id;
            } else if (contract.scope === 'track') {
              const trackData = await searchTrackByISRC(contract.scope_id);
              names[contract.scope_id] = trackData.name || contract.scope_id;
            }
          } catch (e) {
            console.error(`Failed to load name for ${contract.scope_id}:`, e);
            names[contract.scope_id] = contract.scope_id;
          }
        }
      }
      setScopeNames(names);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

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
    setDescription('');
    setParties([
      { party_type: 'artist', artist_id: '', share_percentage: '0.5' },
      { party_type: 'label', label_name: '', share_percentage: '0.5' },
    ]);
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Contrats</h1>
              <p className="text-secondary-500 text-sm mt-0.5">{contracts.length} contrat{contracts.length > 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={() => handleOpenModal()}
              className="px-5 py-2.5 bg-primary text-white font-medium text-sm rounded-full shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 transition-all"
            >
              Nouveau contrat
            </button>
          </div>
        </div>
      </header>

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
        ) : (
          <div className="space-y-4">
            {contracts.map((contract) => {
              const artist = artists.find(a => a.id === contract.artist_id);
              const artistParties = contract.parties.filter(p => p.party_type === 'artist');
              const labelParties = contract.parties.filter(p => p.party_type === 'label');

              let scopeLabel = '';
              if (contract.scope === 'catalog') {
                scopeLabel = 'Tout le catalogue';
              } else if (contract.scope === 'release' && contract.scope_id) {
                scopeLabel = scopeNames[contract.scope_id]
                  ? `Album : ${scopeNames[contract.scope_id]}`
                  : `Release (${contract.scope_id})`;
              } else if (contract.scope === 'track' && contract.scope_id) {
                scopeLabel = scopeNames[contract.scope_id]
                  ? `Track : ${scopeNames[contract.scope_id]}`
                  : `Track (${contract.scope_id})`;
              }

              return (
                <div key={contract.id} className="bg-background border border-divider rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-divider">
                    <div className="flex items-start justify-between gap-4">
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
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Date de debut <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-12 px-4 bg-background border-2 border-default-200 rounded-xl text-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Date de fin
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
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
                          step={0.1}
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
