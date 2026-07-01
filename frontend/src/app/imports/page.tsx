'use client';

import { useState, useEffect, useMemo } from 'react';
import { Spinner } from '@heroui/react';
import ImportCard from '@/components/imports/ImportCard';
import EmptyState from '@/components/imports/EmptyState';
import ImportErrors from '@/components/imports/ImportErrors';
import UploadFlow from '@/components/imports/UploadFlow';
import { ImportRecord } from '@/lib/types';
import { getImports, deleteImport, getImportSaleTypes, ImportSaleTypesResponse } from '@/lib/api';
import { Card, Eyebrow, Pill, AccentButton, OutlineButton } from '@/components/roy/ui';
import { IconImport } from '@/components/roy/icons';
import { useConfirm } from '@/components/roy/useConfirm';

// Source labels mapping
const sourceLabels: Record<string, string> = {
  tunecore: 'TuneCore',
  believe: 'Believe',
  believe_uk: 'Believe UK',
  believe_fr: 'Believe FR',
  cdbaby: 'CD Baby',
  bandcamp: 'Bandcamp',
  squarespace: 'Squarespace',
  detailsdetails: 'DetailsDetails (XLSX)',
  other: 'Autre',
};

export default function ImportsPage() {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedImport, setSelectedImport] = useState<ImportRecord | null>(null);
  const [saleTypes, setSaleTypes] = useState<ImportSaleTypesResponse | null>(null);
  const [loadingSaleTypes, setLoadingSaleTypes] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const { confirm, dialog: confirmDialog } = useConfirm();

  useEffect(() => {
    loadImports();
  }, []);

  // Group imports by source and year (use end year for multi-year imports)
  const groupedImports = useMemo(() => {
    const groups: Record<string, Record<string, ImportRecord[]>> = {};

    for (const imp of imports) {
      const source = (imp.source ?? '').toLowerCase();
      const startYear = new Date(imp.period_start).getFullYear();
      const endYear = new Date(imp.period_end).getFullYear();
      const year = startYear === endYear
        ? startYear.toString()
        : `${startYear}-${endYear}`;

      if (!groups[source]) {
        groups[source] = {};
      }
      if (!groups[source][year]) {
        groups[source][year] = [];
      }
      groups[source][year].push(imp);
    }

    // Sort imports within each group by date (newest first)
    for (const source of Object.keys(groups)) {
      for (const year of Object.keys(groups[source])) {
        groups[source][year].sort((a, b) =>
          new Date(b.period_start).getTime() - new Date(a.period_start).getTime()
        );
      }
    }

    return groups;
  }, [imports]);

  // Get sorted sources
  const sortedSources = useMemo(() => {
    return Object.keys(groupedImports).sort((a, b) =>
      (sourceLabels[a] || a).localeCompare(sourceLabels[b] || b)
    );
  }, [groupedImports]);

  const toggleSource = (source: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  };

  const toggleYear = (sourceYear: string) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(sourceYear)) {
        next.delete(sourceYear);
      } else {
        next.add(sourceYear);
      }
      return next;
    });
  };

  const loadImports = async () => {
    try {
      const data = await getImports();
      setImports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = () => {
    setShowUpload(false);
    loadImports();
  };

  const handleSelectImport = async (imp: ImportRecord) => {
    setSelectedImport(imp);
    setSaleTypes(null);
    setLoadingSaleTypes(true);
    try {
      const data = await getImportSaleTypes(imp.id);
      setSaleTypes(data);
    } catch {
      // Sale types optional
    } finally {
      setLoadingSaleTypes(false);
    }
  };

  const saleTypeLabels: Record<string, string> = {
    stream: 'Streaming',
    download: 'Téléchargement',
    physical: 'Physique',
    other: 'Autre',
  };

  const formatCurrency = (value: string, currency: string = 'EUR') => {
    return parseFloat(value).toLocaleString('fr-FR', { style: 'currency', currency });
  };

  const handleDelete = async (importId: string) => {
    if (!(await confirm({ title: 'Supprimer cet import ?', message: 'Cet import et toutes ses transactions seront supprimés. Cette action est irréversible.', danger: true, confirmLabel: 'Supprimer' }))) return;

    setDeleting(true);
    try {
      await deleteImport(importId);
      setSelectedImport(null);
      loadImports();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-full bg-app">
      {/* Topbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 lg:px-7 py-5 border-b border-line">
        <div>
          <h1 className="text-[20px] lg:text-[21px] font-bold tracking-[-0.02em] text-ink">Imports</h1>
          <p className="text-[12.5px] text-ink-faint mt-0.5">Gérez vos fichiers de ventes</p>
        </div>
        <AccentButton onClick={() => setShowUpload(true)}>
          <IconImport size={14} /> Nouvel import
        </AccentButton>
      </div>

      <div className="px-5 lg:px-7 py-5 lg:py-6 space-y-4 max-w-[1200px]">
        {loading ? (
          <Card className="flex flex-col items-center justify-center py-16">
            <Spinner size="lg" />
            <p className="text-ink-faint text-[12.5px] mt-4">Chargement des imports…</p>
          </Card>
        ) : error ? (
          <Card className="py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-surface-2 flex items-center justify-center">
              <svg className="w-6 h-6 text-neg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-neg text-[13px] font-semibold mb-4">{error}</p>
            <div className="flex justify-center">
              <OutlineButton onClick={loadImports}>
                Réessayer
              </OutlineButton>
            </div>
          </Card>
        ) : imports.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {sortedSources.map((source) => {
              const sourceData = groupedImports[source];
              const years = Object.keys(sourceData).sort((a, b) => {
                const getEndYear = (y: string) => {
                  const parts = y.split('-');
                  return parseInt(parts[parts.length - 1]);
                };
                return getEndYear(b) - getEndYear(a);
              });
              const isSourceExpanded = expandedSources.has(source);
              const totalImports = years.reduce((sum, y) => sum + sourceData[y].length, 0);

              return (
                <Card key={source} padded={false} className="overflow-hidden">
                  {/* Source folder header */}
                  <button
                    onClick={() => toggleSource(source)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-2 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-[11px] flex items-center justify-center transition-colors ${isSourceExpanded ? 'bg-accent text-accent-ink' : 'bg-accent-soft text-accent'}`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                      <span className="text-[14px] font-semibold text-ink">{sourceLabels[source] || source}</span>
                      <svg
                        className={`w-5 h-5 text-ink-faint transition-transform duration-200 ${isSourceExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <Pill tone="neutral">
                      {totalImports} import{totalImports > 1 ? 's' : ''}
                    </Pill>
                  </button>

                  {/* Years */}
                  {isSourceExpanded && (
                    <div className="border-t border-line bg-surface-2/50">
                      {years.map((year) => {
                        const yearImports = sourceData[year];
                        const yearKey = `${source}-${year}`;
                        const isYearExpanded = expandedYears.has(yearKey);

                        return (
                          <div key={year} className="border-b border-line last:border-0">
                            {/* Year folder header */}
                            <button
                              onClick={() => toggleYear(yearKey)}
                              className="w-full flex items-center justify-between px-5 py-3 pl-14 hover:bg-surface-2 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-[9px] bg-surface-2 flex items-center justify-center">
                                  <svg className="w-4 h-4 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                                <span className="text-[13px] font-semibold text-ink">{year}</span>
                                <svg
                                  className={`w-4 h-4 text-ink-faint transition-transform duration-200 ${isYearExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                              <span className="text-[11px] text-ink-faint">{yearImports.length} fichier{yearImports.length > 1 ? 's' : ''}</span>
                            </button>

                            {/* Individual imports */}
                            {isYearExpanded && (
                              <div className="bg-surface/50 py-2">
                                {yearImports.map((imp) => (
                                  <div key={imp.id} className="pl-20 pr-5">
                                    <ImportCard
                                      import_={imp}
                                      onClick={() => handleSelectImport(imp)}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {showUpload && (
        <UploadFlow
          onClose={() => setShowUpload(false)}
          onComplete={handleUploadComplete}
        />
      )}

      {/* Detail Modal */}
      {selectedImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => { setSelectedImport(null); setSaleTypes(null); }}
          />
          <div className="relative bg-surface border border-line rounded-[16px] shadow-roy max-w-lg w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-line">
              <h2 className="text-[16px] font-bold text-ink">Détails de l'import</h2>
              <p className="text-[12.5px] text-ink-faint mt-1">{selectedImport.filename}</p>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 overflow-y-auto max-h-[50vh] space-y-5">
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-surface-2 rounded-[12px] p-4">
                  <Eyebrow>Fichier</Eyebrow>
                  <p className="font-semibold text-ink text-[13px] truncate mt-1.5">
                    {selectedImport.filename}
                  </p>
                </div>
                <div className="bg-surface-2 rounded-[12px] p-4">
                  <Eyebrow>Source</Eyebrow>
                  <p className="font-semibold text-ink text-[13px] mt-1.5">
                    {sourceLabels[selectedImport.source] || selectedImport.source}
                  </p>
                </div>
                <div className="bg-accent-soft rounded-[12px] p-4">
                  <Eyebrow className="text-accent">Lignes réussies</Eyebrow>
                  <p className="roy-num font-bold text-accent text-[22px] mt-1">
                    {selectedImport.success_rows.toLocaleString('fr-FR')}
                  </p>
                </div>
                <div className="rounded-[12px] p-4 bg-surface-2">
                  <Eyebrow className={selectedImport.error_rows > 0 ? 'text-neg' : ''}>Lignes en erreur</Eyebrow>
                  <p className={`roy-num font-bold text-[22px] mt-1 ${selectedImport.error_rows > 0 ? 'text-neg' : 'text-ink'}`}>
                    {selectedImport.error_rows.toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>

              {/* Sale Types Breakdown */}
              {loadingSaleTypes ? (
                <div className="text-center py-6">
                  <Spinner size="sm" />
                </div>
              ) : saleTypes && (saleTypes.sale_types.length > 0 || saleTypes.physical_formats.length > 0) && (
                <>
                  <div className="border-t border-line pt-5">
                    <Eyebrow>Types de vente</Eyebrow>
                    <div className="space-y-2 mt-3">
                      {saleTypes.sale_types.map((st) => (
                        <div key={st.type} className="flex justify-between items-center bg-surface-2 rounded-[12px] px-4 py-3">
                          <span className="text-[13px] font-semibold text-ink">{saleTypeLabels[st.type] || st.type}</span>
                          <span className="text-[12.5px] text-ink-muted">
                            {st.count} ventes · <span className="roy-num">{formatCurrency(st.total)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {saleTypes.physical_formats.length > 0 && (
                    <div className="border-t border-line pt-5">
                      <Eyebrow>Formats physiques</Eyebrow>
                      <div className="space-y-2 mt-3">
                        {saleTypes.physical_formats.map((pf) => (
                          <div key={pf.format} className="flex justify-between items-center bg-surface-2 rounded-[12px] px-4 py-3">
                            <span className="text-[13px] font-semibold text-ink">{pf.format}</span>
                            <span className="text-[12.5px] text-ink-muted">
                              {pf.count} ventes · <span className="roy-num">{formatCurrency(pf.total)}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedImport.errors.length > 0 && (
                <div className="border-t border-line pt-5">
                  <ImportErrors errors={selectedImport.errors} />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-line flex justify-end gap-3 bg-surface-2">
              <OutlineButton onClick={() => { setSelectedImport(null); setSaleTypes(null); }}>
                Fermer
              </OutlineButton>
              <button
                onClick={() => handleDelete(selectedImport.id)}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-[10px] border border-line-strong bg-surface px-4 py-2.5 text-[12px] font-bold text-neg hover:bg-surface-2 disabled:opacity-50 transition-colors"
              >
                {deleting ? (
                  <Spinner size="sm" />
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                )}
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog}
    </div>
  );
}
