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
        return 'bg-success-100 text-success-700';
      case 'failed':
        return 'bg-danger-100 text-danger-700';
      case 'pending':
      case 'processing':
        return 'bg-warning-100 text-warning-700';
      default:
        return 'bg-default-100 text-default-700';
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
      className="w-full flex items-center gap-3 px-4 py-3 bg-default-50 border border-default-200 rounded-xl hover:bg-default-100 transition-colors text-left"
    >
      <span className="text-sm text-default-500 w-20 shrink-0">
        {formatDate(import_.created_at)}
      </span>

      <span className="text-sm font-medium text-foreground w-32 shrink-0 truncate">
        {sourceLabel}
      </span>

      <span className={`text-xs font-medium px-2 py-0.5 rounded-lg ${getStatusStyle()}`}>
        {getStatusLabel()}
      </span>

      <span className="text-sm text-default-600 ml-auto">
        {import_.success_rows.toLocaleString('fr-FR')} lignes
        {import_.error_rows > 0 && (
          <span className="text-danger ml-2">
            ({import_.error_rows} erreur{import_.error_rows > 1 ? 's' : ''})
          </span>
        )}
      </span>
    </button>
  );
}
