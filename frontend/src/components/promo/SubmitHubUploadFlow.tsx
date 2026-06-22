'use client';

import { useState, useCallback, useEffect } from 'react';
import { Spinner } from '@heroui/react';
import { analyzeSubmitHubCSV, importSubmitHubCSV, getArtists, Artist } from '@/lib/api';
import { AccentButton, OutlineButton, Eyebrow } from '@/components/roy/ui';
import { IconCheck, IconImport } from '@/components/roy/icons';

interface SubmitHubUploadFlowProps {
  onSuccess: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

const fieldClass =
  'w-full h-11 px-3.5 bg-surface border border-line rounded-[10px] text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-line-strong transition-colors';
const labelClass = 'roy-eyebrow text-[9.5px] mb-1.5 block';

export default function SubmitHubUploadFlow({ onSuccess }: SubmitHubUploadFlowProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtistId, setSelectedArtistId] = useState<string>('');
  const [campaignName, setCampaignName] = useState<string>('');
  const [budget, setBudget] = useState<string>('');
  const [previewData, setPreviewData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [batchMode, setBatchMode] = useState(false);

  // Load artists on mount
  useEffect(() => {
    loadArtists();
  }, []);

  const loadArtists = async () => {
    try {
      const data = await getArtists();
      setArtists(data);
    } catch (err: any) {
      console.error('Error loading artists:', err);
    }
  };

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
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
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

  const handleAnalyze = async () => {
    if (!file) {
      setError('Veuillez sélectionner un fichier');
      return;
    }

    // Artist selection is now optional - will be extracted from filename
    try {
      setLoading(true);
      setError(null);
      const result = await analyzeSubmitHubCSV(file);
      setPreviewData(result);
      setStep('preview');
    } catch (err: any) {
      console.error('Error analyzing CSV:', err);
      setError(err.message || 'Erreur lors de l\'analyse du CSV');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      setStep('importing');
      const result = await importSubmitHubCSV(
        file,
        selectedArtistId || undefined,
        campaignName || undefined,
        budget || undefined
      );
      setImportResult(result);
      setStep('done');
    } catch (err: any) {
      console.error('Error importing CSV:', err);
      setError(err.message || 'Erreur lors de l\'import');
      setStep('preview');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setPreviewData(null);
    setImportResult(null);
    setCampaignName('');
    setBudget('');
    setError(null);
  };

  if (step === 'upload') {
    return (
      <div className="space-y-5">
        {/* Info box */}
        <div className="bg-accent-soft rounded-[12px] p-4">
          <p className="text-[13px] text-accent">
            <strong>Format du fichier :</strong> Nommez votre CSV{' '}
            <code className="font-mono bg-surface px-1.5 py-0.5 rounded text-[12px]">Nom Artiste - Titre Chanson.csv</code>
          </p>
          <p className="text-[12px] text-accent/80 mt-1.5">
            Exemple : <code className="font-mono bg-surface px-1.5 py-0.5 rounded">Jonathan Fitas - Radiance.csv</code>
          </p>
        </div>

        {/* Artist selection (optional) */}
        <div>
          <label className={labelClass}>
            Artiste <span className="normal-case tracking-normal text-[10px] text-ink-faint font-normal">(optionnel — auto-détecté depuis le nom du fichier)</span>
          </label>
          <select
            value={selectedArtistId}
            onChange={(e) => setSelectedArtistId(e.target.value)}
            className={fieldClass}
          >
            <option value="">Auto-détection depuis le nom du fichier</option>
            {artists.map((artist) => (
              <option key={artist.id} value={artist.id}>
                {artist.name}
              </option>
            ))}
          </select>
        </div>

        {/* File upload */}
        <div>
          <label className={labelClass}>Fichier CSV SubmitHub</label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-[12px] p-8 text-center transition-colors ${
              isDragging || file ? 'border-accent bg-accent-soft' : 'border-line-strong hover:border-accent'
            }`}
          >
            {file ? (
              <div>
                <p className="text-[13.5px] font-semibold text-ink">{file.name}</p>
                <p className="text-[12px] text-ink-faint mt-1">{(file.size / 1024).toFixed(2)} KB</p>
                <button
                  onClick={() => setFile(null)}
                  className="mt-3 text-[12px] font-semibold text-neg hover:opacity-80 transition-opacity"
                >
                  Supprimer
                </button>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <svg className="w-8 h-8 mx-auto text-ink-faint mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-[13.5px] font-semibold text-ink">Glissez-déposez votre CSV ici</p>
                <p className="text-[12.5px] text-ink-faint mt-1">ou cliquez pour sélectionner</p>
              </>
            )}
          </div>
        </div>

        {/* Optional campaign info */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Nom de campagne (optionnel)</label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ex: Q1 2026 Campaign"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass}>Budget (€, optionnel)</label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Ex: 500"
              className={fieldClass}
            />
          </div>
        </div>

        {error && (
          <p className="text-[13px] text-neg bg-surface-2 border border-line rounded-[12px] px-3.5 py-3">{error}</p>
        )}

        <div className="flex justify-end">
          <AccentButton onClick={handleAnalyze} disabled={loading || !file}>
            {loading && <Spinner size="sm" color="white" />}
            Analyser
          </AccentButton>
        </div>
      </div>
    );
  }

  if (step === 'preview' && previewData) {
    return (
      <div className="space-y-5">
        <div className="bg-accent-soft rounded-[12px] p-4">
          <p className="text-[13.5px] font-semibold text-accent">
            {previewData.total_rows} ligne{previewData.total_rows > 1 ? 's' : ''} détectée{previewData.total_rows > 1 ? 's' : ''}
          </p>
          <p className="text-[12.5px] text-accent/80 mt-1">
            Colonnes : {previewData.columns_detected.join(', ')}
          </p>
        </div>

        {previewData.warnings.length > 0 && (
          <div className="bg-surface-2 border border-line-strong rounded-[12px] p-4">
            <Eyebrow>Avertissements</Eyebrow>
            <ul className="list-disc list-inside text-[12.5px] text-ink-muted mt-2 space-y-1">
              {previewData.warnings.map((warning: string, i: number) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {previewData.sample_rows.length > 0 && (
          <div>
            <Eyebrow>Aperçu (5 premières lignes)</Eyebrow>
            <div className="mt-2 border border-line rounded-[12px] overflow-hidden">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="border-b border-line text-left bg-surface-2">
                    <th className="px-4 py-2.5 font-semibold text-ink-muted">Song</th>
                    <th className="px-4 py-2.5 font-semibold text-ink-muted">Outlet</th>
                    <th className="px-4 py-2.5 font-semibold text-ink-muted">Action</th>
                    <th className="px-4 py-2.5 font-semibold text-ink-muted">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.sample_rows.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5 text-ink">{row.song_title}</td>
                      <td className="px-4 py-2.5 text-ink">{row.outlet_name}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{row.action}</td>
                      <td className="px-4 py-2.5 text-ink-faint">{row.sent_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && (
          <p className="text-[13px] text-neg bg-surface-2 border border-line rounded-[12px] px-3.5 py-3">{error}</p>
        )}

        <div className="flex justify-between">
          <OutlineButton onClick={handleReset}>Retour</OutlineButton>
          <AccentButton onClick={handleImport} disabled={loading}>
            {loading && <Spinner size="sm" color="white" />}
            <IconImport size={14} /> Importer
          </AccentButton>
        </div>
      </div>
    );
  }

  if (step === 'importing') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin w-10 h-10 border-[3px] border-accent border-t-transparent rounded-full mb-4" />
        <p className="text-[13px] text-ink-muted">Import en cours…</p>
      </div>
    );
  }

  if (step === 'done' && importResult) {
    return (
      <div className="space-y-5">
        <div className="bg-accent-soft rounded-[16px] p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-accent text-accent-ink flex items-center justify-center">
            <IconCheck size={26} />
          </div>
          <p className="text-[15px] font-bold text-ink mb-1">Import réussi !</p>
          <p className="text-[13px] text-ink-muted">
            {importResult.created_count} submission{importResult.created_count > 1 ? 's' : ''} importée{importResult.created_count > 1 ? 's' : ''}
          </p>
        </div>

        {importResult.matched_songs.length > 0 && (
          <div className="bg-accent-soft rounded-[12px] p-4">
            <p className="text-[13px] font-semibold text-accent">
              {importResult.matched_songs.length} song{importResult.matched_songs.length > 1 ? 's' : ''} associée{importResult.matched_songs.length > 1 ? 's' : ''} au catalogue
            </p>
          </div>
        )}

        {importResult.unmatched_songs.length > 0 && (
          <div className="bg-surface-2 border border-line-strong rounded-[12px] p-4">
            <p className="text-[13px] font-semibold text-ink mb-1">
              {importResult.unmatched_songs.length} song{importResult.unmatched_songs.length > 1 ? 's' : ''} non trouvée{importResult.unmatched_songs.length > 1 ? 's' : ''} dans le catalogue
            </p>
            <p className="text-[12.5px] text-ink-faint">
              Ces soumissions ont été créées mais ne sont pas liées à un UPC/ISRC.
            </p>
          </div>
        )}

        {importResult.errors.length > 0 && (
          <div className="bg-surface-2 border border-line rounded-[12px] p-4">
            <Eyebrow className="text-neg">Erreurs</Eyebrow>
            <ul className="list-disc list-inside text-[12.5px] text-neg mt-2 space-y-1">
              {importResult.errors.slice(0, 5).map((error: string, i: number) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-between">
          <OutlineButton onClick={handleReset}>Importer un autre fichier</OutlineButton>
          <AccentButton onClick={onSuccess}>Terminer</AccentButton>
        </div>
      </div>
    );
  }

  return null;
}
