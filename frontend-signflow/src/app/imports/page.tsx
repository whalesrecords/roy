'use client';

import { useState, useEffect, useMemo } from 'react';
import { Spinner } from '@heroui/react';
import ImportCard from '@/components/imports/ImportCard';
import EmptyState from '@/components/imports/EmptyState';
import ImportErrors from '@/components/imports/ImportErrors';
import UploadFlow from '@/components/imports/UploadFlow';
import { ImportRecord } from '@/lib/types';
import { getImports, deleteImport, getImportSaleTypes, ImportSaleTypesResponse } from '@/lib/api';

// Source labels mapping
const sourceLabels: Record<string, string> = {
  tunecore: 'TuneCore',
  believe: 'Believe',
  believe_uk: 'Believe UK',
  believe_fr: 'Believe FR',
  cdbaby: 'CD Baby',
  bandcamp: 'Bandcamp',
  squarespace: 'Squarespace',
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

  useEffect(() => {
    loadImports();
  }, []);

  // Group imports by source and year (use end year for multi-year imports)
  const groupedImports = useMemo(() => {
    const groups: Record<string, Record<string, ImportRecord[]>> = {};

    for (const imp of imports) {
      const source = imp.source;
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
    if (!confirm('Supprimer cet import et toutes ses transactions ?')) return;

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
    <>
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-md border-b border-divider sticky top-16 z-30">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Imports</h1>
            <p className="text-secondary-500 text-sm mt-0.5">Gérez vos fichiers de ventes</p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-medium rounded-full hover:bg-primary-600 transition-all duration-200 shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Importer
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-16">
            <Spinner size="lg" color="primary" />
            <p className="text-secondary-500 mt-4">Chargement des imports...</p>
          </div>
        ) : error ? (
          <div className="bg-danger-50 border border-danger-200 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-danger-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-danger font-medium mb-4">{error}</p>
            <button
              onClick={loadImports}
              className="px-5 py-2.5 border-2 border-default-300 text-foreground font-medium rounded-full hover:bg-default-100 transition-colors"
            >
              Réessayer
            </button>
          </div>
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
                <div key={source} className="bg-background border border-divider rounded-2xl overflow-hidden shadow-sm">
                  {/* Source folder header */}
                  <button
                    onClick={() => toggleSource(source)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-content2 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isSourceExpanded ? 'bg-primary' : 'bg-primary/10'} transition-colors`}>
                        <svg className={`w-5 h-5 ${isSourceExpanded ? 'text-white' : 'text-primary'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </div>
                      <span className="font-semibold text-foreground">{sourceLabels[source] || source}</span>
                      <svg
                        className={`w-5 h-5 text-secondary-400 transition-transform duration-200 ${isSourceExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                    <span className="text-sm text-secondary-500 bg-content2 px-3 py-1 rounded-full">
                      {totalImports} import{totalImports > 1 ? 's' : ''}
                    </span>
                  </button>

                  {/* Years */}
                  {isSourceExpanded && (
                    <div className="border-t border-divider bg-content2/50">
                      {years.map((year) => {
                        const yearImports = sourceData[year];
                        const yearKey = `${source}-${year}`;
                        const isYearExpanded = expandedYears.has(yearKey);

                        return (
                          <div key={year} className="border-b border-divider last:border-0">
                            {/* Year folder header */}
                            <button
                              onClick={() => toggleYear(yearKey)}
                              className="w-full flex items-center justify-between px-5 py-3 pl-14 hover:bg-content2 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-default-100 flex items-center justify-center">
                                  <svg className="w-4 h-4 text-secondary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                </div>
                                <span className="text-sm font-medium text-foreground">{year}</span>
                                <svg
                                  className={`w-4 h-4 text-secondary-400 transition-transform duration-200 ${isYearExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </div>
                              <span className="text-xs text-secondary-500">{yearImports.length} fichier{yearImports.length > 1 ? 's' : ''}</span>
                            </button>

                            {/* Individual imports */}
                            {isYearExpanded && (
                              <div className="bg-background/50 py-2">
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
                </div>
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
            className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
            onClick={() => { setSelectedImport(null); setSaleTypes(null); }}
          />
          <div className="relative bg-background rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-divider">
              <h2 className="text-xl font-bold text-foreground">Détails de l'import</h2>
              <p className="text-sm text-secondary-500 mt-1">{selectedImport.filename}</p>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 overflow-y-auto max-h-[50vh] space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-content2 rounded-xl p-4">
                  <p className="text-xs text-secondary-500 uppercase tracking-wide mb-1">Fichier</p>
                  <p className="font-medium text-foreground text-sm truncate">
                    {selectedImport.filename}
                  </p>
                </div>
                <div className="bg-content2 rounded-xl p-4">
                  <p className="text-xs text-secondary-500 uppercase tracking-wide mb-1">Source</p>
                  <p className="font-medium text-foreground text-sm">
                    {sourceLabels[selectedImport.source] || selectedImport.source}
                  </p>
                </div>
                <div className="bg-success-50 rounded-xl p-4">
                  <p className="text-xs text-success-600 uppercase tracking-wide mb-1">Lignes réussies</p>
                  <p className="font-bold text-success-700 text-lg">
                    {selectedImport.success_rows.toLocaleString('fr-FR')}
                  </p>
                </div>
                <div className={`rounded-xl p-4 ${selectedImport.error_rows > 0 ? 'bg-danger-50' : 'bg-content2'}`}>
                  <p className={`text-xs uppercase tracking-wide mb-1 ${selectedImport.error_rows > 0 ? 'text-danger-600' : 'text-secondary-500'}`}>Lignes en erreur</p>
                  <p className={`font-bold text-lg ${selectedImport.error_rows > 0 ? 'text-danger-700' : 'text-foreground'}`}>
                    {selectedImport.error_rows.toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>

              {/* Sale Types Breakdown */}
              {loadingSaleTypes ? (
                <div className="text-center py-6">
                  <Spinner size="sm" color="primary" />
                </div>
              ) : saleTypes && (saleTypes.sale_types.length > 0 || saleTypes.physical_formats.length > 0) && (
                <>
                  <div className="border-t border-divider pt-5">
                    <p className="text-xs text-secondary-500 uppercase tracking-wide mb-3">Types de vente</p>
                    <div className="space-y-2">
                      {saleTypes.sale_types.map((st) => (
                        <div key={st.type} className="flex justify-between items-center bg-content2 rounded-xl px-4 py-3">
                          <span className="text-sm font-medium text-foreground">{saleTypeLabels[st.type] || st.type}</span>
                          <span className="text-sm text-secondary-500">
                            {st.count} ventes · {formatCurrency(st.total)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {saleTypes.physical_formats.length > 0 && (
                    <div className="border-t border-divider pt-5">
                      <p className="text-xs text-secondary-500 uppercase tracking-wide mb-3">Formats physiques</p>
                      <div className="space-y-2">
                        {saleTypes.physical_formats.map((pf) => (
                          <div key={pf.format} className="flex justify-between items-center bg-content2 rounded-xl px-4 py-3">
                            <span className="text-sm font-medium text-foreground">{pf.format}</span>
                            <span className="text-sm text-secondary-500">
                              {pf.count} ventes · {formatCurrency(pf.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {selectedImport.errors.length > 0 && (
                <div className="border-t border-divider pt-5">
                  <ImportErrors errors={selectedImport.errors} />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-divider flex justify-end gap-3 bg-content2/50">
              <button
                onClick={() => { setSelectedImport(null); setSaleTypes(null); }}
                className="px-5 py-2.5 border-2 border-default-300 text-foreground font-medium rounded-full hover:bg-default-100 transition-colors"
              >
                Fermer
              </button>
              <button
                onClick={() => handleDelete(selectedImport.id)}
                disabled={deleting}
                className="flex items-center gap-2 px-5 py-2.5 bg-danger text-white font-medium rounded-full hover:bg-danger-600 disabled:opacity-50 transition-colors shadow-lg shadow-danger/30"
              >
                {deleting ? (
                  <Spinner size="sm" color="white" />
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
    </>
  );
}
