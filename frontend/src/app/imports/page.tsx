'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import ImportCard from '@/components/imports/ImportCard';
import EmptyState from '@/components/imports/EmptyState';
import ImportErrors from '@/components/imports/ImportErrors';
import UploadFlow from '@/components/imports/UploadFlow';
import { ImportRecord } from '@/lib/types';
import { getImports, deleteImport } from '@/lib/api';

export default function ImportsPage() {
  const [imports, setImports] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedImport, setSelectedImport] = useState<ImportRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadImports();
  }, []);

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
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-neutral-900">Imports</h1>
          <Button onClick={() => setShowUpload(true)}>
            <svg className="w-5 h-5 mr-2 -ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Importer
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-neutral-900 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-neutral-500">Chargement...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">{error}</p>
            <Button variant="secondary" onClick={loadImports}>
              Réessayer
            </Button>
          </div>
        ) : imports.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {imports.map((imp) => (
              <ImportCard
                key={imp.id}
                import_={imp}
                onClick={() => setSelectedImport(imp)}
              />
            ))}
          </div>
        )}
      </div>

      {showUpload && (
        <UploadFlow
          onClose={() => setShowUpload(false)}
          onComplete={handleUploadComplete}
        />
      )}

      {selectedImport && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-neutral-100 px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-900">
                  Détails de l'import
                </h2>
                <button
                  onClick={() => setSelectedImport(null)}
                  className="p-2 -mr-2 text-neutral-500 hover:text-neutral-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-neutral-500">Fichier</p>
                  <p className="font-medium text-neutral-900 truncate">
                    {selectedImport.filename}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Source</p>
                  <p className="font-medium text-neutral-900">
                    {selectedImport.source}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Lignes réussies</p>
                  <p className="font-medium text-neutral-900">
                    {selectedImport.success_rows.toLocaleString('fr-FR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-neutral-500">Lignes en erreur</p>
                  <p className="font-medium text-red-600">
                    {selectedImport.error_rows.toLocaleString('fr-FR')}
                  </p>
                </div>
              </div>

              {selectedImport.errors.length > 0 && (
                <ImportErrors errors={selectedImport.errors} />
              )}
            </div>

            <div className="sticky bottom-0 bg-white border-t border-neutral-100 p-4 sm:p-6 flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setSelectedImport(null)}
                className="flex-1"
              >
                Fermer
              </Button>
              <Button
                onClick={() => handleDelete(selectedImport.id)}
                disabled={deleting}
                className="flex-1 !bg-red-600 hover:!bg-red-700"
              >
                {deleting ? 'Suppression...' : 'Supprimer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
