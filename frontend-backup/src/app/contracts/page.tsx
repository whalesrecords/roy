'use client';

import { useState, useEffect } from 'react';
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
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Input,
  Textarea,
  Select,
  SelectItem,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@heroui/react';

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractData[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<ContractData | null>(null);
  const [scopeNames, setScopeNames] = useState<Record<string, string>>({});

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

      // Charger les noms des albums/tracks pour chaque contrat
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

  if (loading) return <div className="p-8">Chargement...</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-background border-b border-divider">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-foreground">Contrats</h1>
            <Button color="primary" onPress={() => handleOpenModal()} className="rounded-xl">
              Nouveau contrat
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="space-y-4">
          {contracts.length === 0 ? (
            <Card>
              <CardBody>
                <p className="text-center text-gray-500 py-8">Aucun contrat</p>
              </CardBody>
            </Card>
          ) : (
            contracts.map((contract) => {
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
                <Card key={contract.id} className="border border-divider rounded-2xl">
                  <CardBody className="gap-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-foreground">{artist?.name || 'Artiste inconnu'}</h3>
                          <span className="px-3 py-1 text-xs rounded-full bg-primary/10 text-primary font-medium">
                            {scopeLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-default-500">
                          <span>Du {new Date(contract.start_date).toLocaleDateString('fr-FR')}</span>
                          {contract.end_date && (
                            <>
                              <span>•</span>
                              <span>au {new Date(contract.end_date).toLocaleDateString('fr-FR')}</span>
                            </>
                          )}
                          {!contract.end_date && (
                            <>
                              <span>•</span>
                              <span className="text-success font-medium">Illimité</span>
                            </>
                          )}
                        </div>
                        {contract.description && (
                          <p className="mt-2 text-sm text-default-600 italic">{contract.description}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="light" color="primary" onPress={() => handleOpenModal(contract)} className="rounded-xl">
                          Modifier
                        </Button>
                        <Button size="sm" variant="light" color="danger" onPress={() => handleDelete(contract.id!)} className="rounded-xl">
                          Supprimer
                        </Button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-divider">
                      <div>
                        <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-success"></span>
                          Artistes
                        </p>
                        <div className="space-y-2">
                          {artistParties.map((party, i) => {
                            const partyArtist = artists.find(a => a.id === party.artist_id);
                            return (
                              <div key={i} className="flex justify-between items-center py-2 px-3 rounded-xl bg-default-100">
                                <span className="text-sm font-medium text-foreground">{partyArtist?.name || 'Inconnu'}</span>
                                <span className="text-sm font-bold text-success">{(parseFloat(party.share_percentage) * 100).toFixed(1)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-primary"></span>
                          Labels
                        </p>
                        <div className="space-y-2">
                          {labelParties.map((party, i) => (
                            <div key={i} className="flex justify-between items-center py-2 px-3 rounded-xl bg-default-100">
                              <span className="text-sm font-medium text-foreground">{party.label_name}</span>
                              <span className="text-sm font-bold text-primary">{(parseFloat(party.share_percentage) * 100).toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              );
            })
          )}
        </div>
      </main>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="2xl" scrollBehavior="inside">
        <ModalContent className="bg-background rounded-2xl">
          {(onClose) => (
            <>
              <ModalHeader className="text-xl font-semibold">{editingContract ? 'Modifier le contrat' : 'Nouveau contrat'}</ModalHeader>
              <ModalBody>
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Artiste principal <span className="text-danger">*</span>
                    </label>
                    <Select
                      placeholder="Sélectionner un artiste"
                      selectedKeys={artistId ? [artistId] : []}
                      onChange={(e) => setArtistId(e.target.value)}
                      isRequired
                      classNames={{
                        trigger: "rounded-xl bg-default-100 border-2 border-default-200",
                        value: "text-foreground",
                      }}
                    >
                      {artists.map((artist) => (
                        <SelectItem key={artist.id}>{artist.name}</SelectItem>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Portée du contrat <span className="text-danger">*</span>
                    </label>
                    <Select
                      placeholder="Choisir la portée"
                      selectedKeys={[scope]}
                      onChange={(e) => setScope(e.target.value as any)}
                      isRequired
                      classNames={{
                        trigger: "rounded-xl bg-default-100 border-2 border-default-200",
                        value: "text-foreground",
                      }}
                    >
                      <SelectItem key="catalog">Tout le catalogue</SelectItem>
                      <SelectItem key="release">Release spécifique (UPC)</SelectItem>
                      <SelectItem key="track">Track spécifique (ISRC)</SelectItem>
                    </Select>
                  </div>

                  {scope !== 'catalog' && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {scope === 'track' ? 'Code ISRC' : 'Code UPC'} <span className="text-danger">*</span>
                      </label>
                      <Input
                        placeholder={scope === 'track' ? 'Ex: USRC17607839' : 'Ex: 0123456789012'}
                        value={scopeId}
                        onChange={(e) => setScopeId(e.target.value)}
                        isRequired
                        classNames={{
                          inputWrapper: "rounded-xl bg-default-100 border-2 border-default-200",
                        }}
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Date de début <span className="text-danger">*</span>
                      </label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        isRequired
                        classNames={{
                          inputWrapper: "rounded-xl bg-default-100 border-2 border-default-200",
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Date de fin (optionnel)
                      </label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        classNames={{
                          inputWrapper: "rounded-xl bg-default-100 border-2 border-default-200",
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Description (optionnel)
                    </label>
                    <Textarea
                      placeholder="Notes ou détails supplémentaires..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      classNames={{
                        inputWrapper: "rounded-xl bg-default-100 border-2 border-default-200",
                      }}
                      minRows={3}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center pt-4 border-t border-divider">
                      <h3 className="font-semibold text-lg">
                        Répartition des parts
                        <span className={`ml-2 text-sm font-bold ${Math.abs(totalShare - 1) < 0.0001 ? 'text-success' : 'text-danger'}`}>
                          ({(totalShare * 100).toFixed(1)}%)
                        </span>
                      </h3>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="flat"
                          color="success"
                          onPress={() => handleAddParty('artist')}
                          className="rounded-xl"
                        >
                          + Artiste
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          onPress={() => handleAddParty('label')}
                          className="rounded-xl"
                        >
                          + Label
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-y-auto p-1">
                      {parties.map((party, index) => (
                        <div key={index} className="flex gap-3 items-start p-4 rounded-2xl border-2 border-divider bg-content2">
                          <div className="flex-1">
                            {party.party_type === 'artist' ? (
                              <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                  Artiste
                                </label>
                                <Select
                                  placeholder="Sélectionner un artiste"
                                  selectedKeys={party.artist_id ? [party.artist_id] : []}
                                  onChange={(e) => handlePartyChange(index, 'artist_id', e.target.value)}
                                  classNames={{
                                    trigger: "rounded-xl bg-default-100 border-2 border-default-200",
                                    value: "text-foreground",
                                  }}
                                >
                                  {artists.map((artist) => (
                                    <SelectItem key={artist.id}>{artist.name}</SelectItem>
                                  ))}
                                </Select>
                              </div>
                            ) : (
                              <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                  Nom du label
                                </label>
                                <Input
                                  placeholder="Ex: Whales Records"
                                  value={party.label_name || ''}
                                  onChange={(e) => handlePartyChange(index, 'label_name', e.target.value)}
                                  classNames={{
                                    inputWrapper: "rounded-xl bg-default-100 border-2 border-default-200",
                                  }}
                                />
                              </div>
                            )}
                          </div>
                          <div className="w-32">
                            <label className="block text-sm font-medium text-foreground mb-2">
                              Part (%)
                            </label>
                            <Input
                              type="number"
                              placeholder="0-100"
                              min={0}
                              max={100}
                              step={0.1}
                              value={String(parseFloat(party.share_percentage || '0') * 100)}
                              onChange={(e) => handlePartyChange(index, 'share_percentage', String(parseFloat(e.target.value) / 100))}
                              classNames={{
                                inputWrapper: "rounded-xl bg-default-100 border-2 border-default-200",
                              }}
                            />
                          </div>
                          <div className="pt-7">
                            <Button
                              size="sm"
                              isIconOnly
                              variant="flat"
                              color="danger"
                              onPress={() => handleRemoveParty(index)}
                              className="rounded-xl"
                            >
                              ×
                            </Button>
                          </div>
                        </div>
                      ))}
                      {parties.length === 0 && (
                        <p className="text-center text-default-400 py-8">
                          Aucune partie ajoutée. Cliquez sur "+ Artiste" ou "+ Label" pour commencer.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="gap-2">
                <Button variant="flat" onPress={onClose} className="rounded-xl">
                  Annuler
                </Button>
                <Button color="primary" onPress={handleSubmit} className="rounded-xl">
                  {editingContract ? 'Enregistrer' : 'Créer'}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
