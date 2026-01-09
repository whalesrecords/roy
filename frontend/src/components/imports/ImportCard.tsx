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
        return 'bg-success-100 text-success-700 border-success-200';
      case 'failed':
        return 'bg-danger-100 text-danger-700 border-danger-200';
      case 'pending':
      case 'processing':
        return 'bg-warning-100 text-warning-700 border-warning-200';
      default:
        return 'bg-default-100 text-default-700 border-default-200';
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
      className="w-full flex items-center gap-4 px-4 py-3 bg-background hover:bg-content2 border border-divider rounded-xl transition-all duration-200 hover:shadow-md text-left my-1"
    >
      {/* File icon */}
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>

      {/* Date */}
      <span className="text-sm text-secondary-500 w-24 shrink-0">
        {formatDate(import_.created_at)}
      </span>

      {/* Source */}
      <span className="text-sm font-medium text-foreground w-28 shrink-0 truncate">
        {sourceLabel}
      </span>

      {/* Status badge */}
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${getStatusStyle()}`}>
        {getStatusLabel()}
      </span>

      {/* Row count */}
      <span className="text-sm text-secondary-600 ml-auto flex items-center gap-2">
        <span className="font-medium text-foreground">{import_.success_rows.toLocaleString('fr-FR')}</span>
        <span className="text-secondary-400">lignes</span>
        {import_.error_rows > 0 && (
          <span className="text-danger-600 font-medium">
            ({import_.error_rows} erreur{import_.error_rows > 1 ? 's' : ''})
          </span>
        )}
      </span>

      {/* Chevron */}
      <svg className="w-4 h-4 text-secondary-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
