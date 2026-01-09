'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Spinner,
  Select,
  SelectItem,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Tabs,
  Tab,
  Chip,
} from '@heroui/react';
import {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  uploadExpenseDocument,
  deleteExpenseDocument,
  getRoyaltyPayments,
  getFinancesSummary,
  getArtists,
  ExpenseEntry,
  RoyaltyPayment,
  FinancesSummary,
  Artist,
} from '@/lib/api';
import InvoiceImportModal from '@/components/InvoiceImportModal';

const EXPENSE_CATEGORIES = [
  { value: 'mastering', label: 'Mastering' },
  { value: 'mixing', label: 'Mixage' },
  { value: 'recording', label: 'Enregistrement' },
  { value: 'photos', label: 'Photos' },
  { value: 'video', label: 'Video' },
  { value: 'advertising', label: 'Publicite' },
  { value: 'groover', label: 'Groover' },
  { value: 'submithub', label: 'SubmitHub' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'spotify_ads', label: 'Spotify Ads' },
  { value: 'pr', label: 'PR / Relations presse' },
  { value: 'distribution', label: 'Distribution' },
  { value: 'artwork', label: 'Artwork' },
  { value: 'cd', label: 'CD' },
  { value: 'vinyl', label: 'Vinyles' },
  { value: 'goodies', label: 'Goodies / Merch' },
  { value: 'other', label: 'Autre' },
];

