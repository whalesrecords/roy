'use client';

import { useState, useCallback, useEffect } from 'react';
import { Spinner } from '@heroui/react';
import { analyzeSubmitHubCSV, importSubmitHubCSV, getArtists, Artist } from '@/lib/api';

interface SubmitHubUploadFlowProps {
  onSuccess: () => void;
}

type Step = 'upload' | 'preview' | 'importing' | 'done';

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
      <div className="space-y-6">
        {/* Info box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>Format du fichier:</strong> Nommez votre CSV <code className="bg-blue-100 px-1 rounded">Nom Artiste - Titre Chanson.csv</code>
          </p>
          <p className="text-xs text-blue-700 mt-1">
            Exemple: <code className="bg-blue-100 px-1 rounded">Jonathan Fitas - Radiance.csv</code>
          </p>
        </div>

        {/* Artist selection (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Artiste <span className="text-gray-500 text-xs">(optionnel - auto-détecté depuis le nom du fichier)</span>
          </label>
          <select
            value={selectedArtistId}
            onChange={(e) => setSelectedArtistId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fichier CSV SubmitHub
          </label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {file ? (
              <div>
                <p className="text-gray-700 font-medium">{file.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
                <button
                  onClick={() => setFile(null)}
                  className="mt-3 text-sm text-red-600 hover:text-red-700"
                >
                  Supprimer
                </button>
              </div>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">
                  Glissez-déposez votre CSV ici ou
                </p>
                <label className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
                  Parcourir
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Optional campaign info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom de campagne (optionnel)
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ex: Q1 2026 Campaign"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Budget (€, optionnel)
            </label>
            <input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Ex: 500"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            {error}
          </div>
        )}

        <div className="flex justify-end">
          <button
            onClick={handleAnalyze}
            disabled={loading || !file}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && <Spinner size="sm" color="white" />}
            Analyser
          </button>
        </div>
      </div>
    );
  }

  if (step === 'preview' && previewData) {
    return (
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800 font-medium">
            {previewData.total_rows} ligne{previewData.total_rows > 1 ? 's' : ''} détectée{previewData.total_rows > 1 ? 's' : ''}
          </p>
          <p className="text-blue-700 text-sm mt-1">
            Colonnes: {previewData.columns_detected.join(', ')}
          </p>
        </div>

        {previewData.warnings.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 font-medium mb-2">Avertissements:</p>
            <ul className="list-disc list-inside text-sm text-yellow-700">
              {previewData.warnings.map((warning: string, i: number) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {previewData.sample_rows.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Aperçu (5 premières lignes)</h3>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Song</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Outlet</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Action</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {previewData.sample_rows.map((row: any, i: number) => (
                    <tr key={i}>
                      <td className="px-4 py-2">{row.song_title}</td>
                      <td className="px-4 py-2">{row.outlet_name}</td>
                      <td className="px-4 py-2">{row.action}</td>
                      <td className="px-4 py-2">{row.sent_date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
            {error}
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            ← Retour
          </button>
          <button
            onClick={handleImport}
            disabled={loading}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading && <Spinner size="sm" color="white" />}
            Importer
          </button>
        </div>
      </div>
    );
  }

  if (step === 'importing') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner size="lg" />
        <p className="text-gray-600 mt-4">Import en cours...</p>
      </div>
    );
  }

  if (step === 'done' && importResult) {
    return (
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="text-4xl mb-4">✓</div>
          <p className="text-green-800 font-medium text-lg mb-2">Import réussi !</p>
          <p className="text-green-700">
            {importResult.created_count} submission{importResult.created_count > 1 ? 's' : ''} importée{importResult.created_count > 1 ? 's' : ''}
          </p>
        </div>

        {importResult.matched_songs.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800 font-medium mb-2">
              {importResult.matched_songs.length} song{importResult.matched_songs.length > 1 ? 's' : ''} associée{importResult.matched_songs.length > 1 ? 's' : ''} au catalogue
            </p>
          </div>
        )}

        {importResult.unmatched_songs.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800 font-medium mb-2">
              {importResult.unmatched_songs.length} song{importResult.unmatched_songs.length > 1 ? 's' : ''} non trouvée{importResult.unmatched_songs.length > 1 ? 's' : ''} dans le catalogue
            </p>
            <p className="text-yellow-700 text-sm">
              Ces soumissions ont été créées mais ne sont pas liées à un UPC/ISRC.
            </p>
          </div>
        )}

        {importResult.errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium mb-2">Erreurs:</p>
            <ul className="list-disc list-inside text-sm text-red-700">
              {importResult.errors.slice(0, 5).map((error: string, i: number) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Importer un autre fichier
          </button>
          <button
            onClick={onSuccess}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Terminer
          </button>
        </div>
      </div>
    );
  }

  return null;
}
