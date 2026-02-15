'use client';

import { useState, useCallback, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import MappingStep from './MappingStep';
import { SOURCES, ImportSource } from '@/lib/types';
import { createImport, analyzeImport, ImportAnalysis } from '@/lib/api';

interface UploadFlowProps {
  onClose: () => void;
  onComplete: () => void;
}

type Step = 'upload' | 'artists' | 'importing' | 'mapping' | 'done';

interface FileEntry {
  file: File;
  analysis: ImportAnalysis | null;
  analyzing: boolean;
  error: string | null;
  imported: boolean;
  importId: string | null;
  skipped: boolean;
}

interface ArtistDecision {
  name: string;
  isSingleArtist: boolean | null;
}

export default function UploadFlow({ onClose, onComplete }: UploadFlowProps) {
  const [step, setStep] = useState<Step>('upload');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [source, setSource] = useState<ImportSource>('tunecore');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [currentImportIndex, setCurrentImportIndex] = useState(0);

  // Artist decisions (aggregated from all files)
  const [artistDecisions, setArtistDecisions] = useState<ArtistDecision[]>([]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      f => f.type === 'text/csv' || f.name.endsWith('.csv')
    );
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    } else {
      setError('Seuls les fichiers CSV sont acceptés');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      addFiles(Array.from(selectedFiles));
    }
  };

  const addFiles = (newFiles: File[]) => {
    const entries: FileEntry[] = newFiles.map(file => ({
      file,
      analysis: null,
      analyzing: true,
      error: null,
      imported: false,
      importId: null,
      skipped: false,
    }));
    setFiles(prev => [...prev, ...entries]);
    setError(null);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Analyze files when added
  useEffect(() => {
    const analyzeFiles = async () => {
      const updatedFiles = [...files];
      let hasChanges = false;

      for (let i = 0; i < updatedFiles.length; i++) {
        const entry = updatedFiles[i];
        if (entry.analyzing && !entry.analysis && !entry.error) {
          try {
            const result = await analyzeImport(entry.file, source);
            updatedFiles[i] = { ...entry, analysis: result, analyzing: false };
            hasChanges = true;
          } catch (err) {
            updatedFiles[i] = {
              ...entry,
              error: err instanceof Error ? err.message : 'Erreur d\'analyse',
              analyzing: false,
            };
            hasChanges = true;
          }
        }
      }

      if (hasChanges) {
        setFiles(updatedFiles);
      }
    };

    analyzeFiles();
  }, [files, source]);

  // Aggregate artist decisions from all files
  useEffect(() => {
    const allArtists = new Set<string>();
    files.forEach(entry => {
      if (entry.analysis?.artists_with_ampersand) {
        entry.analysis.artists_with_ampersand.forEach(a => allArtists.add(a));
      }
    });

    const existingDecisions = new Map(artistDecisions.map(d => [d.name, d.isSingleArtist]));
    const newDecisions = Array.from(allArtists).map(name => ({
      name,
      isSingleArtist: existingDecisions.get(name) ?? null,
    }));

    if (JSON.stringify(newDecisions) !== JSON.stringify(artistDecisions)) {
      setArtistDecisions(newDecisions);
    }
  }, [files]);

  const handleNext = async () => {
    if (files.length === 0) {
      setError('Veuillez sélectionner au moins un fichier');
      return;
    }

    // Check if we need artist decisions
    if (artistDecisions.length > 0) {
      const undecided = artistDecisions.filter(d => d.isSingleArtist === null);
      if (undecided.length > 0) {
        setStep('artists');
        return;
      }
    }

    await startImport();
  };

  const startImport = async () => {
    setStep('importing');
    setCurrentImportIndex(0);

    const updatedFiles = [...files];

    for (let i = 0; i < updatedFiles.length; i++) {
      setCurrentImportIndex(i);
      const entry = updatedFiles[i];

      // Skip files with errors or duplicates that weren't confirmed
      if (entry.error || entry.skipped) {
        continue;
      }

      const periodStart = entry.analysis?.period_start;
      const periodEnd = entry.analysis?.period_end;

      if (!periodStart || !periodEnd) {
        updatedFiles[i] = { ...entry, error: 'Période non détectée' };
        continue;
      }

      try {
        const result = await createImport(entry.file, source, periodStart, periodEnd);
        updatedFiles[i] = { ...entry, imported: true, importId: result.import_id };
      } catch (err) {
        updatedFiles[i] = {
          ...entry,
          error: err instanceof Error ? err.message : "Erreur d'import",
        };
      }

      setFiles([...updatedFiles]);
    }

    setStep('done');
  };

  const handleArtistDecision = (index: number, isSingle: boolean) => {
    const updated = [...artistDecisions];
    updated[index].isSingleArtist = isSingle;
    setArtistDecisions(updated);
  };

  const handleArtistsComplete = async () => {
    await startImport();
  };

  const toggleSkipDuplicate = (index: number) => {
    const updatedFiles = [...files];
    updatedFiles[index].skipped = !updatedFiles[index].skipped;
    setFiles(updatedFiles);
  };

  const allArtistsDecided = artistDecisions.every(d => d.isSingleArtist !== null);
  const isAnalyzing = files.some(f => f.analyzing);
  const validFiles = files.filter(f => !f.error && !f.skipped);
  const successfulImports = files.filter(f => f.imported);

  if (step === 'done') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
        <div className="bg-background w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <div className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Import terminé</h2>
            <p className="text-default-500 mb-6">
              {successfulImports.length} fichier{successfulImports.length > 1 ? 's' : ''} importé{successfulImports.length > 1 ? 's' : ''} avec succès
            </p>

            <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
              {files.map((entry, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-xl text-sm ${
                    entry.imported
                      ? 'bg-success-50 text-success-700'
                      : entry.error
                        ? 'bg-danger-50 text-danger-700'
                        : entry.skipped
                          ? 'bg-default-100 text-default-500'
                          : 'bg-default-50 text-default-700'
                  }`}
                >
                  <span className="truncate">{entry.file.name}</span>
                  <span className="flex-shrink-0 ml-2">
                    {entry.imported ? 'OK' : entry.skipped ? 'Ignoré' : entry.error || 'Erreur'}
                  </span>
                </div>
              ))}
            </div>

            <Button onClick={onComplete} className="w-full">
              Fermer
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'importing') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
        <div className="bg-background w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl">
          <div className="p-6 text-center">
            <div className="animate-spin w-10 h-10 border-3 border-foreground border-t-transparent rounded-full mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Import en cours</h2>
            <p className="text-default-500">
              {currentImportIndex + 1} / {files.length} fichiers
            </p>
            <p className="text-sm text-default-400 mt-1 truncate">
              {files[currentImportIndex]?.file.name}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'artists') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
        <div className="bg-background w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-background border-b border-divider px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Artistes à clarifier
              </h2>
              <button
                onClick={onClose}
                className="p-2 -mr-2 text-default-500 hover:text-default-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="bg-primary-50 rounded-xl p-3">
              <p className="text-sm text-primary-700">
                Certains artistes contiennent "&" ou "feat". S'agit-il d'un seul artiste ou de plusieurs ?
              </p>
            </div>

            <div className="space-y-3">
              {artistDecisions.map((decision, index) => (
                <div key={decision.name} className="bg-default-50 rounded-xl p-4">
                  <p className="font-medium text-foreground mb-3">{decision.name}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleArtistDecision(index, true)}
                      className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        decision.isSingleArtist === true
                          ? 'bg-foreground text-background'
                          : 'bg-background border border-default-200 text-default-700 hover:bg-default-50'
                      }`}
                    >
                      1 artiste unique
                    </button>
                    <button
                      onClick={() => handleArtistDecision(index, false)}
                      className={`flex-1 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                        decision.isSingleArtist === false
                          ? 'bg-foreground text-background'
                          : 'bg-background border border-default-200 text-default-700 hover:bg-default-50'
                      }`}
                    >
                      Plusieurs artistes
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sticky bottom-0 bg-background border-t border-divider p-4 sm:p-6 flex gap-3">
            <Button variant="secondary" onClick={() => setStep('upload')} className="flex-1">
              Retour
            </Button>
            <Button
              onClick={handleArtistsComplete}
              loading={loading}
              disabled={!allArtistsDecided}
              className="flex-1"
            >
              Importer {validFiles.length} fichier{validFiles.length > 1 ? 's' : ''}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-background w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-background border-b border-divider px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              Nouvel import
            </h2>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-default-500 hover:text-default-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              isDragging
                ? 'border-foreground bg-default-50'
                : files.length > 0
                  ? 'border-success-300 bg-success-50'
                  : 'border-default-300 hover:border-default-400'
            }`}
          >
            <input
              type="file"
              accept=".csv"
              multiple
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <svg className="w-8 h-8 mx-auto text-default-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="font-medium text-default-700">
              Glissez vos fichiers CSV ici
            </p>
            <p className="text-sm text-default-500 mt-1">
              ou cliquez pour sélectionner (plusieurs fichiers possibles)
            </p>
          </div>

          <Select
            label="Source"
            value={source}
            onChange={(e) => setSource(e.target.value as ImportSource)}
          >
            {SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-default-700">
                {files.length} fichier{files.length > 1 ? 's' : ''} sélectionné{files.length > 1 ? 's' : ''}
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {files.map((entry, index) => (
                  <div
                    key={index}
                    className={`rounded-xl p-3 ${
                      entry.error
                        ? 'bg-danger-50 border border-danger-200'
                        : entry.analysis?.duplicate && !entry.skipped
                          ? 'bg-warning-50 border border-warning-200'
                          : entry.skipped
                            ? 'bg-default-100 border border-default-200'
                            : 'bg-default-50 border border-default-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className={`font-medium text-sm truncate ${entry.skipped ? 'text-default-400' : 'text-foreground'}`}>
                          {entry.file.name}
                        </p>
                        {entry.analyzing ? (
                          <p className="text-xs text-default-500 flex items-center gap-1 mt-1">
                            <span className="animate-spin w-3 h-3 border border-default-400 border-t-transparent rounded-full inline-block" />
                            Analyse...
                          </p>
                        ) : entry.error ? (
                          <p className="text-xs text-danger mt-1">{entry.error}</p>
                        ) : entry.analysis ? (
                          <div className="mt-1">
                            <p className="text-xs text-default-500">
                              {entry.analysis.period_start && entry.analysis.period_end
                                ? `${new Date(entry.analysis.period_start).toLocaleDateString('fr-FR')} - ${new Date(entry.analysis.period_end).toLocaleDateString('fr-FR')}`
                                : 'Période non détectée'
                              }
                              {entry.analysis.total_artists > 0 && ` · ${entry.analysis.total_artists} artiste${entry.analysis.total_artists > 1 ? 's' : ''}`}
                            </p>
                            {entry.analysis.duplicate && !entry.skipped && (
                              <p className="text-xs text-warning-700 mt-1">
                                Doublon détecté - {entry.analysis.duplicate.rows_inserted} lignes déjà importées
                              </p>
                            )}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1">
                        {entry.analysis?.duplicate && (
                          <button
                            onClick={() => toggleSkipDuplicate(index)}
                            className={`text-xs px-2 py-1 rounded-lg transition-colors ${
                              entry.skipped
                                ? 'bg-default-200 text-default-600'
                                : 'bg-warning-100 text-warning-700'
                            }`}
                          >
                            {entry.skipped ? 'Réactiver' : 'Ignorer'}
                          </button>
                        )}
                        <button
                          onClick={() => removeFile(index)}
                          className="p-1 text-default-400 hover:text-default-600 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Artists with & info */}
          {artistDecisions.length > 0 && (
            <div className="bg-primary-50 rounded-xl p-3">
              <p className="text-sm text-primary-700">
                {artistDecisions.length} artiste{artistDecisions.length > 1 ? 's' : ''} avec "&" ou "feat" détecté{artistDecisions.length > 1 ? 's' : ''}
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-danger bg-danger-50 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 bg-background border-t border-divider p-4 sm:p-6 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button
            onClick={handleNext}
            loading={loading}
            disabled={files.length === 0 || isAnalyzing || validFiles.length === 0}
            className="flex-1"
          >
            {isAnalyzing
              ? 'Analyse...'
              : `Importer ${validFiles.length} fichier${validFiles.length > 1 ? 's' : ''}`
            }
          </Button>
        </div>
      </div>
    </div>
  );
}
