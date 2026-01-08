'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Button,
  Spinner,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Card,
  CardBody,
  Divider,
} from '@heroui/react';
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
      // Use end year for grouping (more relevant for recent imports)
      // For multi-year spans, show as "2017-2025"
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
      <header className="bg-background border-b border-divider sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">Imports</h1>
          <Button
            color="primary"
            onPress={() => setShowUpload(true)}
            startContent={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            }
          >
            Importer
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <Spinner size="lg" color="primary" />
            <p className="text-default-500 mt-3">Chargement...</p>
          </div>
        ) : error ? (
          <Card className="bg-danger-50">
            <CardBody className="text-center py-12">
              <p className="text-danger mb-4">{error}</p>
              <Button color="default" variant="bordered" onPress={loadImports}>
                Réessayer
              </Button>
            </CardBody>
          </Card>
        ) : imports.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            {sortedSources.map((source) => {
              const sourceData = groupedImports[source];
              // Sort years descending (for multi-year like "2017-2025", use end year)
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
                <div key={source} className="border border-divider rounded-lg overflow-hidden">
                  {/* Source folder header */}
                  <button
                    onClick={() => toggleSource(source)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-default-50 hover:bg-default-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <svg
                        className={`w-5 h-5 text-default-400 transition-transform ${isSourceExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span className="font-medium text-foreground">{sourceLabels[source] || source}</span>
                    </div>
                    <span className="text-sm text-default-500">{totalImports} import{totalImports > 1 ? 's' : ''}</span>
                  </button>

                  {/* Years */}
                  {isSourceExpanded && (
                    <div className="border-t border-divider">
                      {years.map((year) => {
                        const yearImports = sourceData[year];
                        const yearKey = `${source}-${year}`;
                        const isYearExpanded = expandedYears.has(yearKey);

                        return (
                          <div key={year}>
                            {/* Year folder header */}
                            <button
                              onClick={() => toggleYear(yearKey)}
                              className="w-full flex items-center justify-between px-4 py-2.5 pl-10 hover:bg-default-50 transition-colors border-b border-divider last:border-0"
                            >
                              <div className="flex items-center gap-3">
                                <svg
                                  className={`w-4 h-4 text-default-400 transition-transform ${isYearExpanded ? 'rotate-90' : ''}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                                <svg className="w-4 h-4 text-default-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="text-sm font-medium text-foreground">{year}</span>
                              </div>
                              <span className="text-xs text-default-500">{yearImports.length} fichier{yearImports.length > 1 ? 's' : ''}</span>
                            </button>

                            {/* Individual imports */}
                            {isYearExpanded && (
                              <div className="bg-white dark:bg-gray-900 border-b border-divider last:border-0">
                                {yearImports.map((imp) => (
                                  <div key={imp.id} className="pl-16 pr-4">
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

      <Modal
        isOpen={!!selectedImport}
        onClose={() => { setSelectedImport(null); setSaleTypes(null); }}
        size="lg"
        scrollBehavior="inside"
        backdrop="opaque"
      >
        <ModalContent className="bg-white dark:bg-gray-900">
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Détails de l'import
              </ModalHeader>
              <ModalBody>
                {selectedImport && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-default-500">Fichier</p>
                        <p className="font-medium text-foreground truncate">
                          {selectedImport.filename}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-default-500">Source</p>
                        <p className="font-medium text-foreground">
                          {selectedImport.source}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-default-500">Lignes réussies</p>
                        <p className="font-medium text-foreground">
                          {selectedImport.success_rows.toLocaleString('fr-FR')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-default-500">Lignes en erreur</p>
                        <p className="font-medium text-danger">
                          {selectedImport.error_rows.toLocaleString('fr-FR')}
                        </p>
                      </div>
                    </div>

                    {/* Sale Types Breakdown */}
                    {loadingSaleTypes ? (
                      <div className="text-center py-4">
                        <Spinner size="sm" />
                      </div>
                    ) : saleTypes && (saleTypes.sale_types.length > 0 || saleTypes.physical_formats.length > 0) && (
                      <>
                        <Divider />
                        <div>
                          <p className="text-sm text-default-500 mb-2">Types de vente</p>
                          <div className="space-y-2">
                            {saleTypes.sale_types.map((st) => (
                              <div key={st.type} className="flex justify-between items-center">
                                <span className="text-sm font-medium">{saleTypeLabels[st.type] || st.type}</span>
                                <span className="text-sm text-default-500">
                                  {st.count} ventes · {formatCurrency(st.total)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        {saleTypes.physical_formats.length > 0 && (
                          <>
                            <Divider />
                            <div>
                              <p className="text-sm text-default-500 mb-2">Formats physiques</p>
                              <div className="space-y-2">
                                {saleTypes.physical_formats.map((pf) => (
                                  <div key={pf.format} className="flex justify-between items-center">
                                    <span className="text-sm font-medium">{pf.format}</span>
                                    <span className="text-sm text-default-500">
                                      {pf.count} ventes · {formatCurrency(pf.total)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {selectedImport.errors.length > 0 && (
                      <>
                        <Divider />
                        <ImportErrors errors={selectedImport.errors} />
                      </>
                    )}
                  </div>
                )}
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="bordered" onPress={onClose}>
                  Fermer
                </Button>
                <Button
                  color="danger"
                  onPress={() => selectedImport && handleDelete(selectedImport.id)}
                  isLoading={deleting}
                >
                  Supprimer
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
