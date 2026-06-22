'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Input from '@/components/ui/Input';
import { AccentButton, OutlineButton } from '@/components/roy/ui';
import { Artist, EXPENSE_CATEGORIES, ExtractedInvoice, CreateAdvanceFromInvoice } from '@/lib/types';
import { extractInvoiceData, createAdvanceFromInvoice, getArtistReleases, getArtistTracks, CatalogRelease, CatalogTrack } from '@/lib/api';

interface InvoiceImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  artists: Artist[];
  onSuccess: () => void;
}

interface InvoiceFormData extends ExtractedInvoice {
  selectedArtistId: string;
  editedAmount: string;
  editedCategory: string;
  editedDate: string;
  editedDescription: string;
  editedReference: string;
  editedScope: 'catalog' | 'track' | 'release';
  editedScopeId: string;
  isCreating: boolean;
  isCreated: boolean;
  createError: string | null;
  // Preview before API responds
  localPreviewUrl: string | null;
  showOcr: boolean;
  // Catalog data for scope picker
  catalogReleases: CatalogRelease[];
  catalogTracks: CatalogTrack[];
  loadingCatalog: boolean;
}

function isImageDataUri(src: string): boolean {
  return src.startsWith('data:image/');
}

function isPdfDataUri(src: string): boolean {
  return src.startsWith('data:application/pdf') || src.endsWith('.pdf');
}

// ─── Document preview (image or PDF) ────────────────────────────────────────

function DocPreview({
  src,
  filename,
  isExtracting,
}: {
  src: string | null;
  filename: string;
  isExtracting?: boolean;
}) {
  if (isExtracting && src) {
    // Show local preview while waiting for API
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-surface-2">
        {isImageDataUri('data:image/') || /\.(png|jpe?g)$/i.test(filename) ? (
          <img src={src} alt={filename} className="max-h-full max-w-full object-contain opacity-60" />
        ) : (
          <div className="text-ink-faint text-[11px] text-center p-4">
            <svg className="w-10 h-10 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {filename}
          </div>
        )}
        <div className="absolute inset-0 flex items-center justify-center bg-surface/40 rounded">
          <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!src) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-2">
        <svg className="w-10 h-10 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
    );
  }

  if (isImageDataUri(src) || /\.(png|jpe?g)$/i.test(filename)) {
    return (
      <img
        src={src}
        alt={filename}
        className="max-h-full max-w-full object-contain cursor-zoom-in"
        onClick={() => window.open(src, '_blank')}
        title="Cliquer pour agrandir"
      />
    );
  }

  // PDF: render in an iframe
  return (
    <iframe
      src={src}
      title={filename}
      className="w-full h-full border-0"
      style={{ minHeight: '100%' }}
    />
  );
}

