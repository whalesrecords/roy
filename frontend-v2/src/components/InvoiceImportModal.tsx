'use client';

import { useState, useCallback, useRef } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Artist, EXPENSE_CATEGORIES, ExtractedInvoice, CreateAdvanceFromInvoice } from '@/lib/types';
import { extractInvoiceData, createAdvanceFromInvoice } from '@/lib/api';

interface InvoiceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  artists: Artist[];
  onSuccess: () => void;
}

interface InvoiceFormData extends ExtractedInvoice {
  // Editable fields
  selectedArtistId: string;
  editedAmount: string;
  editedCategory: string;
  editedDate: string;
  editedDescription: string;
  editedReference: string;
  editedScope: 'catalog' | 'track' | 'release';
  editedScopeId: string;
  // State
  isCreating: boolean;
  isCreated: boolean;
  createError: string | null;
}

export default function InvoiceImportModal({
  isOpen,
  onClose,
  artists,
  onSuccess,
}: InvoiceImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedInvoices, setExtractedInvoices] = useState<InvoiceFormData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Find artist by name (fuzzy match)
  const findArtistByName = useCallback((name: string | null): string => {
    if (!name) return '';
    const nameLower = name.toLowerCase();
    const found = artists.find(a =>
      a.name.toLowerCase() === nameLower ||
      a.name.toLowerCase().includes(nameLower) ||
      nameLower.includes(a.name.toLowerCase())
    );
    return found?.id || '';
  }, [artists]);

  // Handle file selection
  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsExtracting(true);
    setError(null);
    const results: InvoiceFormData[] = [];

    for (const file of fileArray) {
      try {
        const extracted = await extractInvoiceData(file);

        // Match artist from filename
        const matchedArtistId = findArtistByName(extracted.artist_from_filename);

        results.push({
          ...extracted,
          selectedArtistId: matchedArtistId,
          editedAmount: extracted.total_amount || '',
          editedCategory: extracted.category_from_filename || '',
          editedDate: extracted.date_from_filename || new Date().toISOString().split('T')[0],
          editedDescription: extracted.description || extracted.vendor_name || '',
          editedReference: extracted.invoice_number || '',
          editedScope: 'catalog',
          editedScopeId: '',
          isCreating: false,
          isCreated: false,
          createError: null,
        });
      } catch (err) {
        results.push({
          success: false,
          filename: file.name,
          date_from_filename: null,
          category_from_filename: null,
          artist_from_filename: null,
          invoice_number: null,
          vendor_name: null,
          total_amount: null,
          currency: 'EUR',
          album_or_track: null,
          description: null,
          confidence_score: 0,
          raw_text: '',
          warnings: [],
          error: err instanceof Error ? err.message : 'Erreur extraction',
          document_base64: null,
          selectedArtistId: '',
          editedAmount: '',
          editedCategory: '',
          editedDate: new Date().toISOString().split('T')[0],
          editedDescription: '',
          editedReference: '',
          editedScope: 'catalog',
          editedScopeId: '',
          isCreating: false,
          isCreated: false,
          createError: null,
        });
      }
    }

    setExtractedInvoices(results);
    setIsExtracting(false);
    setStep('preview');
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  // Update invoice form data
  const updateInvoice = (index: number, updates: Partial<InvoiceFormData>) => {
    setExtractedInvoices(prev => prev.map((inv, i) =>
      i === index ? { ...inv, ...updates } : inv
    ));
  };

  // Create single advance
  const createAdvance = async (index: number) => {
    const invoice = extractedInvoices[index];
    if (!invoice.editedAmount || !invoice.selectedArtistId) return;

    updateInvoice(index, { isCreating: true, createError: null });

    try {
      const data: CreateAdvanceFromInvoice = {
        artist_id: invoice.selectedArtistId,
        amount: invoice.editedAmount,
        currency: invoice.currency || 'EUR',
        scope: invoice.editedScope,
        scope_id: invoice.editedScope !== 'catalog' ? invoice.editedScopeId : undefined,
        category: invoice.editedCategory || undefined,
        description: invoice.editedDescription || undefined,
        reference: invoice.editedReference || undefined,
        effective_date: invoice.editedDate,
        document_base64: invoice.document_base64 || undefined,
      };

      await createAdvanceFromInvoice(data);
      updateInvoice(index, { isCreating: false, isCreated: true });
    } catch (err) {
      updateInvoice(index, {
        isCreating: false,
        createError: err instanceof Error ? err.message : 'Erreur création'
      });
    }
  };

  // Create all advances
  const createAllAdvances = async () => {
    const validInvoices = extractedInvoices.filter(
      inv => inv.editedAmount && inv.selectedArtistId && !inv.isCreated
    );

    for (let i = 0; i < extractedInvoices.length; i++) {
      const invoice = extractedInvoices[i];
      if (invoice.editedAmount && invoice.selectedArtistId && !invoice.isCreated) {
        await createAdvance(i);
      }
    }

    // Check if all done
    const allCreated = extractedInvoices.every(inv => inv.isCreated || !inv.editedAmount);
    if (allCreated) {
      setStep('done');
      onSuccess();
    }
  };

  // Reset and close
  const handleClose = () => {
    setStep('upload');
    setExtractedInvoices([]);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-divider flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {step === 'upload' && 'Importer des factures'}
            {step === 'preview' && `${extractedInvoices.length} facture(s) extraite(s)`}
            {step === 'done' && 'Import terminé'}
          </h2>
          <button
            onClick={handleClose}
            className="text-default-400 hover:text-default-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Upload Step */}
          {step === 'upload' && (
            <div
              className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-default-200 hover:border-default-300'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isExtracting ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-default-600">Extraction en cours...</p>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto mb-4 text-default-300">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-lg font-medium text-foreground mb-2">
                    Glissez vos factures ici
                  </p>
                  <p className="text-sm text-default-500 mb-4">
                    PDF ou images (PNG, JPG) - Format: YYYYMMDD_Categorie_Artiste.pdf
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFiles(e.target.files)}
                  />
                  <Button onClick={() => fileInputRef.current?.click()}>
                    Parcourir les fichiers
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Preview Step */}
          {step === 'preview' && (
            <div className="space-y-4">
              {extractedInvoices.map((invoice, index) => (
                <div
                  key={index}
                  className={`border rounded-xl p-4 ${
                    invoice.isCreated
                      ? 'border-green-200 bg-green-50'
                      : invoice.createError
                      ? 'border-red-200 bg-red-50'
                      : 'border-default-200'
                  }`}
                >
                  {/* File header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-default-100 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-default-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-foreground text-sm">{invoice.filename}</p>
                        {invoice.confidence_score > 0 && (
                          <p className={`text-xs ${
                            invoice.confidence_score > 0.7 ? 'text-green-600' :
                            invoice.confidence_score > 0.4 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            Confiance: {Math.round(invoice.confidence_score * 100)}%
                          </p>
                        )}
                      </div>
                    </div>
                    {invoice.isCreated ? (
                      <span className="text-green-600 font-medium text-sm flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Créée
                      </span>
                    ) : invoice.createError ? (
                      <span className="text-red-600 text-sm">{invoice.createError}</span>
                    ) : null}
                  </div>

                  {/* Form fields */}
                  {!invoice.isCreated && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Artist */}
                      <div>
                        <label className="block text-xs font-medium text-default-600 mb-1">
                          Artiste *
                        </label>
                        <select
                          value={invoice.selectedArtistId}
                          onChange={(e) => updateInvoice(index, { selectedArtistId: e.target.value })}
                          className="w-full px-3 py-2 bg-background border border-default-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Sélectionner...</option>
                          {artists.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                        {invoice.artist_from_filename && !invoice.selectedArtistId && (
                          <p className="text-xs text-yellow-600 mt-1">
                            Suggéré: {invoice.artist_from_filename}
                          </p>
                        )}
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="block text-xs font-medium text-default-600 mb-1">
                          Montant * ({invoice.currency || 'EUR'})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={invoice.editedAmount}
                          onChange={(e) => updateInvoice(index, { editedAmount: e.target.value })}
                          placeholder="0.00"
                          className="w-full h-10 px-3 text-sm rounded-xl bg-default-100 border-2 border-default-200 focus:border-primary focus:outline-none"
                        />
                      </div>

                      {/* Category */}
                      <div>
                        <label className="block text-xs font-medium text-default-600 mb-1">
                          Catégorie
                        </label>
                        <select
                          value={invoice.editedCategory}
                          onChange={(e) => updateInvoice(index, { editedCategory: e.target.value })}
                          className="w-full px-3 py-2 bg-background border border-default-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <option value="">Sélectionner...</option>
                          {EXPENSE_CATEGORIES.map(cat => (
                            <option key={cat.value} value={cat.value}>{cat.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* Date */}
                      <div>
                        <label className="block text-xs font-medium text-default-600 mb-1">
                          Date
                        </label>
                        <Input
                          type="date"
                          value={invoice.editedDate}
                          onChange={(e) => updateInvoice(index, { editedDate: e.target.value })}
                          className="text-sm"
                        />
                      </div>

                      {/* Description */}
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-default-600 mb-1">
                          Description
                        </label>
                        <Input
                          type="text"
                          value={invoice.editedDescription}
                          onChange={(e) => updateInvoice(index, { editedDescription: e.target.value })}
                          placeholder="Description de la dépense"
                          className="text-sm"
                        />
                      </div>

                      {/* Reference */}
                      <div>
                        <label className="block text-xs font-medium text-default-600 mb-1">
                          Référence
                        </label>
                        <Input
                          type="text"
                          value={invoice.editedReference}
                          onChange={(e) => updateInvoice(index, { editedReference: e.target.value })}
                          placeholder="N° facture"
                          className="text-sm"
                        />
                      </div>

                      {/* Create button */}
                      <div className="flex items-end">
                        <Button
                          onClick={() => createAdvance(index)}
                          disabled={!invoice.editedAmount || !invoice.selectedArtistId || invoice.isCreating}
                          size="sm"
                          className="w-full"
                        >
                          {invoice.isCreating ? 'Création...' : 'Créer'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Warnings */}
                  {invoice.warnings && invoice.warnings.length > 0 && (
                    <div className="mt-3 p-2 bg-yellow-50 rounded text-xs text-yellow-700">
                      {invoice.warnings.join(', ')}
                    </div>
                  )}

                  {/* Error */}
                  {invoice.error && (
                    <div className="mt-3 p-2 bg-red-50 rounded text-xs text-red-700">
                      {invoice.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Done Step */}
          {step === 'done' && (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Import terminé</h3>
              <p className="text-default-500 mb-6">
                {extractedInvoices.filter(i => i.isCreated).length} avance(s) créée(s) avec succès
              </p>
              <Button onClick={handleClose}>Fermer</Button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div className="px-6 py-4 border-t border-divider flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep('upload')}>
              Ajouter des fichiers
            </Button>
            <div className="flex items-center gap-3">
              <span className="text-sm text-default-500">
                {extractedInvoices.filter(i => i.isCreated).length} / {extractedInvoices.length} créées
              </span>
              <Button
                onClick={createAllAdvances}
                disabled={extractedInvoices.every(i => i.isCreated || !i.editedAmount || !i.selectedArtistId)}
              >
                Créer toutes les avances
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
