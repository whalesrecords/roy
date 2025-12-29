'use client';

import { ImportRecord, SOURCES } from '@/lib/types';

interface ImportCardProps {
  import_: ImportRecord;
  onClick?: () => void;
}

export default function ImportCard({ import_, onClick }: ImportCardProps) {
  const sourceLabel =
    SOURCES.find((s) => s.value === import_.source)?.label || import_.source;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getStatusStyle = () => {
    switch (import_.status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = () => {
    switch (import_.status) {
      case 'completed':
        return 'Terminé';
      case 'failed':
        return 'Erreur';
      case 'pending':
        return 'En attente';
      case 'processing':
        return 'En cours';
      default:
        return import_.status;
    }
  };

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-left"
    >
      <span className="text-sm text-gray-500 w-20 shrink-0">
        {formatDate(import_.created_at)}
      </span>

      <span className="text-sm font-medium text-gray-900 w-32 shrink-0 truncate">
        {sourceLabel}
      </span>

      <span className={`text-xs font-medium px-2 py-0.5 rounded ${getStatusStyle()}`}>
        {getStatusLabel()}
      </span>

      <span className="text-sm text-gray-600 ml-auto">
        {import_.success_rows.toLocaleString('fr-FR')} lignes
        {import_.error_rows > 0 && (
          <span className="text-red-600 ml-2">
            ({import_.error_rows} erreur{import_.error_rows > 1 ? 's' : ''})
          </span>
        )}
      </span>
    </button>
  );
}