export default function FinancesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [royaltyPayments, setRoyaltyPayments] = useState<RoyaltyPayment[]>([]);
  const [summary, setSummary] = useState<FinancesSummary | null>(null);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [activeTab, setActiveTab] = useState<string>('expenses');
  const [selectedArtistFilter, setSelectedArtistFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isInvoiceImportOpen, setIsInvoiceImportOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form state
  const [formAmount, setFormAmount] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formArtistId, setFormArtistId] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formReference, setFormReference] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formScope, setFormScope] = useState<'catalog' | 'track' | 'release'>('catalog');
  const [formScopeId, setFormScopeId] = useState('');

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const years = Array.from({ length: 6 }, (_, i) => (new Date().getFullYear() - i).toString());

  useEffect(() => {
    loadData();
  }, [selectedYear]);

  useEffect(() => {
    loadArtists();
  }, []);

  const loadArtists = async () => {
    try {
      const data = await getArtists();
      setArtists(data);
    } catch (err) {
      console.error('Error loading artists:', err);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [expensesData, paymentsData, summaryData] = await Promise.all([
        getExpenses({ year: parseInt(selectedYear) }),
        getRoyaltyPayments(parseInt(selectedYear)),
        getFinancesSummary(parseInt(selectedYear)),
      ]);
      setExpenses(expensesData);
      setRoyaltyPayments(paymentsData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  const openCreateModal = () => {
    setEditingExpense(null);
    setFormAmount('');
    setFormCategory('');
    setFormArtistId('');
    setFormDescription('');
    setFormReference('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormScope('catalog');
    setFormScopeId('');
    setIsModalOpen(true);
  };

  const openEditModal = (expense: ExpenseEntry) => {
    setEditingExpense(expense);
    setFormAmount(expense.amount);
    setFormCategory(expense.category || '');
    setFormArtistId(expense.artist_id || '');
    setFormDescription(expense.description || '');
    setFormReference(expense.reference || '');
    setFormDate(expense.effective_date.split('T')[0]);
    setFormScope(expense.scope as 'catalog' | 'track' | 'release');
    setFormScopeId(expense.scope_id || '');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formAmount) return;

    setSaving(true);
    try {
      const data = {
        amount: formAmount,
        category: formCategory || undefined,
        artist_id: formArtistId || undefined,
        description: formDescription || undefined,
        reference: formReference || undefined,
        effective_date: formDate,
        scope: formScope,
        scope_id: formScopeId || undefined,
      };

      if (editingExpense) {
        await updateExpense(editingExpense.id, data);
      } else {
        await createExpense(data);
      }

      setIsModalOpen(false);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteExpense(id);
      setDeleteConfirmId(null);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression');
    }
  };

  const handleFileUpload = async (expenseId: string, file: File) => {
    setUploadingId(expenseId);
    try {
      await uploadExpenseDocument(expenseId, file);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur upload');
    } finally {
      setUploadingId(null);
    }
  };

  const handleDeleteDocument = async (expenseId: string) => {
    try {
      await deleteExpenseDocument(expenseId);
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur suppression document');
    }
  };

  const openDocument = (documentUrl: string) => {
    // For base64 PDFs, open in new tab
    if (documentUrl.startsWith('data:')) {
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head><title>Document PDF</title></head>
            <body style="margin:0;padding:0;">
              <embed src="${documentUrl}" type="application/pdf" width="100%" height="100%" />
            </body>
          </html>
        `);
      }
    } else {
      window.open(documentUrl, '_blank');
    }
  };

  const totalExpenses = summary ? parseFloat(summary.total_expenses) : 0;
  const totalRoyalties = summary ? parseFloat(summary.total_royalties_payable) : 0;

  // Filter expenses
  const filteredExpenses = expenses.filter((expense) => {
    if (selectedArtistFilter !== 'all') {
      if (selectedArtistFilter === 'general' && expense.artist_id !== null) {
        return false;
      }
      if (selectedArtistFilter !== 'general' && expense.artist_id !== selectedArtistFilter) {
        return false;
      }
    }
    if (selectedCategoryFilter !== 'all' && expense.category !== selectedCategoryFilter) {
      return false;
    }
    return true;
  });

  // Group by artist
  const expensesByArtist = filteredExpenses.reduce((acc, expense) => {
    const key = expense.artist_id || 'general';
    if (!acc[key]) {
      acc[key] = {
        artist_name: expense.artist_name || 'Frais généraux',
        expenses: [],
        total: 0,
      };
    }
    acc[key].expenses.push(expense);
    acc[key].total += parseFloat(expense.amount);
    return acc;
  }, {} as Record<string, { artist_name: string; expenses: ExpenseEntry[]; total: number }>);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <>
      <header className="bg-background border-b border-divider">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-foreground">Finances</h1>
            <div className="flex items-center gap-3">
              <Select
                size="sm"
                selectedKeys={[selectedYear]}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-32"
                aria-label="Annee"
              >
                {years.map((year) => (
                  <SelectItem key={year}>
                    {year}
                  </SelectItem>
                ))}
              </Select>
              <Button
                variant="flat"
                size="sm"
                onPress={() => setIsInvoiceImportOpen(true)}
              >
                Importer Factures
              </Button>
              <Button color="primary" size="sm" onPress={openCreateModal}>
                + Ajouter
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {error && (
          <Card className="bg-danger-50 rounded-2xl">
            <CardBody>
              <p className="text-danger">{error}</p>
            </CardBody>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="border border-divider rounded-2xl shadow-sm">
            <CardBody className="p-4">
              <p className="text-sm text-default-500">Avances / Frais</p>
              <p className="text-2xl font-bold text-warning">{formatCurrency(totalExpenses)}</p>
              <p className="text-xs text-default-400 mt-1">{summary?.expenses_count || 0} entrees</p>
            </CardBody>
          </Card>
          <Card className="border border-divider rounded-2xl shadow-sm">
            <CardBody className="p-4">
              <p className="text-sm text-default-500">Royalties dues</p>
              <p className="text-2xl font-bold text-secondary">{formatCurrency(totalRoyalties)}</p>
              <p className="text-xs text-default-400 mt-1">{summary?.royalty_runs_count || 0} periodes</p>
            </CardBody>
          </Card>
          <Card className="border border-divider rounded-2xl shadow-sm">
            <CardBody className="p-4">
              <p className="text-sm text-default-500">Total Sorties</p>
              <p className="text-2xl font-bold text-danger">{formatCurrency(totalExpenses + totalRoyalties)}</p>
            </CardBody>
          </Card>
          <Card className="border border-divider rounded-2xl shadow-sm">
            <CardBody className="p-4">
              <p className="text-sm text-default-500">Derniere mise a jour</p>
              <p className="text-lg font-medium text-foreground">{new Date().toLocaleDateString('fr-FR')}</p>
            </CardBody>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          classNames={{
            tabList: 'bg-default-100 rounded-xl p-1',
            tab: 'px-4 py-2',
            cursor: 'bg-background rounded-lg shadow-sm',
          }}
        >
          <Tab key="expenses" title={`Avances / Frais (${expenses.length})`} />
          <Tab key="royalties" title={`Royalties (${royaltyPayments.length})`} />
        </Tabs>

        {/* Expenses List */}
        {activeTab === 'expenses' && (
          <>
            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Artiste</label>
                <Select
                  size="sm"
                  selectedKeys={[selectedArtistFilter]}
                  onChange={(e) => setSelectedArtistFilter(e.target.value)}
                  className="w-64"
                  items={[
                    { key: 'all', label: 'Tous les artistes' },
                    ...artists.map((a) => ({ key: a.id, label: a.name })),
                    { key: 'general', label: 'Frais généraux' },
                  ]}
                >
                  {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Catégorie</label>
                <Select
                  size="sm"
                  selectedKeys={[selectedCategoryFilter]}
                  onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                  className="w-64"
                  items={[
                    { key: 'all', label: 'Toutes les catégories' },
                    ...EXPENSE_CATEGORIES.map((c) => ({ key: c.value, label: c.label })),
                  ]}
                >
                  {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
                </Select>
              </div>
            </div>

            <Card className="border border-divider rounded-2xl shadow-sm">
              <CardHeader className="px-4 py-3 border-b border-divider">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-foreground">Avances et Frais</h2>
                  <p className="text-sm text-default-500">
                    {filteredExpenses.length} dépense{filteredExpenses.length > 1 ? 's' : ''}
                    {' · '}
                    {formatCurrency(filteredExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0))}
                  </p>
                </div>
              </CardHeader>
              <CardBody className="p-0">
                {filteredExpenses.length === 0 ? (
                  <div className="p-8 text-center text-default-500">
                    Aucune dépense trouvée
                  </div>
                ) : (
                  <div className="divide-y divide-divider">
                    {Object.entries(expensesByArtist).map(([artistId, group]) => (
                      <div key={artistId} className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-foreground">{group.artist_name}</h3>
                          <p className="font-semibold text-warning">{formatCurrency(group.total)}</p>
                        </div>
                        <div className="space-y-2">
                          {group.expenses.map((expense) => (
                            <div key={expense.id} className="p-3 bg-default-50 rounded-lg hover:bg-default-100 transition-colors">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-foreground">
                                      {formatCurrency(expense.amount)}
                                    </p>
                                    {expense.category_label && (
                                      <Chip size="sm" variant="flat" color="primary">
                                        {expense.category_label}
                                      </Chip>
                                    )}
                                    {expense.document_url && (
                                      <Chip
                                        size="sm"
                                        variant="flat"
                                        color="success"
                                        className="cursor-pointer"
                                        onClick={() => openDocument(expense.document_url!)}
                                      >
                                        📄 PDF
                                      </Chip>
                                    )}
                                  </div>
                                  {(expense.scope && expense.scope !== 'catalog') && (
                                    <p className="text-sm text-default-600 mt-1">
                                      {expense.scope === 'track' ? '🎵 Track' : '💿 Album'} : {' '}
                                      <span className="font-medium">
                                        {expense.scope_title || (expense.scope_id ? expense.scope_id : 'Non spécifié')}
                                      </span>
                                    </p>
                                  )}
                                  {expense.scope === 'catalog' && (
                                    <p className="text-sm text-default-500 mt-1">📚 Catalogue général</p>
                                  )}
                                  {expense.description && (
                                    <p className="text-sm text-default-500 mt-1 truncate">
                                      {expense.description}
                                    </p>
                                  )}
                                  <p className="text-xs text-default-400 mt-1">
                                    {formatDate(expense.effective_date)}
                                    {expense.reference && ` - Ref: ${expense.reference}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {/* Upload PDF button */}
                                  <input
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file && uploadingId) {
                                        handleFileUpload(uploadingId, file);
                                      }
                                      e.target.value = '';
                                    }}
                                  />
                                  {!expense.document_url ? (
                                    <Button
                                      size="sm"
                                      variant="flat"
                                      isLoading={uploadingId === expense.id}
                                      onPress={() => {
                                        setUploadingId(expense.id);
                                        fileInputRef.current?.click();
                                      }}
                                    >
                                      + PDF
                                    </Button>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="flat"
                                      color="danger"
                                      onPress={() => handleDeleteDocument(expense.id)}
                                    >
                                      Suppr PDF
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="flat"
                                    onPress={() => openEditModal(expense)}
                                  >
                                    Modifier
                                  </Button>
                                  {deleteConfirmId === expense.id ? (
                                    <div className="flex gap-1">
                                      <Button
                                        size="sm"
                                        color="danger"
                                        onPress={() => handleDelete(expense.id)}
                                      >
                                        Confirmer
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="flat"
                                        onPress={() => setDeleteConfirmId(null)}
                                      >
                                        Annuler
                                      </Button>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="flat"
                                      color="danger"
                                      onPress={() => setDeleteConfirmId(expense.id)}
                                    >
                                      Supprimer
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </>
        )}

        {/* Royalty Payments List */}
        {activeTab === 'royalties' && (
          <Card className="border border-divider rounded-2xl shadow-sm">
            <CardHeader className="px-4 py-3 border-b border-divider">
              <h2 className="font-semibold text-foreground">Royalties (periodes verouillees)</h2>
            </CardHeader>
            <CardBody className="p-0">
              {royaltyPayments.length === 0 ? (
                <div className="p-8 text-center text-default-500">
                  Aucune royalty verrouillee pour {selectedYear}
                </div>
              ) : (
                <div className="divide-y divide-divider">
                  {royaltyPayments.map((payment) => (
                    <div key={payment.run_id} className="p-4 hover:bg-default-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-foreground">
                            {formatDate(payment.period_start)} - {formatDate(payment.period_end)}
                          </p>
                          <p className="text-sm text-default-500 mt-1">
                            Royalties artistes: {formatCurrency(payment.total_artist_royalties)}
                            {' | '}
                            Recoup: {formatCurrency(payment.total_recouped)}
                          </p>
                          {payment.locked_at && (
                            <p className="text-xs text-default-400 mt-1">
                              Verrouille le {formatDate(payment.locked_at)}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-secondary">
                            {formatCurrency(payment.total_net_payable)}
                          </p>
                          <Chip size="sm" color="success" variant="flat">
                            {payment.status}
                          </Chip>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} size="lg">
        <ModalContent className="bg-background">{(onClose) => (
          <>
          <ModalHeader>
            {editingExpense ? 'Modifier la depense' : 'Nouvelle depense'}
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Montant (EUR)</label>
                <Input
                  type="number"
                  step="0.01"
                  value={formAmount}
                  onValueChange={setFormAmount}
                  isRequired
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Catégorie</label>
                <Select
                  selectedKeys={formCategory ? [formCategory] : []}
                  onChange={(e) => setFormCategory(e.target.value)}
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Artiste (optionnel)</label>
                <Select
                  selectedKeys={formArtistId ? [formArtistId] : []}
                  onChange={(e) => setFormArtistId(e.target.value)}
                >
                  {artists.map((artist) => (
                    <SelectItem key={artist.id}>
                      {artist.name}
                    </SelectItem>
                  ))}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Périmètre</label>
                <Select
                  selectedKeys={[formScope]}
                  onChange={(e) => setFormScope(e.target.value as 'catalog' | 'track' | 'release')}
                >
                  <SelectItem key="catalog">📚 Catalogue général</SelectItem>
                  <SelectItem key="track">🎵 Track</SelectItem>
                  <SelectItem key="release">💿 Album</SelectItem>
                </Select>
              </div>
              {formScope !== 'catalog' && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    {formScope === 'track' ? 'ISRC' : 'UPC'}
                  </label>
                  <Input
                    value={formScopeId}
                    onValueChange={setFormScopeId}
                    placeholder={formScope === 'track' ? 'Code ISRC du track' : 'Code UPC de l\'album'}
                  />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Description</label>
                <Input
                  value={formDescription}
                  onValueChange={setFormDescription}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Référence</label>
                <Input
                  value={formReference}
                  onValueChange={setFormReference}
                  placeholder="N° facture, etc."
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Date</label>
                <Input
                  type="date"
                  value={formDate}
                  onValueChange={setFormDate}
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setIsModalOpen(false)}>
              Annuler
            </Button>
            <Button
              color="primary"
              onPress={handleSave}
              isLoading={saving}
              isDisabled={!formAmount}
            >
              {editingExpense ? 'Enregistrer' : 'Creer'}
            </Button>
          </ModalFooter>
          </>
        )}</ModalContent>
      </Modal>

      {/* Invoice Import Modal */}
      <InvoiceImportModal
        isOpen={isInvoiceImportOpen}
        onClose={() => setIsInvoiceImportOpen(false)}
        artists={artists}
        onSuccess={loadData}
      />
    </>
  );
}
