'use client';

import { useState, useEffect } from 'react';
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
          <div className="space-y-1.5">
            {[...imports]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((imp) => (
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

      <Modal
        isOpen={!!selectedImport}
        onClose={() => setSelectedImport(null)}
        size="lg"
        scrollBehavior="inside"
      >
        <ModalContent>
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