// ─── Main modal ──────────────────────────────────────────────────────────────

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

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsExtracting(true);
    setError(null);

    // Build local preview URLs immediately (shown while API processes)
    const initialItems: InvoiceFormData[] = fileArray.map(file => {
      const isImage = /\.(png|jpe?g)$/i.test(file.name);
      const localPreviewUrl = isImage ? URL.createObjectURL(file) : null;
      return {
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
        error: null,
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
        localPreviewUrl,
        showOcr: false,
        catalogReleases: [],
        catalogTracks: [],
        loadingCatalog: false,
      };
    });

    setExtractedInvoices(initialItems);
    setStep('preview');

    // Process each file
    const results: InvoiceFormData[] = [...initialItems];

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      try {
        const extracted = await extractInvoiceData(file);
        const matchedArtistId = findArtistByName(extracted.artist_from_filename);

        results[i] = {
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
          localPreviewUrl: initialItems[i].localPreviewUrl,
          showOcr: false,
          catalogReleases: [],
          catalogTracks: [],
          loadingCatalog: false,
        };
      } catch (err) {
        results[i] = {
          ...initialItems[i],
          success: false,
          error: err instanceof Error ? err.message : 'Erreur extraction',
        };
      }
      // Update progressively so each card resolves as its file is done
      setExtractedInvoices([...results]);
    }

    setIsExtracting(false);
  };

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

  const updateInvoice = (index: number, updates: Partial<InvoiceFormData>) => {
    setExtractedInvoices(prev => prev.map((inv, i) =>
      i === index ? { ...inv, ...updates } : inv
    ));
  };

  const loadCatalog = useCallback(async (index: number, artistId: string, scope: 'track' | 'release') => {
    if (!artistId) return;
    const artistName = artists.find(a => a.id === artistId)?.name;
    if (!artistName) return;

    updateInvoice(index, { loadingCatalog: true, catalogReleases: [], catalogTracks: [] });
    try {
      if (scope === 'release') {
        const releases = await getArtistReleases(artistName);
        updateInvoice(index, { catalogReleases: releases.filter(r => r.upc), loadingCatalog: false });
      } else {
        const tracks = await getArtistTracks(artistName);
        updateInvoice(index, { catalogTracks: tracks.filter(t => t.isrc), loadingCatalog: false });
      }
    } catch {
      updateInvoice(index, { loadingCatalog: false });
    }
  }, [artists]);

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
        createError: err instanceof Error ? err.message : 'Erreur création',
      });
    }
  };

  const createAllAdvances = async () => {
    for (let i = 0; i < extractedInvoices.length; i++) {
      const inv = extractedInvoices[i];
      if (inv.editedAmount && inv.selectedArtistId && !inv.isCreated) {
        await createAdvance(i);
      }
    }
    const allCreated = extractedInvoices.every(i => i.isCreated || !i.editedAmount);
    if (allCreated) {
      setStep('done');
      onSuccess();
    }
  };

  const handleClose = () => {
    // Release object URLs to avoid memory leaks
    extractedInvoices.forEach(inv => {
      if (inv.localPreviewUrl) URL.revokeObjectURL(inv.localPreviewUrl);
    });
    setStep('upload');
    setExtractedInvoices([]);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-surface border border-line rounded-[16px] shadow-roy w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="px-6 py-4 border-b border-line flex items-center justify-between shrink-0">
          <h2 className="text-[16px] font-bold text-ink">
            {step === 'upload' && 'Importer des factures'}
            {step === 'preview' && `${extractedInvoices.length} facture(s)`}
            {step === 'done' && 'Import terminé'}
          </h2>
          <button onClick={handleClose} className="text-ink-faint hover:text-ink p-1 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Upload step ── */}
          {step === 'upload' && (
            <div className="p-6">
              <div
                className={`border-2 border-dashed rounded-[12px] p-12 text-center transition-colors ${
                  isDragging
                    ? 'border-accent bg-accent-soft'
                    : 'border-line-strong hover:border-accent'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="w-16 h-16 mx-auto mb-4 text-ink-faint">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-[16px] font-semibold text-ink mb-2">Glissez vos factures ici</p>
                <p className="text-[13px] text-ink-faint mb-4">
                  PDF ou images (PNG, JPG) — Format suggéré : YYYYMMDD_Catégorie_Artiste.pdf
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFiles(e.target.files)}
                />
                <div className="flex justify-center">
                  <AccentButton onClick={() => fileInputRef.current?.click()}>
                    Parcourir les fichiers
                  </AccentButton>
                </div>
              </div>
              {error && (
                <div className="mt-4 p-3 bg-surface-2 border border-line rounded-[10px] text-[13px] text-neg">{error}</div>
              )}
            </div>
          )}

          {/* ── Preview step ── */}
          {step === 'preview' && (
            <div className="divide-y divide-line">
              {extractedInvoices.map((invoice, index) => {
                const previewSrc = invoice.document_base64 || invoice.localPreviewUrl;
                const stillExtracting = !invoice.success && !invoice.error && isExtracting;
                const confidenceColor =
                  invoice.confidence_score > 0.7 ? 'text-accent' :
                  invoice.confidence_score > 0.4 ? 'text-ink-muted' : 'text-neg';

                return (
                  <div
                    key={index}
                    className={invoice.isCreated ? 'bg-accent-soft/40' : invoice.createError ? 'bg-surface-2' : ''}
                  >
                    {/* Card header */}
                    <div className="flex items-center gap-3 px-4 py-2 bg-surface-2 border-b border-line">
                      <svg className="w-4 h-4 text-ink-faint shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-[13px] font-semibold text-ink flex-1 truncate">{invoice.filename}</span>
                      {stillExtracting && (
                        <span className="text-[11px] text-accent flex items-center gap-1">
                          <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Extraction OCR…
                        </span>
                      )}
                      {invoice.confidence_score > 0 && (
                        <span className={`text-[11px] font-semibold ${confidenceColor}`}>
                          OCR {Math.round(invoice.confidence_score * 100)}%
                        </span>
                      )}
                      {invoice.isCreated && (
                        <span className="text-accent font-semibold text-[13px] flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Créée
                        </span>
                      )}
                    </div>

                    {/* Split layout: preview left / form right */}
                    <div className="flex flex-col md:flex-row">

                      {/* LEFT: document preview */}
                      <div className="md:w-[38%] shrink-0 border-b md:border-b-0 md:border-r border-line bg-surface-2/60 flex items-center justify-center"
                           style={{ minHeight: 260 }}>
                        <div className="w-full h-full p-3 flex items-center justify-center" style={{ maxHeight: 340 }}>
                          <DocPreview
                            src={previewSrc}
                            filename={invoice.filename}
                            isExtracting={stillExtracting}
                          />
                        </div>
                      </div>

                      {/* RIGHT: form */}
                      <div className="flex-1 p-4 space-y-3">
                        {!invoice.isCreated && (
                          <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              {/* Artiste */}
                              <div className="col-span-2 sm:col-span-1">
                                <label className="block text-[11px] font-semibold text-ink-muted mb-1">Artiste *</label>
                                <select
                                  value={invoice.selectedArtistId}
                                  onChange={(e) => {
                                    const newId = e.target.value;
                                    updateInvoice(index, { selectedArtistId: newId, editedScopeId: '', catalogReleases: [], catalogTracks: [] });
                                    if (newId && invoice.editedScope !== 'catalog') {
                                      loadCatalog(index, newId, invoice.editedScope);
                                    }
                                  }}
                                  className="w-full h-9 px-2 bg-surface border border-line rounded-[10px] text-[13px] text-ink focus:outline-none focus:border-line-strong transition-colors"
                                >
                                  <option value="">Sélectionner…</option>
                                  {artists.map(a => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                  ))}
                                </select>
                                {invoice.artist_from_filename && !invoice.selectedArtistId && (
                                  <p className="text-[11px] text-ink-faint mt-0.5">Suggéré : {invoice.artist_from_filename}</p>
                                )}
                              </div>

                              {/* Montant */}
                              <div>
                                <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                                  Montant * ({invoice.currency || 'EUR'})
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={invoice.editedAmount}
                                  onChange={(e) => updateInvoice(index, { editedAmount: e.target.value })}
                                  placeholder="0.00"
                                  className="w-full h-9 px-3 text-[13px] text-ink rounded-[10px] bg-surface border border-line focus:border-line-strong focus:outline-none transition-colors"
                                />
                              </div>

                              {/* Catégorie */}
                              <div>
                                <label className="block text-[11px] font-semibold text-ink-muted mb-1">Catégorie</label>
                                <select
                                  value={invoice.editedCategory}
                                  onChange={(e) => updateInvoice(index, { editedCategory: e.target.value })}
                                  className="w-full h-9 px-2 bg-surface border border-line rounded-[10px] text-[13px] text-ink focus:outline-none focus:border-line-strong transition-colors"
                                >
                                  <option value="">—</option>
                                  {EXPENSE_CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Date */}
                              <div>
                                <label className="block text-[11px] font-semibold text-ink-muted mb-1">Date</label>
                                <Input
                                  type="date"
                                  value={invoice.editedDate}
                                  onChange={(e) => updateInvoice(index, { editedDate: e.target.value })}
                                  className="text-sm h-9"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
                              {/* Description */}
                              <div className="col-span-2">
                                <label className="block text-[11px] font-semibold text-ink-muted mb-1">Description</label>
                                <Input
                                  type="text"
                                  value={invoice.editedDescription}
                                  onChange={(e) => updateInvoice(index, { editedDescription: e.target.value })}
                                  placeholder="Description de la dépense"
                                  className="text-sm h-9"
                                />
                              </div>

                              {/* Référence */}
                              <div>
                                <label className="block text-[11px] font-semibold text-ink-muted mb-1">N° facture</label>
                                <Input
                                  type="text"
                                  value={invoice.editedReference}
                                  onChange={(e) => updateInvoice(index, { editedReference: e.target.value })}
                                  placeholder="Réf."
                                  className="text-sm h-9"
                                />
                              </div>
                            </div>

                            {/* Scope: Album / Track / Catalog */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-start">
                              <div>
                                <label className="block text-[11px] font-semibold text-ink-muted mb-1">Périmètre</label>
                                <select
                                  value={invoice.editedScope}
                                  onChange={(e) => {
                                    const newScope = e.target.value as 'catalog' | 'track' | 'release';
                                    updateInvoice(index, { editedScope: newScope, editedScopeId: '', catalogReleases: [], catalogTracks: [] });
                                    if (newScope !== 'catalog' && invoice.selectedArtistId) {
                                      loadCatalog(index, invoice.selectedArtistId, newScope);
                                    }
                                  }}
                                  className="w-full h-9 px-2 bg-surface border border-line rounded-[10px] text-[13px] text-ink focus:outline-none focus:border-line-strong transition-colors"
                                >
                                  <option value="catalog">Catalogue général</option>
                                  <option value="release">Album</option>
                                  <option value="track">Track</option>
                                </select>
                              </div>
                              {invoice.editedScope !== 'catalog' && (
                                <div className="col-span-2">
                                  <label className="block text-[11px] font-semibold text-ink-muted mb-1">
                                    {invoice.editedScope === 'release' ? 'Album' : 'Track'}
                                    {invoice.loadingCatalog && <span className="ml-1 text-ink-faint text-[11px] font-normal">Chargement…</span>}
                                  </label>
                                  {(invoice.editedScope === 'release' ? invoice.catalogReleases.length > 0 : invoice.catalogTracks.length > 0) ? (
                                    <select
                                      value={invoice.editedScopeId}
                                      onChange={(e) => updateInvoice(index, { editedScopeId: e.target.value })}
                                      className="w-full h-9 px-2 bg-surface border border-line rounded-[10px] text-[13px] text-ink focus:outline-none focus:border-line-strong transition-colors"
                                    >
                                      <option value="">— Sélectionner —</option>
                                      {invoice.editedScope === 'release'
                                        ? invoice.catalogReleases.map(r => (
                                            <option key={r.upc} value={r.upc!}>{r.release_title} ({r.upc})</option>
                                          ))
                                        : invoice.catalogTracks.map(t => (
                                            <option key={t.isrc} value={t.isrc!}>{t.track_title} ({t.isrc})</option>
                                          ))
                                      }
                                    </select>
                                  ) : (
                                    <input
                                      value={invoice.editedScopeId}
                                      onChange={(e) => updateInvoice(index, { editedScopeId: e.target.value })}
                                      placeholder={invoice.editedScope === 'release' ? 'UPC' : 'ISRC'}
                                      onClick={() => {
                                        if (!invoice.loadingCatalog && invoice.selectedArtistId && invoice.editedScope !== 'catalog') {
                                          loadCatalog(index, invoice.selectedArtistId, invoice.editedScope);
                                        }
                                      }}
                                      className="w-full h-9 px-3 text-[13px] text-ink rounded-[10px] bg-surface border border-line focus:border-line-strong focus:outline-none transition-colors"
                                    />
                                  )}
                                  {invoice.album_or_track && !invoice.editedScopeId && (
                                    <p className="text-[11px] text-ink-faint mt-0.5">OCR a détecté : {invoice.album_or_track}</p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Bouton créer */}
                            <div className="flex items-center justify-between gap-3 pt-1">
                              {/* OCR toggle */}
                              {invoice.raw_text && (
                                <button
                                  type="button"
                                  onClick={() => updateInvoice(index, { showOcr: !invoice.showOcr })}
                                  className="text-[11px] text-ink-faint hover:text-ink flex items-center gap-1 transition-colors"
                                >
                                  <svg className={`w-3.5 h-3.5 transition-transform ${invoice.showOcr ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  Texte OCR extrait
                                </button>
                              )}
                              {!invoice.raw_text && <span />}

                              <AccentButton
                                onClick={() => createAdvance(index)}
                                disabled={!invoice.editedAmount || !invoice.selectedArtistId || invoice.isCreating}
                                className="px-3.5 py-2 text-[11.5px]"
                              >
                                {invoice.isCreating ? 'Création…' : 'Créer l\'avance'}
                              </AccentButton>
                            </div>

                            {/* OCR text collapsible */}
                            {invoice.showOcr && invoice.raw_text && (
                              <div className="mt-1 p-3 bg-surface-2 border border-line rounded-[10px]">
                                <p className="text-[11px] font-semibold text-ink-faint mb-1.5">Texte extrait par OCR :</p>
                                <pre className="text-[11px] text-ink-muted whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                                  {invoice.raw_text}
                                </pre>
                              </div>
                            )}

                            {/* Erreur création */}
                            {invoice.createError && (
                              <div className="p-2 bg-surface-2 border border-line rounded-[8px] text-[11px] text-neg">
                                {invoice.createError}
                              </div>
                            )}
                          </>
                        )}

                        {invoice.isCreated && (
                          <div className="py-4 text-center text-[13px] text-accent font-semibold">
                            ✓ Avance créée avec succès
                          </div>
                        )}

                        {/* Warnings */}
                        {invoice.warnings && invoice.warnings.length > 0 && (
                          <div className="p-2 bg-surface-2 border border-line rounded-[8px] text-[11px] text-ink-muted">
                            {invoice.warnings.join(' · ')}
                          </div>
                        )}
                        {invoice.error && (
                          <div className="p-2 bg-surface-2 border border-line rounded-[8px] text-[11px] text-neg">
                            {invoice.error}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Done step ── */}
          {step === 'done' && (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-accent-soft text-accent rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-[16px] font-bold text-ink mb-2">Import terminé</h3>
              <p className="text-[13px] text-ink-faint mb-6">
                {extractedInvoices.filter(i => i.isCreated).length} avance(s) créée(s) avec succès
              </p>
              <div className="flex justify-center">
                <AccentButton onClick={handleClose}>Fermer</AccentButton>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div className="px-6 py-3 border-t border-line flex items-center justify-between shrink-0 bg-surface-2">
            <OutlineButton onClick={() => { setStep('upload'); setExtractedInvoices([]); }} className="px-3.5 py-2 text-[11.5px]">
              + Ajouter des fichiers
            </OutlineButton>
            <div className="flex items-center gap-3">
              <span className="text-[13px] text-ink-faint">
                {extractedInvoices.filter(i => i.isCreated).length} / {extractedInvoices.length} créées
              </span>
              <AccentButton
                onClick={createAllAdvances}
                disabled={
                  isExtracting ||
                  extractedInvoices.every(i => i.isCreated || !i.editedAmount || !i.selectedArtistId)
                }
                className="px-3.5 py-2 text-[11.5px]"
              >
                Tout créer
              </AccentButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
