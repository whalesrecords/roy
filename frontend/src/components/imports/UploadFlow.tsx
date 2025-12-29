'use client';

import { useState, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Input from '@/components/ui/Input';
import MappingStep from './MappingStep';
import { SOURCES, ImportSource } from '@/lib/types';
import { createImport } from '@/lib/api';

interface UploadFlowProps {
  onClose: () => void;
  onComplete: () => void;
}

type Step = 'upload' | 'mapping';

export default function UploadFlow({ onClose, onComplete }: UploadFlowProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<ImportSource>('tunecore');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importId, setImportId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'text/csv') {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Seuls les fichiers CSV sont acceptés');
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file || !periodStart || !periodEnd) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createImport(file, source, periodStart, periodEnd);
      setImportId(result.id);
      setStep('mapping');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'upload');
    } finally {
      setLoading(false);
    }
  };

  const handleMappingComplete = () => {
    onComplete();
  };

  if (step === 'mapping' && importId) {
    return (
      <MappingStep
        importId={importId}
        filename={file?.name || ''}
        onBack={() => setStep('upload')}
        onComplete={handleMappingComplete}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-neutral-100 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">
              Nouvel import
            </h2>
            <button
              onClick={onClose}
              className="p-2 -mr-2 text-neutral-500 hover:text-neutral-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-neutral-900 text-white text-xs font-medium">
              1
            </div>
            <span className="text-sm text-neutral-900">Fichier et période</span>
            <div className="flex-1 h-px bg-neutral-200 mx-2" />
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-neutral-200 text-neutral-500 text-xs font-medium">
              2
            </div>
            <span className="text-sm text-neutral-400">Mapping</span>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              isDragging
                ? 'border-neutral-900 bg-neutral-50'
                : file
                  ? 'border-green-300 bg-green-50'
                  : 'border-neutral-300 hover:border-neutral-400'
            }`}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {file ? (
              <div>
                <svg className="w-8 h-8 mx-auto text-green-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="font-medium text-neutral-900">{file.name}</p>
                <p className="text-sm text-neutral-500 mt-1">
                  {(file.size / 1024).toFixed(1)} Ko
                </p>
              </div>
            ) : (
              <div>
                <svg className="w-8 h-8 mx-auto text-neutral-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="font-medium text-neutral-700">
                  Glissez un fichier CSV ici
                </p>
                <p className="text-sm text-neutral-500 mt-1">
                  ou cliquez pour sélectionner
                </p>
              </div>
            )}
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

          <div className="grid grid-cols-2 gap-3">
            <Input
              type="date"
              label="Début de période"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
            <Input
              type="date"
              label="Fin de période"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-neutral-100 p-4 sm:p-6 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Annuler
          </Button>
          <Button
            onClick={handleUpload}
            loading={loading}
            disabled={!file || !periodStart || !periodEnd}
            className="flex-1"
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}
